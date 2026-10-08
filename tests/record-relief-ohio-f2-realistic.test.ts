import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOhio295332 } from '../src/core/record-relief/ohio.ts';
import type { Charge } from '../src/core/record-relief/jurisdiction-engine.ts';

// Synthetic facts only: derived from an Ohio public-docket pattern; no personal data.
const charge: Charge = {
  id: 'synthetic-ohio-f2', offenseName: 'Improper discharge at or into a habitation',
  statute: '2923.161(A)(1)', degree: 'felony', degreeLevel: 2,
  disposition: 'conviction', convictionDate: '2012-11-26',
  supervisionCompletionDate: '2014-11-25'
};
const facts = { today: '2026-10-08', pendingProceeding: false, offenseOfViolence: true };
for (const remedy of ['sealing', 'expungement'] as const) {
  test('Ohio 2923.161(A)(1) F2: '+remedy+' excluded under ordinary 2953.32', () => {
    const result = evaluateOhio295332(charge, facts, remedy);
    assert.equal(result.outcome, 'likely_excluded_verified');
    assert.equal(result.courtSpecificFilingReady, false);
    assert.match(result.reasons.join(' '), /second-degree felon/i);
    assert.match(result.reasons.join(' '), /felony offense of violence/i);
    assert.equal(result.source.url, 'https://codes.ohio.gov/ohio-revised-code/section-2953.32');
  });
}
test('Ohio F2 remains excluded even when pending-proceeding status unknown', () => {
  const result = evaluateOhio295332(charge, {today:'2026-10-08'}, 'sealing');
  assert.equal(result.outcome, 'likely_excluded_verified');
  assert.match(result.reasons.join(' '), /second-degree felon/i);
});
