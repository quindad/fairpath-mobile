import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';
import { isSettled } from '@/core/payments/payment-format';

/**
 * Client side of the payment architecture. What this file can and cannot do:
 *  - It ASKS the server (Edge Function create-fasttrack-payment) to prepare a payment. It sends only the
 *    application id: never an amount, price, purpose or "paid" flag.
 *  - It never decides a payment succeeded. After the payment sheet closes it only WAITS for the server
 *    (Stripe webhook -> payment_transactions.status) and re-reads it.
 */
export type PreparedPayment = {
  transaction_id: string;
  client_secret: string;
  ephemeral_key_secret: string;
  customer_id: string;
  amount_cents: number;
  currency: string;
  base_amount_cents: number;
  discount_cents: number;
};

export type PrepareResult =
  | { status: 'ready'; payment: PreparedPayment }
  | { status: 'already_paid' }
  | { status: 'processing'; transactionId: string }
  | { status: 'not_configured'; message: string }
  | { status: 'error'; message: string };

export function paymentsConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}

export async function prepareFastTrackPayment(applicationId: string): Promise<PrepareResult> {
  await currentUser();
  if (!paymentsConfigured()) {
    return { status: 'not_configured', message: 'Card payments are not configured for this FairPath environment yet.' };
  }
  const { data, error } = await supabase.functions.invoke('create-fasttrack-payment', { body: { application_id: applicationId } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 501) return { status: 'not_configured', message: 'Card payments are not configured on the server yet. You were not charged.' };
    if (status === 409) return { status: 'error', message: 'Payment is only available for your own FastTrack draft.' };
    return { status: 'error', message: 'We could not start the payment. You were not charged. Please try again.' };
  }
  if (data?.already_paid) return { status: 'already_paid' };
  if (data?.processing) return { status: 'processing', transactionId: data.transaction_id as string };
  if (!data?.client_secret || !data?.ephemeral_key_secret || !data?.customer_id) {
    return { status: 'error', message: 'The payment could not be prepared. You were not charged.' };
  }
  return { status: 'ready', payment: data as PreparedPayment };
}

export type SettlementResult = 'succeeded' | 'failed' | 'canceled' | 'pending';

/** Polls the SERVER's record of the transaction. "pending" means the webhook has not confirmed it (yet). */
export async function waitForPaymentSettlement(transactionId: string, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<SettlementResult> {
  const timeoutMs = opts.timeoutMs ?? 45000;
  const intervalMs = opts.intervalMs ?? 2000;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data } = await supabase.from('payment_transactions').select('status').eq('id', transactionId).maybeSingle();
    const status = data?.status as string | undefined;
    if (status && isSettled(status)) return status === 'succeeded' ? 'succeeded' : status === 'failed' ? 'failed' : status === 'canceled' ? 'canceled' : 'succeeded';
    if (Date.now() >= deadline) return 'pending';
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export type MyPayment = {
  id: string;
  purpose: string;
  purpose_ref: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider_payment_intent_id: string | null;
  failure_code: string | null;
  created_at: string;
  succeeded_at: string | null;
  refunds: { id: string; amount_cents: number; status: string; created_at: string }[];
};

/** Payment history (separate from application status history). Column-limited by database grants; owner-only by RLS. */
export async function loadMyPayments(): Promise<MyPayment[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('id,purpose,purpose_ref,amount_cents,currency,status,provider_payment_intent_id,failure_code,created_at,succeeded_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as Omit<MyPayment, 'refunds'>[];
  if (!rows.length) return [];
  const { data: refunds } = await supabase.from('payment_refunds').select('id,transaction_id,amount_cents,status,created_at').in('transaction_id', rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    refunds: ((refunds ?? []) as { id: string; transaction_id: string; amount_cents: number; status: string; created_at: string }[]).filter((f) => f.transaction_id === r.id),
  }));
}

/** Display-only FastTrack pricing (server table payment_products). Null when it cannot be read. */
export async function loadFastTrackPricing(): Promise<{ base_amount_cents: number; plus_discount_cents: number; currency: string } | null> {
  const { data, error } = await supabase.from('payment_products').select('base_amount_cents,plus_discount_cents,currency').eq('code', 'fasttrack_application').maybeSingle();
  if (error || !data) return null;
  return data as { base_amount_cents: number; plus_discount_cents: number; currency: string };
}
