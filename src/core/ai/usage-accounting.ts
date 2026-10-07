// AI usage accounting: gates a billable action against tier and credit balance, debits atomically, and refunds
// automatically if generation fails. No request reaches a provider without passing the tier and credit check first.
// A failed or unavailable provider never leaves the member short credits for nothing delivered.

import { AI_ACTION_CREDITS, tierMayUse, type AiAction, type TierId } from '../membership/frozen-v1.ts';
import { debit, balanceAt, type Ledger } from '../credits/ledger.ts';

export type UsageError =
  | { kind: 'premium_required' }
  | { kind: 'insufficient_credits'; neededCredits: number; availableCredits: number }
  | { kind: 'provider_unavailable'; retryable: boolean }
  | { kind: 'invalid_response' };

export type UsageResult<T> =
  | { ok: true; output: T; ledger: Ledger; creditsCharged: number }
  | { ok: false; error: UsageError; ledger: Ledger };

export type Generator<T> = () => Promise<{ ok: true; output: T } | { ok: false; retryable: boolean }>;

/**
 * Runs a billable AI action. Order: tier check, credit debit, generation, refund-on-failure. The caller's `generate`
 * function must never be called before the debit succeeds, and a debit is reversed if generation does not succeed.
 */
export async function runBilledAction<T>(
  action: AiAction,
  tier: TierId,
  ledger: Ledger,
  requestId: string,
  nowIso: string,
  generate: Generator<T>,
): Promise<UsageResult<T>> {
  if (!tierMayUse(tier, action)) {
    return { ok: false, error: { kind: 'premium_required' }, ledger };
  }
  const cost = AI_ACTION_CREDITS[action];
  const debited = debit(ledger, cost, requestId, nowIso);
  if (!debited.ok) {
    return { ok: false, error: { kind: 'insufficient_credits', neededCredits: cost, availableCredits: balanceAt(ledger, nowIso) }, ledger };
  }

  const result = await generate();
  if (result.ok) {
    return { ok: true, output: result.output, ledger: debited.ledger, creditsCharged: debited.debited };
  }

  // Refund: credit the same amount back as a new bucket so the member is never charged for a failed generation.
  const refunded: Ledger = {
    buckets: [{ kind: 'purchased', remaining: cost, expiresAt: farFuture(nowIso) }, ...debited.ledger.buckets],
    appliedDebitIds: debited.ledger.appliedDebitIds,
  };
  return { ok: false, error: { kind: 'provider_unavailable', retryable: result.retryable }, ledger: refunded };
}

function farFuture(nowIso: string): string {
  const d = new Date(nowIso);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/** DEV-only generator: no live provider is configured, so this always reports unavailable without pretending to answer. */
export function unavailableDevGenerator<T>(): Generator<T> {
  return async () => ({ ok: false, retryable: true });
}

export const USER_MESSAGE: Record<UsageError['kind'], string> = {
  premium_required: 'This is a Premium feature.',
  insufficient_credits: 'You do not have enough AI credits for this. You can buy a refill or wait for your monthly reset.',
  provider_unavailable: 'This AI tool is not available right now. Nothing was charged. You can try again later.',
  invalid_response: 'Something went wrong preparing this. Nothing was charged. You can try again.',
};
