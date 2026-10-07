import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchProfileFromVeteranPrep, VETERAN_IDENTITY_FIELDS, type VeteranPreparationInput } from '../src/core/staffing/veteran-skills.ts';
import { assessReadiness, skillsFromReentryPrep, containsForbiddenReentryLabel, type ReentryPreparationInput } from '../src/core/staffing/reentry-prep.ts';
import { explainStaffingMatch, type AssignmentRequirements, type MemberProfile } from '../src/core/staffing/matching.ts';
import { buildCandidateSubmission, type FullMemberProfile } from '../src/core/staffing/candidate-submission.ts';
import type { ReviewedTranslation } from '../src/core/veterans/translation.ts';

const BASE: Omit<MemberProfile, 'skills'> = { preferredLocations: ['Columbus, OH'], availabilityText: 'Mon-Fri 8am-4pm', experienceYears: 1, credentials: [] };

const VET_INPUT: VeteranPreparationInput = {
  branch: 'army', occupationCode: '11B', clearanceStatus: 'Secret', leadershipExperienceText: 'Led a 4-person team',
  logisticsExperienceText: '', technicalExperienceText: '', transitionGoalsText: 'Warehouse supervision',
  credentials: ['OSHA-10'], civilianResumeText: 'Resume text',
};

const REVIEWED: ReviewedTranslation[] = [{ branch: 'army', code: '11B', civilianRoles: ['Logistics Coordinator', 'Team Lead'], reviewedBy: 'SME', reviewedOn: '2026-01-01' }];

test('a reviewed translation adds civilian skills to the match profile', () => {
  const profile = buildMatchProfileFromVeteranPrep(VET_INPUT, REVIEWED, BASE);
  assert.ok(profile.skills.includes('Logistics Coordinator'));
  assert.ok(profile.skills.includes('OSHA-10'));
});

test('an unreviewed occupation code contributes no guessed skill', () => {
  const unreviewed = buildMatchProfileFromVeteranPrep({ ...VET_INPUT, occupationCode: '99Z' }, REVIEWED, BASE);
  assert.equal(unreviewed.skills.includes('Logistics Coordinator'), false);
});

test('no identity field (branch, occupation code, clearance) appears anywhere in the match profile output', () => {
  const profile = buildMatchProfileFromVeteranPrep(VET_INPUT, REVIEWED, BASE);
  const json = JSON.stringify(profile);
  assert.equal(json.includes('army'), false);
  assert.equal(json.includes('11B'), false);
  assert.equal(json.includes('Secret'), false);
  for (const f of VETERAN_IDENTITY_FIELDS) assert.equal(f in (profile as unknown as Record<string, unknown>), false, f);
});

test('veteran identity itself cannot change the fair-chance outcome: same policy and disclosure, skills differ, outcome is identical', () => {
  const req: AssignmentRequirements = { location: 'Columbus, OH', scheduleText: 'Mon-Fri 8am-4pm', requiredSkills: [], minExperienceYears: null, requiredCredentials: [] };
  const policy = { employerId: 'e1', policyType: 'unverified' as const, restrictedOffenseCategories: [], restrictionBasis: null, lastReviewedAt: null };
  const disclosure = { hasDisclosed: false, offenseCategories: [] };
  const withVeteranSkills = explainStaffingMatch(policy, disclosure, req, buildMatchProfileFromVeteranPrep(VET_INPUT, REVIEWED, BASE));
  const withoutVeteranSkills = explainStaffingMatch(policy, disclosure, req, { ...BASE, skills: [] });
  assert.equal(withVeteranSkills.outcome, withoutVeteranSkills.outcome); // identity never changes the outcome, only disclosed facts do
});

test('employer-facing candidate submission never receives veteran status unless the member explicitly shared it', () => {
  const profile: FullMemberProfile = {
    memberId: 'm1', displayName: 'Pat', relevantExperience: 'x', skills: ['Logistics Coordinator'], credentials: ['OSHA-10'],
    resumeText: 'x', availabilityText: 'x', locationPreference: 'x', preparationStatus: 'ready',
    reentryPathwayActive: false, convictionDetails: null, veteranStatus: true, veteranStatusSharedByMember: false,
    disabilityInfo: null, recoveryInfo: null, housingSituation: null, caseManagementNotes: null, creditInformation: null,
    unrelatedDocumentRefs: [], privateAiConversationRefs: [],
  };
  const sub = buildCandidateSubmission(profile);
  assert.equal(sub.veteranStatus, null);
});

// ---- Reentry preparation: readiness without a staffing score tied to pathway or record ----

const REENTRY_INPUT: ReentryPreparationInput = {
  workReadinessNotes: 'Ready', idDocumentReadiness: 'ready', transportationPlanText: 'Bus route 12',
  scheduleConstraintsText: 'No evenings', credentials: ['Forklift certified'], resumeText: 'Resume text',
};

test('readiness reflects only preparation facts, and open items are honest', () => {
  const ready = assessReadiness(REENTRY_INPUT);
  assert.equal(ready.readyForAssignment, true);
  const notReady = assessReadiness({ ...REENTRY_INPUT, idDocumentReadiness: 'not_started', transportationPlanText: '' });
  assert.equal(notReady.readyForAssignment, false);
  assert.deepEqual(notReady.openItems, ['ID and documents', 'Transportation plan']);
});

test('skills from reentry prep are credentials only, never pathway or record data', () => {
  const skills = skillsFromReentryPrep(REENTRY_INPUT);
  assert.deepEqual(skills, ['Forklift certified']);
});

test('a candidate submission built from reentry-prep skills carries no reentry or conviction trace', () => {
  const profile: FullMemberProfile = {
    memberId: 'm1', displayName: 'Pat', relevantExperience: 'Warehouse work', skills: skillsFromReentryPrep(REENTRY_INPUT),
    credentials: REENTRY_INPUT.credentials, resumeText: REENTRY_INPUT.resumeText, availabilityText: 'Mon-Fri', locationPreference: 'Columbus, OH',
    preparationStatus: 'ready', reentryPathwayActive: true, convictionDetails: 'Felony theft, 2019', veteranStatus: false,
    veteranStatusSharedByMember: false, disabilityInfo: null, recoveryInfo: null, housingSituation: null, caseManagementNotes: null,
    creditInformation: null, unrelatedDocumentRefs: [], privateAiConversationRefs: [],
  };
  const sub = buildCandidateSubmission(profile);
  const json = JSON.stringify(sub);
  assert.equal(json.includes('Felony'), false);
  assert.equal(json.includes('reentry'), false);
});

test('forbidden reentry labels are detected in any text destined for an employer', () => {
  assert.equal(containsForbiddenReentryLabel('Great reentry candidate for this role'), true);
  assert.equal(containsForbiddenReentryLabel('Formerly incarcerated, strong worker'), true);
  assert.equal(containsForbiddenReentryLabel('Two years of warehouse experience'), false);
});
