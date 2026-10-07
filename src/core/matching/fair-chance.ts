// Fair-chance matching: explains a possible fit using only what the employer has documented and what the member has
// chosen to disclose. There is no automatic rejection and no approval guarantee. Every outcome is advisory.

export type PolicyType =
  | 'affirmative_fair_chance' // actively recruits regardless of record
  | 'individualized_review' // case-by-case employer review, no blanket rule
  | 'specific_restriction' // named offense categories excluded, employer policy
  | 'legal_or_licensing_restriction' // excluded by law or a license requirement, not employer preference
  | 'unverified'; // FairPath has not confirmed this employer's policy

export type EmployerPolicy = {
  employerId: string;
  policyType: PolicyType;
  restrictedOffenseCategories: readonly string[];
  restrictionBasis: string | null; // required narrative for legal/specific restrictions
  lastReviewedAt: string | null;
};

export const STALE_AFTER_DAYS = 180;

export function policyIsStale(policy: EmployerPolicy, nowIso: string): boolean {
  if (!policy.lastReviewedAt) return true;
  const days = (Date.parse(nowIso) - Date.parse(policy.lastReviewedAt)) / 86_400_000;
  return days > STALE_AFTER_DAYS;
}

export type MemberDisclosure = { hasDisclosed: boolean; offenseCategories: readonly string[] };

export type MatchOutcome = 'potential_match' | 'individual_review' | 'possible_restriction' | 'insufficient_information';

export type MatchExplanation = { outcome: MatchOutcome; reason: string };

/**
 * Never guesses at undisclosed information, never denies automatically, and never guarantees a hiring decision.
 * The employer makes every hiring decision.
 */
export function explainMatch(policy: EmployerPolicy, disclosure: MemberDisclosure): MatchExplanation {
  switch (policy.policyType) {
    case 'unverified':
      return { outcome: 'insufficient_information', reason: 'This employer’s hiring policy has not been verified yet.' };
    case 'affirmative_fair_chance':
      return { outcome: 'potential_match', reason: 'This employer has an affirmative fair-chance policy and reviews all qualified applicants.' };
    case 'individualized_review':
      return { outcome: 'individual_review', reason: 'This employer reviews applications case by case rather than using a blanket rule.' };
    case 'specific_restriction':
    case 'legal_or_licensing_restriction': {
      const basis = policy.policyType === 'legal_or_licensing_restriction' ? 'a legal or licensing requirement' : 'this employer’s stated policy';
      if (!disclosure.hasDisclosed) {
        return { outcome: 'insufficient_information', reason: `This employer restricts some offense categories under ${basis}. Share your case details to see whether this applies to you.` };
      }
      const overlaps = disclosure.offenseCategories.some((c) => policy.restrictedOffenseCategories.includes(c));
      return overlaps
        ? { outcome: 'possible_restriction', reason: `This employer’s policy under ${basis} may restrict one or more categories you shared. The employer makes the final decision.` }
        : { outcome: 'potential_match', reason: `Nothing you shared falls under this employer’s restricted categories (${basis}). The employer still makes the final decision.` };
    }
  }
}

/** FairPath never takes an automatic action from an outcome. This exists only to make that explicit and testable. */
export const AUTO_REJECT_OUTCOMES: readonly MatchOutcome[] = [];
