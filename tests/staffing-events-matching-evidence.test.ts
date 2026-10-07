import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingestFoxHireEvent, newLedger, type ProviderEventEnvelope } from '../src/core/staffing/provider-events.ts';
import type { FoxHireState } from '../src/core/staffing/foxhire-adapter.ts';
import { explainStaffingMatch, BANNED_DECISION_PHRASES, type AssignmentRequirements, type MemberProfile } from '../src/core/staffing/matching.ts';
import { evidenceForStage, evidenceCount, NON_EVIDENCE_STAGES } from '../src/core/staffing/evidence.ts';

// ---- Provider event ingestion: idempotent, replay-safe, invalid transitions rejected ----

const ev = (over: Partial<ProviderEventEnvelope<FoxHireState>>): ProviderEventEnvelope<FoxHireState> => ({
  eventId: 'evt-1', assignmentId: 'a1', toState: 'onboarding_requested', occurredAt: '2026-10-07T10:00:00Z', receivedAt: '2026-10-07T10:00:01Z', ...over,
});

test('a valid event applies and advances state', () => {
  const ledger = newLedger<FoxHireState>('candidate_submitted');
  const r = ingestFoxHireEvent(ledger, ev({}));
  assert.deepEqual(r, { outcome: 'applied', state: 'onboarding_requested' });
});

test('replaying the exact same event id is a no-op, not an error (webhook redelivery safety)', () => {
  const ledger = newLedger<FoxHireState>('candidate_submitted');
  ingestFoxHireEvent(ledger, ev({}));
  const replay = ingestFoxHireEvent(ledger, ev({}));
  assert.deepEqual(replay, { outcome: 'already_applied', state: 'onboarding_requested' });
});

test('an invalid transition is rejected without mutating the ledger', () => {
  const ledger = newLedger<FoxHireState>('candidate_submitted');
  const r = ingestFoxHireEvent(ledger, ev({ eventId: 'evt-bad', toState: 'payroll_active' }));
  assert.deepEqual(r, { outcome: 'rejected_invalid_transition', currentState: 'candidate_submitted' });
  assert.equal(ledger.currentState, 'candidate_submitted');
});

test('an out-of-order event (older occurredAt than the last applied) is rejected', () => {
  const ledger = newLedger<FoxHireState>('candidate_submitted');
  ingestFoxHireEvent(ledger, ev({ eventId: 'evt-1', occurredAt: '2026-10-07T10:00:00Z' }));
  const stale = ingestFoxHireEvent(ledger, ev({ eventId: 'evt-2', toState: 'onboarding_pending', occurredAt: '2026-10-07T09:00:00Z' }));
  assert.deepEqual(stale, { outcome: 'rejected_out_of_order' });
});

test('two different event ids for the same legal transition both apply in order', () => {
  const ledger = newLedger<FoxHireState>('candidate_submitted');
  ingestFoxHireEvent(ledger, ev({ eventId: 'evt-1', toState: 'onboarding_requested', occurredAt: '2026-10-07T10:00:00Z' }));
  const second = ingestFoxHireEvent(ledger, ev({ eventId: 'evt-2', toState: 'onboarding_pending', occurredAt: '2026-10-07T11:00:00Z' }));
  assert.deepEqual(second, { outcome: 'applied', state: 'onboarding_pending' });
  assert.equal(ledger.appliedEventIds.size, 2);
});

// ---- Staffing matching: disclosure rules inherited, explainable factors, no decision phrasing ----

const REQ: AssignmentRequirements = { location: 'Columbus, OH', scheduleText: 'Mon-Fri 8am-4pm', requiredSkills: ['forklift'], minExperienceYears: 1, requiredCredentials: [] };
const PROFILE: MemberProfile = { preferredLocations: ['Columbus, OH'], availabilityText: 'Mon-Fri 8am-4pm', skills: ['forklift'], experienceYears: 2, credentials: [] };

test('staffing match reuses the fair-chance outcome unchanged', () => {
  const r = explainStaffingMatch(
    { employerId: 'e1', policyType: 'affirmative_fair_chance', restrictedOffenseCategories: [], restrictionBasis: null, lastReviewedAt: '2026-01-01T00:00:00Z' },
    { hasDisclosed: false, offenseCategories: [] },
    REQ, PROFILE,
  );
  assert.equal(r.outcome, 'potential_match');
});

test('staffing factors are explainable and reflect what was actually disclosed', () => {
  const r = explainStaffingMatch(
    { employerId: 'e1', policyType: 'unverified', restrictedOffenseCategories: [], restrictionBasis: null, lastReviewedAt: null },
    { hasDisclosed: false, offenseCategories: [] },
    REQ, PROFILE,
  );
  assert.ok(r.factors.every((f) => f.met));
  assert.ok(r.factors.some((f) => f.kind === 'location'));
  assert.ok(r.factors.some((f) => f.kind === 'skill'));
});

test('an unmet requirement is reflected honestly, not hidden', () => {
  const underqualified: MemberProfile = { ...PROFILE, experienceYears: 0 };
  const r = explainStaffingMatch(
    { employerId: 'e1', policyType: 'unverified', restrictedOffenseCategories: [], restrictionBasis: null, lastReviewedAt: null },
    { hasDisclosed: false, offenseCategories: [] },
    REQ, underqualified,
  );
  assert.equal(r.factors.find((f) => f.kind === 'experience')!.met, false);
});

test('no banned decision phrase appears in any reason this module could produce', () => {
  const r = explainStaffingMatch(
    { employerId: 'e1', policyType: 'affirmative_fair_chance', restrictedOffenseCategories: [], restrictionBasis: null, lastReviewedAt: null },
    { hasDisclosed: false, offenseCategories: [] },
    REQ, PROFILE,
  );
  for (const pattern of BANNED_DECISION_PHRASES) assert.equal(pattern.test(r.reason), false, pattern.toString());
});

// ---- Evidence layer: only real stages produce facts; submission/interview never do; no inflation ----

test('candidate submission and interview stages produce no evidence', () => {
  for (const stage of NON_EVIDENCE_STAGES) assert.equal(evidenceForStage(stage, 'a1', '2026-10-07T00:00:00Z'), null, stage);
});

test('placement, assignment start, retention and conversion each produce exactly one fact of the right kind', () => {
  assert.equal(evidenceForStage('placement_confirmed', 'a1', 'x')!.kind, 'placement');
  assert.equal(evidenceForStage('assignment_active', 'a1', 'x')!.kind, 'assignment_start');
  assert.equal(evidenceForStage('retention_confirmed', 'a1', 'x')!.kind, 'retention');
  assert.equal(evidenceForStage('converted_to_direct_hire', 'a1', 'x')!.kind, 'conversion_to_direct_hire');
});

test('every evidence fact is marked system_recorded, never a member-reported claim', () => {
  const f = evidenceForStage('placement_confirmed', 'a1', 'x')!;
  assert.equal(f.verificationState, 'system_recorded');
});

test('evidence count reflects exactly the facts given, no multiplier or estimate', () => {
  const facts = [
    evidenceForStage('placement_confirmed', 'a1', 'x')!,
    evidenceForStage('placement_confirmed', 'a2', 'y')!,
    evidenceForStage('retention_confirmed', 'a1', 'z')!,
  ];
  assert.equal(evidenceCount(facts, 'placement'), 2);
  assert.equal(evidenceCount(facts, 'retention'), 1);
  assert.equal(evidenceCount(facts, 'conversion_to_direct_hire'), 0);
});
