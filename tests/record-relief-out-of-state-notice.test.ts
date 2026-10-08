// Regression test for the out-of-state product-safety fix: a conviction flagged out-of-state is collected
// (src/app/record-relief/add.tsx) with a promise that FairPath "will suggest a manual review," but the shared
// evaluation engine has no cross-jurisdiction routing and never surfaced that flag anywhere before this fix.
// This proves the notice fires exactly when the flag is set, says what it actually does (nothing special in the
// evaluation) rather than implying a legal determination was made, and stays empty otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { outOfStateNotice } from '../src/core/record-relief/relief-format.ts';

test('out-of-state notice is empty when the conviction was not flagged out-of-state', () => {
  assert.equal(outOfStateNotice(false, 'Ohio'), '');
});

test('out-of-state notice fires, names the jurisdiction whose rules were actually used, and recommends manual review', () => {
  const notice = outOfStateNotice(true, 'Ohio');
  assert.notEqual(notice, '');
  assert.match(notice, /out-of-state/i);
  assert.match(notice, /Ohio/);
  assert.match(notice, /manual review/i);
  // Must not claim a legal determination was made about the other state's law.
  assert.doesNotMatch(notice, /eligible/i);
  assert.doesNotMatch(notice, /ineligible/i);
});
