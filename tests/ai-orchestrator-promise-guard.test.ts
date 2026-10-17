// Regression test for a real gap: PROMISE_PATTERN (src/core/credit/credit-format.ts) exists specifically to catch
// score-guarantee / automatic-removal language, but it was never imported anywhere -- the AI rephrase path in
// src/core/ai/orchestrator.ts could pass a model's reworded text straight through to the member with nothing
// checking it against that pattern, directly contradicting the orchestrator's own stated rule ("never promises an
// outcome"). Fixed by rejecting (not editing) any rewording that matches PROMISE_PATTERN, falling back to the
// deterministic, already-safe text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answer, type AiGateway, type ModelAdapter } from '../src/core/ai/orchestrator.ts';
import { guardOutput } from '../supabase/functions/_shared/core/ai-gateway/policy.ts';

const emptyGateway: AiGateway = {
  signedIn: async () => true,
  summary: async () => ({}) as never,
  profileCompletion: async () => [],
  needs: async () => [],
  creditItems: async () => [],
  creditAccountsToConfirm: async () => 0,
  reliefCases: async () => [],
  reliefEvaluations: async () => [],
  upcomingMeetings: async () => [],
  resumeCount: async () => 0,
  myEarlyAccessEnrollments: async () => [],
  fairPathPlusStatus: async () => ({ active: false, source: null, daysRemaining: null, complimentary: false }),
};

function adapterThatSays(text: string): ModelAdapter {
  return { available: async () => true, rephrase: async () => text };
}

test('a model rewording that promises score improvement is dropped, not shown', async () => {
  const res = await answer('review my credit', emptyGateway, { adapter: adapterThatSays('Do not worry, this will raise your score fast.') });
  assert.ok(!res.parts.some((p) => p.basis === 'ai'), 'a promise-pattern rewording must never be added as an AI part');
  assert.equal(res.modelAssisted, false);
});

test('a model rewording that promises removal is dropped, not shown', async () => {
  const res = await answer('review my credit', emptyGateway, { adapter: adapterThatSays('We guarantee this item will be removed from your report.') });
  assert.ok(!res.parts.some((p) => p.basis === 'ai'));
  assert.equal(res.modelAssisted, false);
});

test('a model rewording that says a credit score will rise is dropped, not shown', async () => {
  const res = await answer('review my credit', emptyGateway, { adapter: adapterThatSays('Your credit score will rise after this.') });
  assert.ok(!res.parts.some((p) => p.basis === 'ai'));
  assert.equal(res.modelAssisted, false);
});

test('a model rewording that says a dispute will succeed is dropped, not shown', async () => {
  const res = await answer('build my dispute letter', emptyGateway, { adapter: adapterThatSays('This dispute will succeed.') });
  assert.ok(!res.parts.some((p) => p.basis === 'ai'));
  assert.equal(res.modelAssisted, false);
});

test('a model rewording that promises expungement is dropped, not shown', async () => {
  const res = await answer('can I expunge my record', emptyGateway, { adapter: adapterThatSays('You qualify for expungement. Your record will be expunged.') });
  assert.ok(!res.parts.some((p) => p.basis === 'ai'));
  assert.equal(res.modelAssisted, false);
});

test('the signal output guard rejects the same score, dispute, and expungement promises', () => {
  for (const text of [
    'Your credit score will rise after this.',
    'This dispute will succeed.',
    'You qualify for expungement. Your record will be expunged.',
  ]) {
    assert.equal(guardOutput(text).ok, false, text);
  }
  assert.equal(guardOutput('Here is a plain-language summary of your credit workspace status.').ok, true);
});

test('an ordinary, promise-free rewording still passes through', async () => {
  const res = await answer('review my credit', emptyGateway, { adapter: adapterThatSays('Here is a plain-language summary of your credit workspace status.') });
  assert.ok(res.parts.some((p) => p.basis === 'ai' && p.text.includes('plain-language summary')));
  assert.equal(res.modelAssisted, true);
});
