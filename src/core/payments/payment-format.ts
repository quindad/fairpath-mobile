// Pure helpers (no imports) so audit scripts can execute them directly under Node.
// Display only. The amount a member pays is decided by the server; nothing here prices anything.

export type PaymentStatus =
  | 'requires_payment_method' | 'requires_action' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'partially_refunded' | 'refunded';

export function formatCents(cents: number, currency = 'usd'): string {
  const symbol = currency.toLowerCase() === 'usd' ? '$' : currency.toUpperCase() + ' ';
  return symbol + (cents / 100).toFixed(2);
}

export function paymentPurposeLabel(purpose: string): string {
  switch (purpose) {
    case 'housing_fasttrack': return 'FastTrack housing application';
    default: return 'Payment';
  }
}

/** Member-facing status. "Paid" only when the server recorded a succeeded transaction. */
export function paymentStatusLabel(status: PaymentStatus | string): string {
  switch (status) {
    case 'succeeded': return 'PAID';
    case 'processing': return 'PROCESSING';
    case 'requires_action': return 'ACTION NEEDED';
    case 'requires_payment_method': return 'NOT COMPLETED';
    case 'failed': return 'FAILED';
    case 'canceled': return 'CANCELLED';
    case 'partially_refunded': return 'PARTLY REFUNDED';
    case 'refunded': return 'REFUNDED';
    default: return String(status).toUpperCase();
  }
}

/** Terminal states: polling for settlement can stop. */
export function isSettled(status: PaymentStatus | string): boolean {
  return ['succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded'].includes(status);
}

/** Short, non-secret reference to show on a receipt. */
export function receiptRef(id: string): string {
  return 'FP-' + id.replace(/-/g, '').slice(0, 8).toUpperCase();
}
