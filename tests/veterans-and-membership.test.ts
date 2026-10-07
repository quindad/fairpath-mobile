import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, AI_ACTION_CREDITS, REFILL_PACKS, PREMIUM_GATED_ACTIONS, tierMayUse, FROZEN_SPEC_VERSION } from '../src/core/membership/frozen-v1.ts';
import { BRANCHES, branchById } from '../src/core/veterans/branches.ts';
import { SERVICE_PROFILE_FIELDS, requiredToBrowse, mayUseField } from '../src/core/veterans/service-profile.ts';
import { translateOccupation, REVIEWED_TRANSLATIONS } from '../src/core/veterans/translation.ts';
import { VETERAN_SECTIONS, BENEFIT_DETERMINATIONS_ALLOWED, sectionUsable } from '../src/core/veterans/dashboard.ts';

// ---- Frozen V1 membership: values anchored to FAIRPATH-V1-MEMBERSHIP-PRICING-FROZEN.md (membership-v1.0) ----

test('frozen spec version is membership-v1.0', () => {
  assert.equal(FROZEN_SPEC_VERSION, 'membership-v1.0');
});

test('frozen tiers match the spec exactly', () => {
  assert.deepEqual(
    { price: TIERS.free.monthlyUsd, credits: TIERS.free.monthlyCredits, claims: TIERS.free.marketplaceClaimsPerMonth },
    { price: 0, credits: 5, claims: 1 },
  );
  assert.deepEqual(
    { price: TIERS.plus.monthlyUsd, credits: TIERS.plus.monthlyCredits, claims: TIERS.plus.marketplaceClaimsPerMonth, ft: TIERS.plus.fastTrackDiscountUsd },
    { price: 2, credits: 30, claims: 7, ft: 10 },
  );
  assert.deepEqual(
    { price: TIERS.premium.monthlyUsd, credits: TIERS.premium.monthlyCredits, claims: TIERS.premium.marketplaceClaimsPerMonth },
    { price: 4.99, credits: 100, claims: 7 },
  );
});

test('AI action debit schedule matches the spec exactly', () => {
  assert.deepEqual(AI_ACTION_CREDITS, {
    resume_create_or_rewrite: 2,
    job_fit_explanation: 1,
    resource_concierge: 1,
    personal_plan: 2,
    record_relief_explanation: 2,
    dispute_letter_draft: 2,
    full_credit_report_analysis: 10,
  });
});

test('refill packs match the spec exactly', () => {
  assert.deepEqual(REFILL_PACKS.map((p) => [p.credits, p.priceUsd]), [[15, 0.99], [40, 1.99], [100, 3.99]]);
});

test('dispute-letter drafting and full report analysis are Premium-gated per spec', () => {
  assert.deepEqual([...PREMIUM_GATED_ACTIONS].sort(), ['dispute_letter_draft', 'full_credit_report_analysis']);
  assert.equal(tierMayUse('free', 'dispute_letter_draft'), false);
  assert.equal(tierMayUse('plus', 'full_credit_report_analysis'), false);
  assert.equal(tierMayUse('premium', 'dispute_letter_draft'), true);
});

test('ordinary AI actions are open to every tier subject to credits', () => {
  for (const tier of ['free', 'plus', 'premium'] as const) {
    assert.equal(tierMayUse(tier, 'job_fit_explanation'), true);
  }
});

// ---- Veterans: six branches, official names, no insignia, no permanent colors ----

test('exactly six armed-forces branches with official names', () => {
  assert.deepEqual(
    BRANCHES.map((b) => b.officialName),
    [
      'United States Army',
      'United States Marine Corps',
      'United States Navy',
      'United States Air Force',
      'United States Space Force',
      'United States Coast Guard',
    ],
  );
});

test('no branch may use insignia, and every branch accent is pending review', () => {
  for (const b of BRANCHES) {
    assert.equal(b.insigniaAllowed, false, b.id);
    assert.equal(b.accentStatus, 'pending_review', b.id);
    assert.equal(b.accentHex, '#A8F32C', b.id);
  }
});

test('reserve and National Guard components are offered only where the branch has them', () => {
  assert.ok(branchById('army')!.components.includes('national_guard'));
  assert.equal(branchById('navy')!.components.includes('national_guard'), false);
  assert.equal(branchById('coast_guard')!.components.includes('reserve'), true);
});

test('browsing Veterans content requires no profile field', () => {
  assert.deepEqual(requiredToBrowse(), []);
});

test('every service profile field requires consent and no field is shared by default', () => {
  for (const f of SERVICE_PROFILE_FIELDS) assert.equal(f.requiresConsent, true, f.field);
  assert.equal(mayUseField('branch', []), false);
  assert.equal(mayUseField('branch', [{ field: 'branch', granted: false }]), false);
  assert.equal(mayUseField('branch', [{ field: 'branch', granted: true }]), true);
});

test('consent for one field never unlocks another', () => {
  assert.equal(mayUseField('pay_grade', [{ field: 'branch', granted: true }]), false);
});

test('proof is requested only for fields that a verified program may need', () => {
  for (const f of SERVICE_PROFILE_FIELDS) {
    if (f.proofMayBeRequested) assert.ok(['program_eligibility', 'translation'].includes(f.purpose), f.field);
  }
});

test('occupation translation never guesses: unreviewed codes return not_reviewed', () => {
  assert.equal(REVIEWED_TRANSLATIONS.length, 0, 'reviewed table must be empty until a reviewed import');
  assert.deepEqual(translateOccupation('army', '11B'), { status: 'not_reviewed' });
});

test('a reviewed mapping is returned only for its exact branch and code', () => {
  const table = [{ branch: 'army' as const, code: '11B', civilianRoles: ['Test role'], reviewedBy: 'SME', reviewedOn: '2026-10-06' }];
  assert.equal(translateOccupation('army', '11b', table).status, 'reviewed');
  assert.equal(translateOccupation('navy', '11B', table).status, 'not_reviewed');
});

test('benefit determinations are never allowed in the Veterans pathway', () => {
  assert.equal(BENEFIT_DETERMINATIONS_ALLOWED, false);
  const benefits = VETERAN_SECTIONS.find((s) => s.id === 'benefits_navigation')!;
  assert.equal(benefits.officialLinksOnly, true);
});

test('no Veterans section is usable while the pathway is in development', () => {
  for (const s of VETERAN_SECTIONS) assert.equal(sectionUsable(s), false, s.id);
});
