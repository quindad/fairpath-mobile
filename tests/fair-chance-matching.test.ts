import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainMatch, policyIsStale, AUTO_REJECT_OUTCOMES, type EmployerPolicy, type MemberDisclosure } from '../src/core/matching/fair-chance.ts';

const base = (over: Partial<EmployerPolicy>): EmployerPolicy => ({
  employerId: 'e1', policyType: 'unverified', restrictedOffenseCategories: [], restrictionBasis: null, lastReviewedAt: '2026-09-01T00:00:00Z', ...over,
});
const NO_DISCLOSURE: MemberDisclosure = { hasDisclosed: false, offenseCategories: [] };

test('unverified policy is always insufficient information, never a match', () => {
  assert.equal(explainMatch(base({ policyType: 'unverified' }), NO_DISCLOSURE).outcome, 'insufficient_information');
});

test('affirmative fair-chance is a potential match even without disclosure', () => {
  assert.equal(explainMatch(base({ policyType: 'affirmative_fair_chance' }), NO_DISCLOSURE).outcome, 'potential_match');
});

test('individualized review is never resolved by FairPath; it always defers to the employer', () => {
  const r = explainMatch(base({ policyType: 'individualized_review' }), { hasDisclosed: true, offenseCategories: ['theft'] });
  assert.equal(r.outcome, 'individual_review');
});

test('a specific restriction with no disclosure asks for information rather than guessing', () => {
  const policy = base({ policyType: 'specific_restriction', restrictedOffenseCategories: ['violent'] });
  assert.equal(explainMatch(policy, NO_DISCLOSURE).outcome, 'insufficient_information');
});

test('overlapping disclosed categories produce a possible restriction, not a rejection', () => {
  const policy = base({ policyType: 'specific_restriction', restrictedOffenseCategories: ['violent'] });
  const r = explainMatch(policy, { hasDisclosed: true, offenseCategories: ['violent'] });
  assert.equal(r.outcome, 'possible_restriction');
});

test('disclosed categories with no overlap are a potential match, with the employer still deciding', () => {
  const policy = base({ policyType: 'specific_restriction', restrictedOffenseCategories: ['violent'] });
  const r = explainMatch(policy, { hasDisclosed: true, offenseCategories: ['theft'] });
  assert.equal(r.outcome, 'potential_match');
  assert.ok(/employer/i.test(r.reason));
});

test('legal or licensing restriction names its basis distinctly from a plain policy restriction', () => {
  const policy = base({ policyType: 'legal_or_licensing_restriction', restrictedOffenseCategories: ['fraud'] });
  const r = explainMatch(policy, { hasDisclosed: true, offenseCategories: ['fraud'] });
  assert.ok(/legal or licensing/i.test(r.reason));
});

test('no outcome ever triggers an automatic rejection action', () => {
  assert.deepEqual(AUTO_REJECT_OUTCOMES, []);
});

test('no explanation ever promises a hiring decision', () => {
  const policies: EmployerPolicy['policyType'][] = ['unverified', 'affirmative_fair_chance', 'individualized_review', 'specific_restriction', 'legal_or_licensing_restriction'];
  for (const policyType of policies) {
    const r = explainMatch(base({ policyType, restrictedOffenseCategories: ['x'] }), { hasDisclosed: true, offenseCategories: ['x'] });
    assert.equal(/will (hire|be hired|be approved)/i.test(r.reason), false, policyType);
  }
});

test('policy staleness: never reviewed is stale; within 180 days is not; over is', () => {
  const now = '2026-10-07T00:00:00Z';
  assert.equal(policyIsStale(base({ lastReviewedAt: null }), now), true);
  assert.equal(policyIsStale(base({ lastReviewedAt: '2026-09-01T00:00:00Z' }), now), false);
  assert.equal(policyIsStale(base({ lastReviewedAt: '2025-01-01T00:00:00Z' }), now), true);
});
