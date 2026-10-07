// Giving: assistance needs. Members request privately. Only needs verified by FairPath or an authorized partner may be
// published as sponsorable. Each state transition is explicit; a need can never skip verification.

export type NeedCategory = 'meal' | 'transportation' | 'housing_support' | 'work_essentials' | 'other_verified';

export type NeedStatus = 'requested' | 'verified' | 'published' | 'funded' | 'fulfilled' | 'closed' | 'rejected';

export type AssistanceNeed = {
  id: string;
  memberId: string; // private; never exposed publicly
  category: NeedCategory;
  amountUsd: number; // target cost, from the verified provider quote
  fundedUsd: number;
  status: NeedStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  fulfilledAt: string | null;
  /** Free-text circumstances stay private. Only the category and amount are ever public. */
  privateCircumstances: string;
};

const ALLOWED: Record<NeedStatus, NeedStatus[]> = {
  requested: ['verified', 'rejected'],
  verified: ['published', 'rejected'],
  published: ['funded', 'closed'],
  funded: ['fulfilled'],
  fulfilled: ['closed'],
  closed: [],
  rejected: [],
};

export function canTransition(from: NeedStatus, to: NeedStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function verify(need: AssistanceNeed, verifierId: string, nowIso: string): AssistanceNeed | null {
  if (!verifierId.trim() || !canTransition(need.status, 'verified')) return null;
  return { ...need, status: 'verified', verifiedBy: verifierId, verifiedAt: nowIso };
}

/** Only verified needs may be published for sponsorship. */
export function publish(need: AssistanceNeed): AssistanceNeed | null {
  if (need.status !== 'verified' || !need.verifiedBy || !need.verifiedAt) return null;
  return { ...need, status: 'published' };
}

export function remainingUsd(need: AssistanceNeed): number {
  return Math.max(0, need.amountUsd - need.fundedUsd);
}

export function markFulfilled(need: AssistanceNeed, nowIso: string): AssistanceNeed | null {
  if (!canTransition(need.status, 'fulfilled') || remainingUsd(need) > 0) return null;
  return { ...need, status: 'fulfilled', fulfilledAt: nowIso };
}
