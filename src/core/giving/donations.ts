// Giving: donation records. No payment is processed here; payment status is 'pending_payment' until a verified
// payment provider confirms it in test mode and, later, live mode with approval. Records are never silently rewritten.

import { remainingUsd, type AssistanceNeed } from './needs.ts';

export type DonationStatus = 'pending_payment' | 'confirmed' | 'refunded';

export type Donation = {
  id: string;
  needId: string;
  donorId: string;
  amountUsd: number;
  status: DonationStatus;
  createdAt: string;
  confirmedAt: string | null;
};

export const MIN_DONATION_USD = 1;

export function createPendingDonation(need: AssistanceNeed, donorId: string, amountUsd: number, id: string, nowIso: string):
  { ok: true; donation: Donation } | { ok: false; reason: 'need_not_published' | 'amount_too_small' | 'exceeds_remaining' | 'self_donation' } {
  if (need.status !== 'published') return { ok: false, reason: 'need_not_published' };
  if (!(amountUsd >= MIN_DONATION_USD)) return { ok: false, reason: 'amount_too_small' };
  if (amountUsd > remainingUsd(need)) return { ok: false, reason: 'exceeds_remaining' };
  if (donorId === need.memberId) return { ok: false, reason: 'self_donation' };
  return { ok: true, donation: { id, needId: need.id, donorId, amountUsd, status: 'pending_payment', createdAt: nowIso, confirmedAt: null } };
}

/** Confirmation comes from a verified payment event only. Applies the amount to the need exactly once. */
export function confirmDonation(donation: Donation, need: AssistanceNeed, nowIso: string): { donation: Donation; need: AssistanceNeed } | null {
  if (donation.status !== 'pending_payment' || donation.needId !== need.id) return null;
  return {
    donation: { ...donation, status: 'confirmed', confirmedAt: nowIso },
    need: { ...need, fundedUsd: need.fundedUsd + donation.amountUsd, status: need.fundedUsd + donation.amountUsd >= need.amountUsd ? 'funded' : need.status },
  };
}
