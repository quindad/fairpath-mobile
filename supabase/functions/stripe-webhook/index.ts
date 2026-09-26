// Stripe webhook: the ONLY path that settles a payment.
//
// Every request is verified against STRIPE_WEBHOOK_SECRET (signature over the raw body). Verified events are
// handed to public.apply_payment_event, which is idempotent per Stripe event id and refuses a payment whose
// amount/currency does not match what the server priced. Returning a non-2xx status makes Stripe retry.
// This function never reads or writes housing_applications.status: payment is not approval.
import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json, requireEnv } from '../_shared/http.ts';

const HANDLED = new Set([
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.requires_action',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
]);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const stripeKey = requireEnv('STRIPE_SECRET_KEY');
  const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');
  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey || !webhookSecret) return json(501, { error: 'payments_not_configured' });
  if (!url || !serviceKey) return json(500, { error: 'server_misconfigured' });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return json(400, { error: 'missing_signature' });
  const rawBody = await req.text();

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return json(400, { error: 'invalid_signature' });
  }

  if (!HANDLED.has(event.type)) return json(200, { received: true, ignored: event.type });

  let intentId: string | null = null;
  let amountReceived: number | null = null;
  let currency: string | null = null;
  let amountRefunded: number | null = null;
  let refundId: string | null = null;
  let failureCode: string | null = null;
  let failureMessage: string | null = null;

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null;
    amountRefunded = charge.amount_refunded;
    const refunds = charge.refunds?.data ?? [];
    refundId = refunds.length ? refunds[refunds.length - 1].id : null;
  } else {
    const intent = event.data.object as Stripe.PaymentIntent;
    intentId = intent.id;
    amountReceived = intent.amount_received ?? intent.amount;
    currency = intent.currency;
    failureCode = intent.last_payment_error?.code ?? null;
    failureMessage = intent.last_payment_error?.message ?? null;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('apply_payment_event', {
    p_event_id: event.id,
    p_type: event.type,
    p_intent_id: intentId,
    p_amount_received: amountReceived,
    p_currency: currency,
    p_amount_refunded: amountRefunded,
    p_refund_id: refundId,
    p_failure_code: failureCode,
    p_failure_message: failureMessage,
    p_payload: { id: event.id, type: event.type, created: event.created, livemode: event.livemode },
  });
  if (error) return json(500, { error: 'processing_failed', detail: error.message }); // Stripe will retry
  return json(200, { received: true, outcome: data });
});
