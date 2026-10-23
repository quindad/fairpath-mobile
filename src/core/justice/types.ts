/** Unified justice read model (application layer until justice_cases migration applies). */

export type JusticeVerificationState =
  | 'self_reported'
  | 'user_confirmed'
  | 'needs_review'
  | 'document_verified'
  | 'official_record_verified';

export type JusticeChargeDisposition =
  | 'conviction'
  | 'dismissal'
  | 'acquittal'
  | 'deferred_adjudication'
  | 'nolle_prosequi'
  | 'arrest_no_charge'
  | 'pending'
  | 'unknown';

export type JusticeChargeDegree = 'infraction' | 'minor_misdemeanor' | 'misdemeanor' | 'felony' | 'unknown';

export type JusticeRecordSource = 'conviction' | 'record_relief' | 'unified';

export type UnifiedJusticeCharge = {
  id: string;
  source: JusticeRecordSource;
  countNumber: number | null;
  offenseName: string;
  statuteCode: string | null;
  degree: JusticeChargeDegree;
  degreeLevel: number | null;
  disposition: JusticeChargeDisposition;
  convictionDate: string | null;
  dispositionDate: string | null;
  sentenceCompletionDate: string | null;
  supervisionCompletionDate: string | null;
  releaseDate: string | null;
  finesPaid: boolean | null;
  restitutionPaid: boolean | null;
  verificationState: JusticeVerificationState;
  offenseCategory: string | null;
  linkedConvictionId: string | null;
  linkedRecordReliefCaseId: string | null;
};

export type UnifiedJusticeCase = {
  id: string;
  docketLabel: string;
  jurisdictionCode: string | null;
  stateCode: string | null;
  county: string | null;
  courtName: string | null;
  caseNumber: string | null;
  caseStatus: 'open' | 'closed' | 'pending_appeal' | 'consolidated' | 'unknown';
  verificationState: JusticeVerificationState;
  sources: JusticeRecordSource[];
  charges: UnifiedJusticeCharge[];
  memberNotes: string | null;
  updatedAt: string | null;
};

export type ChargeReliefPreview = {
  chargeId: string;
  outcome: string;
  eligibilityDate: string | null;
  daysRemaining: number | null;
  reasons: { code: string; text: string }[];
  missingFacts: string[];
  ruleKey: string | null;
  evaluatedAt: string | null;
};
