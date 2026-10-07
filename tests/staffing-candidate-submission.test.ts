import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateSubmission, FORBIDDEN_SUBMISSION_FIELDS, type FullMemberProfile } from '../src/core/staffing/candidate-submission.ts';

const FULL: FullMemberProfile = {
  memberId: 'm1', displayName: 'Pat Doe', relevantExperience: 'Two years warehouse work', skills: ['forklift'],
  credentials: ['OSHA-10'], resumeText: 'Resume text here', availabilityText: 'Mon-Fri days', locationPreference: 'Columbus, OH',
  preparationStatus: 'ready',
  reentryPathwayActive: true,
  convictionDetails: 'Felony theft, 2019, Ohio',
  veteranStatus: true,
  veteranStatusSharedByMember: false,
  disabilityInfo: 'Uses a hearing aid',
  recoveryInfo: 'In recovery, 3 years sober',
  housingSituation: 'Currently in transitional housing',
  caseManagementNotes: 'Case manager: see file #4471',
  creditInformation: { score: 580, collections: 3 },
  unrelatedDocumentRefs: ['doc-ref-99'],
  privateAiConversationRefs: ['chat-ref-12'],
};

test('a normal submission includes only the allowlisted fields', () => {
  const sub = buildCandidateSubmission(FULL);
  assert.deepEqual(Object.keys(sub).sort(), [
    'availabilityText', 'credentials', 'displayName', 'locationPreference', 'memberId',
    'preparationStatus', 'relevantExperience', 'resumeText', 'skills', 'veteranStatus',
  ]);
});

test('reentry pathway membership never reaches the submission', () => {
  const sub = buildCandidateSubmission(FULL);
  assert.equal('reentryPathwayActive' in sub, false);
  assert.equal(JSON.stringify(sub).includes('reentry'), false);
});

test('conviction details never reach the submission, even as free text', () => {
  const sub = buildCandidateSubmission(FULL);
  assert.equal(JSON.stringify(sub).includes('Felony'), false);
  assert.equal(JSON.stringify(sub).includes('theft'), false);
});

test('veteran status is withheld unless the member explicitly shared it', () => {
  const sub = buildCandidateSubmission(FULL);
  assert.equal(sub.veteranStatus, null);
  const shared = buildCandidateSubmission({ ...FULL, veteranStatusSharedByMember: true });
  assert.equal(shared.veteranStatus, true);
});

test('veteran status is false, not omitted, when the member shared it and is not actually a veteran', () => {
  const sub = buildCandidateSubmission({ ...FULL, veteranStatus: false, veteranStatusSharedByMember: true });
  assert.equal(sub.veteranStatus, false);
});

test('disability, recovery, housing and case-management data never reach the submission', () => {
  const sub = buildCandidateSubmission(FULL);
  const json = JSON.stringify(sub);
  assert.equal(json.includes('hearing aid'), false);
  assert.equal(json.includes('sober'), false);
  assert.equal(json.includes('transitional housing'), false);
  assert.equal(json.includes('4471'), false);
});

test('credit information, unrelated documents and private AI conversation refs never reach the submission', () => {
  const sub = buildCandidateSubmission(FULL);
  const json = JSON.stringify(sub);
  assert.equal(json.includes('580'), false);
  assert.equal(json.includes('doc-ref-99'), false);
  assert.equal(json.includes('chat-ref-12'), false);
});

test('every field in FORBIDDEN_SUBMISSION_FIELDS is individually absent from the output object', () => {
  const sub = buildCandidateSubmission(FULL) as unknown as Record<string, unknown>;
  for (const field of FORBIDDEN_SUBMISSION_FIELDS) assert.equal(field in sub, false, field);
});

test('an attacker-controlled profile with extra sensitive keys still produces only the allowlist', () => {
  const malicious = { ...FULL, ssn: '123-45-6789', bankAccount: 'acct-999', __proto__: { injected: true } } as FullMemberProfile;
  const sub = buildCandidateSubmission(malicious) as unknown as Record<string, unknown>;
  assert.equal('ssn' in sub, false);
  assert.equal('bankAccount' in sub, false);
  assert.equal('injected' in sub, false);
});

test('a submission built from a minimal, non-sensitive profile is unaffected', () => {
  const clean: FullMemberProfile = { ...FULL, reentryPathwayActive: false, convictionDetails: null, disabilityInfo: null, recoveryInfo: null, housingSituation: null, caseManagementNotes: null, creditInformation: null, unrelatedDocumentRefs: [], privateAiConversationRefs: [] };
  const sub = buildCandidateSubmission(clean);
  assert.equal(sub.displayName, 'Pat Doe');
});
