// Creates (or reuses) the Stripe PaymentIntent for a FastTrack housing application.
//
// SECURITY MODEL
//  * Signed-in members only (JWT). The amount is NEVER read from the request: it is
//    public.quote_housing_fasttrack(...).amount_due_cents, computed by the database from payment_products and
//    the member's server-evaluated FairPath+ entitlement.
//  * The purpose is validated server-side: the application must belong to the caller, be a FastTrack
//    application, and still be a draft ('started').
//  * The STRIPE_SECRET_KEY exists only in this function's environment. The response contains only the
//    PaymentIntent client secret and an ephemeral customer key (both scoped to this payment/customer).
//  * The app cannot mark anything paid. Only stripe-webhook (signature verified) does, via apply_payment_event.
import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';

// Must match the Stripe React Native SDK's expected ephemeral key API version.
const EPHEMERAL_KEY_API_VERSION = '2024-06-20';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const stripeKey = requireEnv('STRIPE_SECRET_KEY');
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey) return json(501, { error: 'payments_not_configured', detail: 'STRIPE_SECRET_KEY is not set for this environment.' });
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json(401, { error: 'unauthorized' });

  let body: { application_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const applicationId = body.application_id;
  if (!applicationId || !UUID.test(applicationId)) return json(400, { error: 'invalid_application_id' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  // 1. purpose validation
  const { data: app } = await admin.from('housing_applications').select('id,user_id,status,application_type').eq('id', applicationId).maybeSingle();
  if (!app || app.user_id !== user.id || app.application_type !== 'fasttrack' || app.status !== 'started') {
    return json(409, { error: 'invalid_purpose', detail: 'Payment is only available for your own FastTrack draft application.' });
  }

  // 2. authoritative price (runs as the member so auth.uid() is theirs)
  const { data: quoteData, error: quoteError } = await userClient.rpc('quote_housing_fasttrack', { p_application_id: applicationId });
  const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;
  if (quoteError || !quote) return json(400, { error: 'quote_failed', detail: quoteError?.message });
  if (quote.status === 'paid' || quote.status === 'waived') return json(200, { already_paid: true, status: quote.status });
  const amount = Number(quote.amount_due_cents);
  if (!Number.isInteger(amount) || amount <= 0) return json(400, { error: 'invalid_amount' });

  // 3. Stripe customer mapping
  let customerId: string | null = null;
  const { data: mapped } = await admin.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (mapped?.stripe_customer_id) customerId = mapped.stripe_customer_id;
  else {
    const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { fairpath_user_id: user.id } }, { idempotencyKey: `customer:${user.id}` });
    customerId = customer.id;
    await admin.from('stripe_customers').upsert({ user_id: user.id, stripe_customer_id: customerId });
  }

  // 4. reuse a live attempt for this application (no double charge on retry / double tap)
  const { data: open } = await admin.from('payment_transactions').select('id,provider_payment_intent_id,amount_cents')
    .eq('purpose', 'housing_fasttrack').eq('purpose_ref', applicationId).in('status', ['requires_payment_method', 'requires_action', 'processing']).maybeSingle();
  let intent: Stripe.PaymentIntent | null = null;
  let transactionId: string | null = null;
  if (open?.provider_payment_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(open.provider_payment_intent_id);
    if (existing.status === 'succeeded') return json(200, { processing: true, transaction_id: open.id, note: 'Payment received; waiting for confirmation.' });
    if (open.amount_cents === amount && existing.status !== 'canceled') { intent = existing; transactionId = open.id; }
    else {
      // price changed (e.g. FairPath+ status changed): retire the old attempt and create a new one
      if (existing.status !== 'canceled') await stripe.paymentIntents.cancel(existing.id);
      await admin.from('payment_transactions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', open.id);
    }
  }

  if (!intent) {
    intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      description: 'FairPath FastTrack housing application',
      metadata: { purpose: 'housing_fasttrack', application_id: applicationId, user_id: user.id },
    }, { idempotencyKey: `fasttrack:${applicationId}:${amount}:${open?.id ?? 'first'}` });
    const { data: txId, error: txError } = await admin.rpc('create_payment_transaction', {
      p_user: user.id, p_purpose: 'housing_fasttrack', p_purpose_ref: applicationId, p_product_code: 'fasttrack_application',
      p_amount_cents: amount, p_currency: 'usd', p_idempotency_key: `fasttrack:${applicationId}:${amount}:${intent.id}`,
      p_intent_id: intent.id, p_customer_id: customerId, p_metadata: { discount_cents: quote.discount_cents },
    });
    if (txError) return json(500, { error: 'transaction_record_failed', detail: txError.message });
    transactionId = txId as string;
  }

  const ephemeral = await stripe.ephemeralKeys.create({ customer: customerId! }, { apiVersion: EPHEMERAL_KEY_API_VERSION });
  return json(200, {
    transaction_id: transactionId,
    client_secret: intent.client_secret,
    ephemeral_key_secret: ephemeral.secret,
    customer_id: customerId,
    amount_cents: amount,
    currency: 'usd',
    base_amount_cents: quote.base_amount_cents,
    discount_cents: quote.discount_cents,
  });
});
