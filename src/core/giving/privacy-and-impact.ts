// Giving privacy view and impact evidence. Donors and the public see only an allowlist of need fields, never the
// recipient's identity or circumstances. Impact counts only fulfilled needs with a verifier; member-reported items stay separate.

import type { AssistanceNeed, NeedCategory } from './needs.ts';

export type PublicNeed = { id: string; category: NeedCategory; amountUsd: number; fundedUsd: number; status: 'published' | 'funded' };

/** Allowlist projection. Adding a field to AssistanceNeed never leaks it publicly unless it is added here. */
export function publicNeedView(need: AssistanceNeed): PublicNeed | null {
  if (need.status !== 'published' && need.status !== 'funded') return null;
  return { id: need.id, category: need.category, amountUsd: need.amountUsd, fundedUsd: need.fundedUsd, status: need.status };
}

export type ImpactSummary = {
  verifiedFulfilledNeeds: number;
  verifiedFundedUsd: number;
  memberReportedNeeds: number; // reported by the member, not independently verified; never merged into verified counts
};

export function impactSummary(needs: readonly AssistanceNeed[], memberReported: readonly { id: string }[]): ImpactSummary {
  const verified = needs.filter((n) => n.status === 'fulfilled' || n.status === 'closed').filter((n) => n.verifiedBy !== null && n.fulfilledAt !== null);
  return {
    verifiedFulfilledNeeds: verified.length,
    verifiedFundedUsd: verified.reduce((s, n) => s + n.fundedUsd, 0),
    memberReportedNeeds: memberReported.length,
  };
}
