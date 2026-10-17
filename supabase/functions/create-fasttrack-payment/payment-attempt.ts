export type ExistingPayment = {
  id: string;
  amount_cents: number;
  status: string;
  provider_payment_intent_id: string | null;
};

/**
 * Stripe idempotency must survive a lost response, while a declined/canceled attempt must get a fresh key.
 * Anchoring the next key to the latest recorded attempt satisfies both conditions.
 */
export function paymentAttemptKey(applicationId: string, amountCents: number, latest?: Pick<ExistingPayment, 'id'> | null): string {
  return `fasttrack:${applicationId}:${amountCents}:${latest?.id ?? 'first'}`;
}

export function canReuseIntent(existing: Pick<ExistingPayment, 'amount_cents'>, quotedAmount: number, providerStatus: string): boolean {
  return existing.amount_cents === quotedAmount && !['canceled', 'succeeded'].includes(providerStatus);
}

