import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateJobConvictionMatch } from '../src/core/matching/job-conviction-match.ts';
import type { JobConvictionPolicyV1, MemberChargeFact } from '../src/core/matching/justice-match-contract.ts';

const policy = (over: Partial<JobConvictionPolicyV1>): JobConvictionPolicyV1 => ({
  schemaVersion: 1,
  jobId: 'job-1',
  organizationId: 'org-1',
  effectiveFrom: '2026-01-01',
  policyType: 'criteria_based',
  criteria: [],
  lastReviewedAt: '2026-01-01',
  publicationStatus: 'approved',
  ...over,
});

const charge = (over: Partial<MemberChargeFact>): MemberChargeFact => ({
  chargeId: 'ch-1',
  jurisdictionCode: 'US-OH',
  statuteCode: '2903.11',
  offenseCategory: 'violence',
  degree: 'felony',
  disposition: 'conviction',
  convictionDate: '2020-01-01',
  sentenceCompletionDate: '2022-01-01',
  releaseDate: '2022-06-01',
  verificationState: 'user_confirmed',
  ...over,
});

test('without disclosure consent, outcome is insufficient_information', () => {
  const r = evaluateJobConvictionMatch(
    policy({ policyType: 'individualized_review' }),
    [charge({})],
    { hasJusticeDisclosureConsent: false, sharedChargeIds: [] },
    '2026-10-01T12:00:00.000Z',
  );
  assert.equal(r.outcome, 'insufficient_information');
});

test('category exclusion yields confirmed_restriction when member shared matching category', () => {
  const r = evaluateJobConvictionMatch(
    policy({
      criteria: [{ id: 'ex-v', kind: 'offense_category_exclusion', offenseCategories: ['violence'], narrative: 'Role restriction' }],
    }),
    [charge({ offenseCategory: 'violence' })],
    { hasJusticeDisclosureConsent: true, sharedChargeIds: ['ch-1'] },
    '2026-10-01T12:00:00.000Z',
  );
  assert.equal(r.outcome, 'confirmed_restriction');
});

test('missing sentence date blocks countdown-style time rules', () => {
  const r = evaluateJobConvictionMatch(
    policy({
      criteria: [{ id: 'wait', kind: 'time_since_sentence_completion', minYearsSinceEvent: 5, eventAnchor: 'sentence_completion_date' }],
    }),
    [charge({ sentenceCompletionDate: null })],
    { hasJusticeDisclosureConsent: true, sharedChargeIds: ['ch-1'] },
    '2026-10-01T12:00:00.000Z',
  );
  assert.equal(r.outcome, 'insufficient_information');
  assert.ok(r.missingInformation.some((m) => m.includes('sentence_completion')));
});
