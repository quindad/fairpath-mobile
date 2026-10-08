// Regression fixture suite requested by the founder's final completion sprint: realistic (synthetic, never real
// identity) scenarios proving the engine never invents a statute, form, fee, or eligibility outcome, and always
// fails closed to "needs more information" / "excluded" / "discretionary" rather than guessing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOhio295332 } from '../src/core/record-relief/ohio.ts';
import type { Charge, CaseBundle } from '../src/core/record-relief/jurisdiction-engine.ts';
import { executeRecordRelief } from '../src/core/record-relief/engine-executor.ts';
import { routeCase } from '../src/core/record-relief/jurisdiction-engine.ts';
import { planRecordReliefEvaluation } from '../src/core/record-relief/engine-registry.ts';

const c = (x: Partial<Charge> = {}): Charge => ({ id: '1', offenseName: 'Synthetic test offense', degree: 'misdemeanor', disposition: 'conviction', sentenceCompletionDate: '2024-01-01', ...x });
const facts = { today: '2026-10-07', pendingProceeding: false };

// 1. Ohio F2 specifically excluded by statute (R.C. 2953.32(A)(1)(f), verified against the live statute text
// this pass — no exception or alternate sealing/expungement pathway exists for F1/F2 under this statute).
test('fixture: Ohio F2 (R.C. 2923.161 improper discharge of firearm pattern) is excluded, cites the statute, never invents eligibility', () => {
  const r = evaluateOhio295332(c({ statute: '2923.161', degree: 'felony', degreeLevel: 2, disposition: 'conviction' }), facts);
  assert.equal(r.outcome, 'likely_excluded_verified');
  assert.ok(r.reasons.some((x) => x.includes('First- and second-degree felonies are excluded')));
  assert.equal(r.source.citation, 'Ohio Rev. Code § 2953.32 (effective Sept. 30, 2025)');
  assert.ok(r.source.url.startsWith('https://'));
});

// 2. Ohio F2 where the degree level itself is not yet confirmed: must ask for the fact, not assume exclusion
// OR assume eligibility.
test('fixture: Ohio felony with unconfirmed degree level asks for the fact instead of guessing exclusion', () => {
  const r = evaluateOhio295332(c({ degree: 'felony', degreeLevel: undefined }), facts);
  assert.equal(r.outcome, 'additional_facts_required');
  assert.ok(r.missingFacts.includes('felony degree'));
});

// 3. Ohio offense potentially eligible under the correct (court-discretion) pathway once the waiting period has
// run -- never represented as guaranteed relief, always routed through the discretionary-hearing outcome.
test('fixture: Ohio F4 past its waiting period reaches discretionary review, not a guaranteed-eligible outcome', () => {
  const r = evaluateOhio295332(c({ degree: 'felony', degreeLevel: 4, sentenceCompletionDate: '2020-01-01' }), { ...facts, otherFelonyConvictions: 0 });
  assert.equal(r.outcome, 'court_or_prosecutor_discretion');
  assert.ok(r.reasons.some((x) => x.toLowerCase().includes('court') && x.toLowerCase().includes('hearing')));
});

// 4. Pending criminal proceedings block a positive outcome regardless of how clean the rest of the case looks.
test('fixture: pending proceedings never produce a positive eligibility result', () => {
  const r = evaluateOhio295332(c(), { today: '2026-10-07', pendingProceeding: true });
  assert.equal(r.outcome, 'court_or_prosecutor_discretion');
  assert.notEqual(r.outcome, 'likely_eligible_verified');
});

// 5. Missing conviction date / sentence-completion date: engine asks for the specific missing fact rather than
// defaulting to "now" or any other guessed date.
test('fixture: missing discharge date is reported as a specific missing fact, not defaulted', () => {
  const r = evaluateOhio295332(c({ sentenceCompletionDate: undefined, supervisionCompletionDate: undefined, releaseDate: undefined }), facts);
  assert.equal(r.outcome, 'additional_facts_required');
  assert.ok(r.missingFacts.includes('final discharge date'));
});

