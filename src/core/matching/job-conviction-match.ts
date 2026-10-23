import type {
  JobConvictionMatchOutcome,
  JobConvictionPolicyV1,
  JusticeMatchEvaluationRecord,
  MemberChargeFact,
  MemberMatchConsent,
} from './justice-match-contract.ts';
import { JUSTICE_MATCH_ENGINE_VERSION } from './justice-match-contract.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function yearsBetween(from: string, toIso: string): number | null {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(toIso)) return null;
  const a = Date.parse(from);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / (365.25 * 86_400_000);
}

function eventDate(ch: MemberChargeFact, anchor: NonNullable<JobConvictionPolicyV1['criteria'][0]['eventAnchor']>): string | null {
  switch (anchor) {
    case 'conviction_date':
      return ch.convictionDate;
    case 'disposition_date':
      return ch.convictionDate;
    case 'sentence_completion_date':
      return ch.sentenceCompletionDate;
    case 'release_date':
      return ch.releaseDate;
    default:
      return null;
  }
}

/**
 * Compares member-confirmed charge facts to a job-specific employer policy.
 * Never auto-rejects hiring; never treats self-report as a background check.
 */
export function evaluateJobConvictionMatch(
  policy: JobConvictionPolicyV1,
  charges: readonly MemberChargeFact[],
  consent: MemberMatchConsent,
  asOfIso: string,
): JusticeMatchEvaluationRecord {
  const missing: string[] = [];
  const matched: string[] = [];
  let requiresReview = false;

  if (policy.publicationStatus !== 'approved') {
    return {
      engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
      outcome: 'insufficient_information',
      reason: 'This job’s conviction consideration policy has not been published yet.',
      matchedCriteriaIds: [],
      missingInformation: ['published_employer_policy'],
      requiresEmployerIndividualReview: false,
      evaluatedAt: asOfIso,
      policyVersionHint: policy.effectiveFrom,
    };
  }

  if (policy.policyType === 'unverified') {
    return {
      engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
      outcome: 'insufficient_information',
      reason: 'FairPath has not verified this employer’s conviction consideration policy.',
      matchedCriteriaIds: [],
      missingInformation: ['verified_employer_policy'],
      requiresEmployerIndividualReview: false,
      evaluatedAt: asOfIso,
      policyVersionHint: policy.effectiveFrom,
    };
  }

  if (policy.policyType === 'affirmative_fair_chance') {
    return {
      engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
      outcome: 'appears_compatible',
      reason: 'This employer uses an affirmative fair-chance policy and reviews qualified applicants individually.',
      matchedCriteriaIds: policy.criteria.map((c) => c.id),
      missingInformation: [],
      requiresEmployerIndividualReview: true,
      evaluatedAt: asOfIso,
      policyVersionHint: policy.effectiveFrom,
    };
  }

  if (!consent.hasJusticeDisclosureConsent || consent.sharedChargeIds.length === 0) {
    return {
      engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
      outcome: 'insufficient_information',
      reason: 'Share the justice-history details you want considered to see how this job’s policy may apply.',
      matchedCriteriaIds: [],
      missingInformation: ['member_justice_disclosure'],
      requiresEmployerIndividualReview: false,
      evaluatedAt: asOfIso,
      policyVersionHint: policy.effectiveFrom,
    };
  }

  const shared = charges.filter((c) => consent.sharedChargeIds.includes(c.chargeId));
  if (!shared.length) {
    missing.push('shared_charge_facts');
  }

  for (const c of policy.criteria) {
    if (c.kind === 'individualized_review') {
      requiresReview = true;
      matched.push(c.id);
      continue;
    }
    if (c.kind === 'affirmative_fair_chance') {
      matched.push(c.id);
      continue;
    }
    if (c.kind === 'pending_charges') {
      const pending = shared.some((ch) => ch.disposition === 'pending');
      if (pending) {
        requiresReview = true;
        matched.push(c.id);
      }
      continue;
    }
    if (c.kind === 'time_since_conviction' || c.kind === 'time_since_sentence_completion') {
      const anchor = c.eventAnchor ?? (c.kind === 'time_since_sentence_completion' ? 'sentence_completion_date' : 'conviction_date');
      const minYears = c.minYearsSinceEvent;
      if (minYears === undefined) {
        missing.push(`criterion_${c.id}_min_years`);
        continue;
      }
      for (const ch of shared) {
        const d = eventDate(ch, anchor);
        if (!d) {
          missing.push(`charge_${ch.chargeId}_${anchor}`);
          continue;
        }
        const yrs = yearsBetween(d, asOfIso.slice(0, 10));
        if (yrs === null) missing.push(`charge_${ch.chargeId}_date_parse`);
        else if (yrs < minYears) requiresReview = true;
      }
      matched.push(c.id);
      continue;
    }
    if (c.kind === 'offense_category_exclusion' && c.offenseCategories?.length) {
      for (const ch of shared) {
        if (!ch.offenseCategory) missing.push(`charge_${ch.chargeId}_offense_category`);
        else if (c.offenseCategories.includes(ch.offenseCategory)) {
          return {
            engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
            outcome: 'confirmed_restriction',
            reason: c.narrative ?? 'This job’s published policy restricts one or more offense categories you shared.',
            matchedCriteriaIds: [...matched, c.id],
            missingInformation: missing,
            requiresEmployerIndividualReview: true,
            evaluatedAt: asOfIso,
            policyVersionHint: policy.effectiveFrom,
          };
        }
      }
      matched.push(c.id);
      continue;
    }
    if (c.kind === 'statute_exclusion' && c.statutes?.length) {
      for (const ch of shared) {
        if (!ch.statuteCode) missing.push(`charge_${ch.chargeId}_statute`);
        else if (c.statutes.some((s) => ch.statuteCode!.toLowerCase().includes(s.toLowerCase()))) {
          return {
            engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
            outcome: 'confirmed_restriction',
            reason: c.narrative ?? 'This job’s published policy restricts a statute you shared.',
            matchedCriteriaIds: [...matched, c.id],
            missingInformation: missing,
            requiresEmployerIndividualReview: true,
            evaluatedAt: asOfIso,
            policyVersionHint: policy.effectiveFrom,
          };
        }
      }
      matched.push(c.id);
      continue;
    }
    if (c.kind === 'licensing_restriction' || c.kind === 'job_duty_restriction') {
      requiresReview = true;
      matched.push(c.id);
    }
  }

  if (missing.length) {
    return {
      engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
      outcome: 'insufficient_information',
      reason: 'Some dates or charge details are missing, so FairPath cannot apply every part of this policy yet.',
      matchedCriteriaIds: matched,
      missingInformation: [...new Set(missing)],
      requiresEmployerIndividualReview: requiresReview,
      evaluatedAt: asOfIso,
      policyVersionHint: policy.effectiveFrom,
    };
  }

  const outcome: JobConvictionMatchOutcome = requiresReview ? 'individual_review_required' : 'appears_compatible';
  return {
    engineVersion: JUSTICE_MATCH_ENGINE_VERSION,
    outcome,
    reason: requiresReview
      ? 'Based on what you shared, this employer’s policy calls for individual review — not an automatic yes or no.'
      : 'Based on what you shared, nothing in this job’s published policy clearly restricts your charges.',
    matchedCriteriaIds: matched,
    missingInformation: [],
    requiresEmployerIndividualReview: requiresReview || policy.policyType === 'individualized_review',
    evaluatedAt: asOfIso,
    policyVersionHint: policy.effectiveFrom,
  };
}

