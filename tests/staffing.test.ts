import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEconomics, GROSS_SPREAD_LABEL, INTERNAL_ONLY_FIELDS, type RateCard } from '../src/core/staffing/economics.ts';
import { toMemberView, type InternalAssignment } from '../src/core/staffing/member-view.ts';
import { canAdvance, advance, screeningAuthorized, AUTO_REJECT_STAGES, type StaffingStage } from '../src/core/staffing/workflow.ts';
import { resolveListingKind, LISTING_KIND_LABEL } from '../src/core/staffing/listing-kind.ts';
import { canTransition as foxhireCanTransition, createMockFoxHireAdapter, type FoxHireState } from '../src/core/staffing/foxhire-adapter.ts';
import { canTransition as screeningCanTransition, mayRequestScreening, createMockScreeningAdapter, FORBIDDEN_FUNCTION_NAME_PATTERNS, type ScreeningState } from '../src/core/staffing/checkr-adapter.ts';
import { EXPERIAN_STATUS, BANNED_EXPORT_PATTERNS } from '../src/core/staffing/experian-adapter.ts';
import { readFileSync } from 'node:fs';

// ---- Economics: gross spread is never called profit, math is correct ----

const RC: RateCard = { payRateHourly: 20, billRateHourly: 32, eorCostHourly: 2, screeningCostFlat: 60, statutoryBurdenPercent: 12, expectedWeeklyHours: 40, expectedAssignmentWeeks: 12 };

test('gross spread is bill minus pay minus EOR cost, and is explicitly labeled not profit', () => {
  const r = computeEconomics(RC);
  assert.equal(r.grossSpreadHourly, 10);
  assert.equal(r.label, GROSS_SPREAD_LABEL);
  assert.ok(/not profit/i.test(r.label));
});

test('statutory burden and amortized screening reduce estimated contribution correctly', () => {
  const r = computeEconomics(RC);
  assert.equal(r.statutoryBurdenHourly, 2.4);
  assert.equal(r.amortizedScreeningHourly, 0.13); // 60 / (40*12) = 0.125 -> rounds to 0.13
  assert.equal(r.estimatedContributionHourly, r.grossSpreadHourly - r.statutoryBurdenHourly - r.amortizedScreeningHourly);
});

test('no economics field or function anywhere in the module is literally named profit', () => {
  const src = readFileSync(new URL('../src/core/staffing/economics.ts', import.meta.url), 'utf8');
  assert.equal(/\bprofit\s*[:=]/i.test(src), false, 'no field or variable is literally named profit');
  assert.equal(/function\s+profit\b/i.test(src), false);
});

// ---- Member view: internal fields never leak, even from an over-sharing internal object ----

const INTERNAL: InternalAssignment = {
  id: 'a1', clientDisplayName: 'Acme Logistics', roleTitle: 'Warehouse Associate', locationText: 'Columbus, OH',
  payRateHourly: 20, payRatePeriodLabel: 'hr', shiftScheduleText: 'Mon-Fri, 8am-4pm', assignmentType: 'temp_to_hire',
  expectedDurationWeeks: 12, status: 'active', interviewScheduledAt: null, screeningStatus: 'complete',
  onboardingStatus: 'complete', startDate: '2026-10-20', timePayrollHandoffAvailable: true, retentionCheckpointDueAt: '2026-11-20',
  billRateHourly: 32, eorCostHourly: 2, grossSpreadHourly: 10, estimatedContributionHourly: 7.47, internalNotes: 'client is slow to pay',
};

test('member view never includes any internal-only field, even when the source object has them', () => {
  const view = toMemberView(INTERNAL);
  const json = JSON.stringify(view);
  for (const field of INTERNAL_ONLY_FIELDS) assert.equal(field in view, false, field);
  assert.equal(json.includes('32'), false, 'bill rate value must not leak');
  assert.equal(json.includes('slow to pay'), false, 'internal notes must not leak');
});

test('member view pay rate is formatted from the pay rate only, not derived from bill rate', () => {
  const view = toMemberView(INTERNAL);
  assert.equal(view.payRate, '$20.00/hr');
});

// ---- Workflow: ordered, consent-gated screening, no automatic rejection ----

test('workflow stages only move forward in the defined order', () => {
  assert.equal(canAdvance('requisition_open', 'sourcing_matching'), true);
  assert.equal(canAdvance('requisition_open', 'assignment_active'), false);
  assert.equal(advance('interview', 'placement_confirmed'), 'interview');
});

test('screening is authorized only from screening_consent onward', () => {
  const before: StaffingStage[] = ['requisition_open', 'sourcing_matching', 'member_preparation', 'interview'];
  for (const s of before) assert.equal(screeningAuthorized(s), false, s);
  assert.equal(screeningAuthorized('screening_consent'), true);
  assert.equal(screeningAuthorized('assignment_active'), true);
});