// 6. Multiple convictions with different outcomes: each charge is evaluated and reported independently -- a bad
// outcome on one charge must not silently suppress or overwrite a different, correct outcome on another.
test('fixture: multiple charges with different fact patterns each get their own independent, correctly distinct outcome', () => {
  const bundle: CaseBundle = {
    venue: { jurisdictionCode: 'US-OH', courtName: 'Synthetic Test Court', courtLevel: 'common_pleas' },
    charges: [
      { id: 'charge-excluded-f2', offenseName: 'Synthetic F2 offense', degree: 'felony', degreeLevel: 2, disposition: 'conviction', sentenceCompletionDate: '2020-01-01' },
      { id: 'charge-needs-facts', offenseName: 'Synthetic unclear-degree offense', degree: 'felony', disposition: 'conviction' },
    ],
  };
  const out = executeRecordRelief(bundle, { today: '2026-10-07', pendingProceeding: false, otherFelonyConvictions: 0 });
  assert.equal(out.ok, true);
  assert.equal(out.results.length, 2);
  const byCharge = Object.fromEntries(out.results.map((r) => [r.chargeIds[0], r.outcome]));
  assert.equal(byCharge['charge-excluded-f2'], 'likely_excluded_verified');
  assert.equal(byCharge['charge-needs-facts'], 'additional_facts_required');
});

// 7. Out-of-state conviction: documented gap, not a silent wrong answer. The saved-case schema has an
// out_of_state_conviction flag (used for document/worksheet text), but the shared evaluation engine's CaseBundle
// has no field for it and does not branch on it -- a member flagging a conviction as out-of-state gets evaluated
// as if the chosen jurisdiction's own law governs it, with no cross-jurisdiction warning. This is a known,
// reported gap (see the completion report), not something this test pretends to fix by inventing routing logic
// for 56 jurisdictions' cross-border rules.
test('fixture: out-of-state conviction has no dedicated engine field (documented gap, not fabricated handling)', () => {
  const bundle: CaseBundle = { venue: { jurisdictionCode: 'US-OH', courtName: 'Synthetic Test Court', courtLevel: 'common_pleas' }, charges: [c()] };
  assert.equal('outOfState' in bundle.charges[0], false);
  assert.equal('outOfState' in bundle.venue, false);
});

// 8 & 9. Unreadable court records and incorrect AI-extracted statutes are handled upstream (extraction
// validation and the human-review screen requiring confirmation before an uncertain field can be saved) --
// covered by tests/record-relief-extraction-boundary.test.ts and tests/record-relief-ai-intake.test.ts, and
// live-verified this session (Pass 5 of docs/RECORD_RELIEF_QA_RESULTS.md: a low-confidence field was correctly
// left blank rather than guessed, and the Save action was disabled until a human filled it in).

// 10. Expired/deleted uploaded document: covered by tests/record-relief-retention.test.ts (10 tests), which
// prove a row is only marked deleted after Storage confirms physical removal, never before.

// 11. Missing official source / unsupported jurisdiction: the routing and registry layer must refuse to invent
// a result rather than silently returning something for a jurisdiction it does not actually support.
test('fixture: an unsupported/unknown jurisdiction code is refused, not silently evaluated', () => {
  const bundle: CaseBundle = { venue: { jurisdictionCode: 'US-ZZ', courtLevel: 'unknown' }, charges: [c()] };
  const routing = routeCase(bundle);
  assert.equal(routing.canEvaluate, false);
  assert.ok(routing.issues.some((i) => i.code === 'unknown_jurisdiction'));
  const plan = planRecordReliefEvaluation(bundle);
  assert.equal(plan.ok, false);
  const out = executeRecordRelief(bundle);
  assert.equal(out.ok, false);
  assert.equal(out.results.length, 0);
});

// Safety invariant across every fixture above: whenever the engine returns a result at all, it always carries a
// real, checkable citation and URL -- it never produces a bare "eligible"/"excluded" with no authority behind it.
test('safety invariant: every produced result carries a real citation and URL, never a bare claim', () => {
  const cases: [Charge, Record<string, unknown>][] = [
    [c({ degree: 'felony', degreeLevel: 2 }), {}],
    [c({ degree: 'felony', degreeLevel: 4, sentenceCompletionDate: '2020-01-01' }), { otherFelonyConvictions: 0 }],
    [c(), { pendingProceeding: true }],
    [c({ degree: 'unknown' }), {}],
  ];
  for (const [charge, extra] of cases) {
    const r = evaluateOhio295332(charge, { ...facts, ...extra });
    assert.ok(r.source.citation.length > 0, 'citation must not be empty');
    assert.ok(r.source.url.startsWith('https://'), 'source url must be a real link');
  }
});
