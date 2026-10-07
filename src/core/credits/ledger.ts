// AI credit ledger, per the frozen V1 spec. Pure logic: the server must repeat these rules with atomic debits.
// Rules: monthly included credits are consumed first and expire at cycle reset; purchased credits are consumed next,
// earliest expiry first, and expire 12 months after purchase; balance never goes negative; debits are idempotent.

export type CreditBucket = {
  kind: 'monthly' | 'purchased';
  remaining: number;
  /** ISO. Monthly buckets expire at cycle reset; purchased buckets 12 months after purchase. */
  expiresAt: string;
};

export type Ledger = {
  buckets: CreditBucket[];
  /** Debit ids already applied. Replaying the same id is a no-op. */
  appliedDebitIds: string[];
};

export type DebitResult =
  | { ok: true; ledger: Ledger; debited: number; alreadyApplied: boolean }
  | { ok: false; reason: 'insufficient_credits' | 'invalid_amount' };

export function balanceAt(ledger: Ledger, nowIso: string): number {
  return ledger.buckets
    .filter((b) => b.expiresAt > nowIso)
    .reduce((sum, b) => sum + b.remaining, 0);
}

/** Consumes monthly first, then purchased by earliest expiry. Expired buckets are never used. */
export function debit(ledger: Ledger, amount: number, debitId: string, nowIso: string): DebitResult {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };
  if (ledger.appliedDebitIds.includes(debitId)) {
    return { ok: true, ledger, debited: 0, alreadyApplied: true };
  }
  const live = ledger.buckets.filter((b) => b.expiresAt > nowIso && b.remaining > 0);
  const total = live.reduce((s, b) => s + b.remaining, 0);
  if (total < amount) return { ok: false, reason: 'insufficient_credits' };

  const order = [...live].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'monthly' ? -1 : 1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });

  let remainingToDebit = amount;
  const remainingById = new Map<CreditBucket, number>();
  for (const b of order) {
    const take = Math.min(b.remaining, remainingToDebit);
    remainingById.set(b, b.remaining - take);
    remainingToDebit -= take;
    if (remainingToDebit === 0) break;
  }

  const buckets = ledger.buckets.map((b) => (remainingById.has(b) ? { ...b, remaining: remainingById.get(b)! } : b));
  return {
    ok: true,
    ledger: { buckets, appliedDebitIds: [...ledger.appliedDebitIds, debitId] },
    debited: amount,
    alreadyApplied: false,
  };
}

/** Monthly credits reset at cycle boundary and do not roll over. Purchased credits are untouched. */
export function resetMonthly(ledger: Ledger, monthlyAllowance: number, nextCycleEndIso: string): Ledger {
  const purchased = ledger.buckets.filter((b) => b.kind === 'purchased');
  return {
    buckets: [{ kind: 'monthly', remaining: monthlyAllowance, expiresAt: nextCycleEndIso }, ...purchased],
    appliedDebitIds: ledger.appliedDebitIds,
  };
}

export function purchasedExpiry(purchasedIso: string): string {
  const d = new Date(purchasedIso);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}
