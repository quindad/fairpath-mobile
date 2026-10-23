/**
 * Cross-app contract: Mobile, Partner, Admin.
 * Keep identical copies in:
 *   - fairpath-mobile/src/core/matching/justice-match-contract.ts
 *   - quindad-fairpath-partner/src/lib/justice-match-contract.ts
 *   - fairpath-admin/src/lib/justice-match-contract.ts
 */

export const JUSTICE_MATCH_ENGINE_VERSION = 'justice-match-v1';

export type JobConvictionMatchOutcome =
  | 'appears_compatible'
  | 'individual_review_required'
  | 'confirmed_restriction'
  | 'insufficient_information';

export type JobConvictionPolicyCriterion = {
  id: string;
  kind:
    | 'affirmative_fair_chance'
    | 'individualized_review'
    | 'offense_category_exclusion'
    | 'statute_exclusion'
    | 'jurisdiction_exclusion'
    | 'time_since_conviction'
    | 'time_since_sentence_completion'
    | 'pending_charges'
    | 'licensing_restriction'
    | 'job_duty_restriction'
    | 'policy_exception';
  jurisdictions?: string[];
  statutes?: string[];
  offenseCategories?: string[];
  felonyMisdemeanor?: ('felony' | 'misdemeanor' | 'infraction')[];
  minYearsSinceEvent?: number;
  eventAnchor?: 'conviction_date' | 'disposition_date' | 'sentence_completion_date' | 'release_date';
  requiresIndividualReview?: boolean;
  narrative?: string;
};

export type JobConvictionPolicyV1 = {
  schemaVersion: 1;
  jobId: string;
  organizationId: string;
  effectiveFrom: string;
  policyType: 'affirmative_fair_chance' | 'individualized_review' | 'criteria_based' | 'unverified';
  criteria: JobConvictionPolicyCriterion[];
  jobDutiesSummary?: string;
  licensingNotes?: string;
  lastReviewedAt: string | null;
  publicationStatus: 'draft' | 'submitted' | 'approved' | 'rejected' | 'retired';
};

export type MemberChargeFact = {
  chargeId: string;
  jurisdictionCode: string | null;
  statuteCode: string | null;
  offenseCategory: string | null;
  degree: 'felony' | 'misdemeanor' | 'infraction' | 'unknown';
  disposition: 'conviction' | 'dismissal' | 'acquittal' | 'deferred_adjudication' | 'pending' | 'unknown';
  convictionDate: string | null;
  sentenceCompletionDate: string | null;
  releaseDate: string | null;
  verificationState: 'self_reported' | 'user_confirmed' | 'needs_review' | 'document_verified' | 'official_record_verified';
};

export type MemberMatchConsent = {
  hasJusticeDisclosureConsent: boolean;
  sharedChargeIds: readonly string[];
};

export type JusticeMatchEvaluationRecord = {
  engineVersion: typeof JUSTICE_MATCH_ENGINE_VERSION;
  outcome: JobConvictionMatchOutcome;
  reason: string;
  matchedCriteriaIds: string[];
  missingInformation: string[];
  requiresEmployerIndividualReview: boolean;
  evaluatedAt: string;
  policyVersionHint: string | null;
};

