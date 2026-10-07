// Frozen V1 membership and AI credit rate card. Source: FAIRPATH-V1-MEMBERSHIP-PRICING-FROZEN.md (membership-v1.0),
// public-site commit c4c9e2c. Changing any value here requires founder approval and a new spec version.
// Approved pricing is NOT evidence that billing, credits or AI features are operational. Nothing here charges anyone.

export const FROZEN_SPEC_VERSION = 'membership-v1.0' as const;

export type TierId = 'free' | 'plus' | 'premium';

export const TIERS: Record<TierId, { label: string; monthlyUsd: number; monthlyCredits: number; marketplaceClaimsPerMonth: number; fastTrackDiscountUsd: number }> = {
  free: { label: 'FairPath (Free)', monthlyUsd: 0, monthlyCredits: 5, marketplaceClaimsPerMonth: 1, fastTrackDiscountUsd: 0 },
  plus: { label: 'FairPath+', monthlyUsd: 2, monthlyCredits: 30, marketplaceClaimsPerMonth: 7, fastTrackDiscountUsd: 10 },
  premium: { label: 'FairPath+ Premium', monthlyUsd: 4.99, monthlyCredits: 100, marketplaceClaimsPerMonth: 7, fastTrackDiscountUsd: 10 },
};

export type AiAction =
  | 'resume_create_or_rewrite'
  | 'job_fit_explanation'
  | 'resource_concierge'
  | 'personal_plan'
  | 'record_relief_explanation'
  | 'dispute_letter_draft'
  | 'full_credit_report_analysis';

export const AI_ACTION_CREDITS: Record<AiAction, number> = {
  resume_create_or_rewrite: 2,
  job_fit_explanation: 1,
  resource_concierge: 1,
  personal_plan: 2,
  record_relief_explanation: 2,
  dispute_letter_draft: 2,
  full_credit_report_analysis: 10,
};

/** Actions the spec gates to Premium. Included credits alone do not unlock them. */
export const PREMIUM_GATED_ACTIONS: readonly AiAction[] = ['full_credit_report_analysis', 'dispute_letter_draft'];

export const REFILL_PACKS = [
  { sku: 'quick', credits: 15, priceUsd: 0.99 },
  { sku: 'everyday', credits: 40, priceUsd: 1.99 },
  { sku: 'big', credits: 100, priceUsd: 3.99 },
] as const;

export const PURCHASED_CREDIT_EXPIRY_MONTHS = 12;

/** Free (no credit cost) access that the spec guarantees. */
export const ALWAYS_FREE = [
  'jobs_browse_and_apply',
  'housing_search',
  'emergency_and_community_resources',
  'record_relief_educational_info',
  'basic_resume_templates',
] as const;

/** Whether a tier may use an AI action given its included balance check result. */
export function tierMayUse(tier: TierId, action: AiAction): boolean {
  if (PREMIUM_GATED_ACTIONS.includes(action)) return tier === 'premium';
  return true;
}