test('assignment_active can end or convert to direct hire, not skip ahead', () => {
  assert.equal(canAdvance('assignment_active', 'assignment_ended'), true);
  assert.equal(canAdvance('assignment_active', 'converted_to_direct_hire'), true);
  assert.equal(canAdvance('assignment_active', 'retention'), false);
});

test('no stage in the staffing workflow is an automatic rejection', () => {
  assert.deepEqual(AUTO_REJECT_STAGES, []);
});

// ---- Listing kind: default is direct hire, never guessed as staffing ----

test('unknown or missing listing kind defaults to direct_hire', () => {
  assert.equal(resolveListingKind(null), 'direct_hire');
  assert.equal(resolveListingKind(undefined), 'direct_hire');
  assert.equal(resolveListingKind('something_else'), 'direct_hire');
});

test('an explicit staffing value is honored', () => {
  assert.equal(resolveListingKind('staffing'), 'staffing');
  assert.equal(LISTING_KIND_LABEL.staffing, 'FairPath Staffing');
});

// ---- FoxHire adapter: explicit states, mock never calls a network, errors are recoverable ----

test('FoxHire states only move through the defined onboarding sequence', () => {
  assert.equal(foxhireCanTransition('candidate_submitted', 'onboarding_requested'), true);
  assert.equal(foxhireCanTransition('candidate_submitted', 'payroll_active'), false);
  assert.equal(foxhireCanTransition('assignment_ended', 'assignment_active' as FoxHireState), false);
});

test('provider_error_manual_review can resume onboarding but never skip to active states', () => {
  assert.equal(foxhireCanTransition('provider_error_manual_review', 'onboarding_pending'), true);
  assert.equal(foxhireCanTransition('provider_error_manual_review', 'payroll_active'), false);
});

test('the mock FoxHire adapter starts every candidate at candidate_submitted and is deterministic', async () => {
  const adapter = createMockFoxHireAdapter();
  const r = await adapter.submitCandidate({ assignmentId: 'a1', firstName: 'Pat', lastName: 'Doe', email: 'pat@example.com' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(await adapter.getState(r.providerRef), 'candidate_submitted');
  assert.equal(await adapter.getState('unknown-ref'), 'provider_error_manual_review');
});

// ---- Checkr adapter: consent-gated, no auto-reject, mock is a human-review stub ----

test('screening cannot be requested without consent', () => {
  assert.equal(mayRequestScreening('consent_pending', false), false);
  assert.equal(mayRequestScreening('consent_pending', true), true);
  assert.equal(mayRequestScreening('requested', true), false);
});

test('screening states only move forward through the defined sequence', () => {
  assert.equal(screeningCanTransition('consent_pending', 'requested'), true);
  assert.equal(screeningCanTransition('consent_pending', 'result_available' as ScreeningState), false);
  assert.equal(screeningCanTransition('result_available', 'requested'), false);
});

test('the mock screening adapter always routes to needs_review, never an automatic clear or reject', async () => {
  const adapter = createMockScreeningAdapter();
  const r = await adapter.requestScreening('cand-1');
  assert.equal(r.ok, true);
  if (r.ok) {
    const result = await adapter.getResult(r.providerRef);
    assert.equal(result!.status, 'needs_review');
  }
});

test('no exported function name in the Checkr adapter matches a forbidden auto-decision pattern', () => {
  const src = readFileSync(new URL('../src/core/staffing/checkr-adapter.ts', import.meta.url), 'utf8');
  const exportedNames = [...src.matchAll(/export (?:function|const) (\w+)/g)].map((m) => m[1]!);
  for (const name of exportedNames) {
    for (const pattern of FORBIDDEN_FUNCTION_NAME_PATTERNS) assert.equal(pattern.test(name), false, `${name} matches ${pattern}`);
  }
});

// ---- Experian: boundary only, no employment-screening surface ----

test('Experian has no mapped use case yet', () => {
  assert.equal(EXPERIAN_STATUS.useCase, 'not_yet_mapped');
});

test('the Experian module exports nothing matching a banned employment-screening pattern', () => {
  const src = readFileSync(new URL('../src/core/staffing/experian-adapter.ts', import.meta.url), 'utf8');
  const exportedNames = [...src.matchAll(/export (?:function|const|type) (\w+)/g)].map((m) => m[1]!);
  for (const name of exportedNames) {
    if (name === 'EXPERIAN_STATUS' || name === 'BANNED_EXPORT_PATTERNS' || name === 'ExperianUseCase') continue;
    for (const pattern of BANNED_EXPORT_PATTERNS) assert.equal(pattern.test(name), false, `${name} matches ${pattern}`);
  }
});
