import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';
import type { Job } from '@/core/jobs/jobs-service';
import { loadMyConvictions } from '@/core/profile/conviction-service';
import { loadCases } from '@/core/record-relief/relief-service';
import { assembleUnifiedJusticeCases } from '@/core/justice/unified-assembly.ts';
import type { MemberChargeFact, MemberMatchConsent, JusticeMatchEvaluationRecord } from './justice-match-contract.ts';
import { evaluateJobConvictionMatch, parseJobConvictionPolicyFromEligibilityRules } from './job-conviction-match.ts';

export type JobJusticeCompatibility = {
  evaluation: JusticeMatchEvaluationRecord;
  policyPublished: boolean;
  disclosureReady: boolean;
};

function chargeFactsFromUnified(): Promise<MemberChargeFact[]> {
  return Promise.all([loadMyConvictions(), loadCases()]).then(([convictions, relief]) => {
    const cases = assembleUnifiedJusticeCases(convictions, relief);
    const facts: MemberChargeFact[] = [];
    for (const c of cases) {
      for (const ch of c.charges) {
        const degree =
          ch.degree === 'felony' || ch.degree === 'misdemeanor' || ch.degree === 'infraction' ? ch.degree : 'unknown';
        facts.push({
          chargeId: ch.id,
          jurisdictionCode: c.jurisdictionCode,
          statuteCode: ch.statuteCode,
          offenseCategory: ch.offenseCategory,
          degree,
          disposition:
            ch.disposition === 'conviction' ||
            ch.disposition === 'dismissal' ||
            ch.disposition === 'acquittal' ||
            ch.disposition === 'deferred_adjudication' ||
            ch.disposition === 'pending'
              ? ch.disposition
              : 'unknown',
          convictionDate: ch.convictionDate,
          sentenceCompletionDate: ch.sentenceCompletionDate,
          releaseDate: ch.releaseDate,
          verificationState:
            ch.verificationState === 'document_verified' || ch.verificationState === 'official_record_verified'
              ? ch.verificationState
              : ch.verificationState === 'user_confirmed'
                ? 'user_confirmed'
                : ch.verificationState === 'needs_review'
                  ? 'needs_review'
                  : 'self_reported',
        });
      }
    }
    return facts;
  });
}

async function loadJusticeDisclosureConsent(): Promise<MemberMatchConsent> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('consent_events')
    .select('id, granted, revoked_at')
    .eq('user_id', user.id)
    .eq('event_type', 'justice_history_disclosure_consent')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  const hasJusticeDisclosureConsent = Boolean(row?.granted && !row?.revoked_at);
  const charges = await chargeFactsFromUnified();
  return {
    hasJusticeDisclosureConsent,
    sharedChargeIds: hasJusticeDisclosureConsent ? charges.map((c) => c.chargeId) : [],
  };
}

/** Explainable job compatibility using approved policy + member-confirmed facts only. */
export async function evaluateJobJusticeCompatibility(job: Job): Promise<JobJusticeCompatibility | null> {
  const orgId = typeof job.eligibility_rules?.organization_id === 'string' ? job.eligibility_rules.organization_id : '';
  const policy =
    parseJobConvictionPolicyFromEligibilityRules(job.id, orgId, job.eligibility_rules) ??
    parseJobConvictionPolicyFromEligibilityRules(job.id, 'unknown', job.eligibility_rules);
  if (!policy) return null;
  const [charges, consent] = await Promise.all([chargeFactsFromUnified(), loadJusticeDisclosureConsent()]);
  const evaluation = evaluateJobConvictionMatch(policy, charges, consent, new Date().toISOString());
  return {
    evaluation,
    policyPublished: policy.publicationStatus === 'approved',
    disclosureReady: consent.hasJusticeDisclosureConsent && consent.sharedChargeIds.length > 0,
  };
}