/** Parse jobs.eligibility_rules.justice_policy_v1 from JSONB (Partner draft / pre-migration). */
export function parseJobConvictionPolicyFromEligibilityRules(
  jobId: string,
  organizationId: string,
  rules: Record<string, unknown> | null | undefined,
): JobConvictionPolicyV1 | null {
  const raw = rules?.justice_policy_v1;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (p.schemaVersion !== 1) return null;
  return {
    schemaVersion: 1,
    jobId,
    organizationId,
    effectiveFrom: typeof p.effectiveFrom === 'string' ? p.effectiveFrom : new Date().toISOString().slice(0, 10),
    policyType: (p.policyType as JobConvictionPolicyV1['policyType']) ?? 'criteria_based',
    criteria: Array.isArray(p.criteria) ? (p.criteria as JobConvictionPolicyV1['criteria']) : [],
    jobDutiesSummary: typeof p.jobDutiesSummary === 'string' ? p.jobDutiesSummary : undefined,
    licensingNotes: typeof p.licensingNotes === 'string' ? p.licensingNotes : undefined,
    lastReviewedAt: typeof p.lastReviewedAt === 'string' ? p.lastReviewedAt : null,
    publicationStatus: (p.publicationStatus as JobConvictionPolicyV1['publicationStatus']) ?? 'draft',
  };
}
