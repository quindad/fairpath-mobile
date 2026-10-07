import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBilledAction, unavailableDevGenerator, USER_MESSAGE } from '../src/core/ai/usage-accounting.ts';
import { balanceAt, type Ledger } from '../src/core/credits/ledger.ts';

const NOW = '2026-10-07T00:00:00Z';
const LEDGER: Ledger = { buckets: [{ kind: 'monthly', remaining: 5, expiresAt: '2026-10-31T00:00:00Z' }], appliedDebitIds: [] };

test('Premium-only action is blocked before any debit for a lower tier', async () => {
  const r = await runBilledAction('dispute_letter_draft', 'free', LEDGER, 'r1', NOW, async () => ({ ok: true, output: 'x' }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(r.error, { kind: 'premium_required' });
    assert.equal(balanceAt(r.ledger, NOW), 5, 'no credits were touched');
  }
});

test('insufficient credits are reported with the needed and available amounts, and nothing is debited', async () => {
  const poor: Ledger = { buckets: [{ kind: 'monthly', remaining: 1, expiresAt: '2026-10-31T00:00:00Z' }], appliedDebitIds: [] };
  const r = await runBilledAction('full_credit_report_analysis', 'premium', poor, 'r1', NOW, async () => ({ ok: true, output: 'x' }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(r.error, { kind: 'insufficient_credits', neededCredits: 10, availableCredits: 1 });
  }
});

test('a successful generation debits exactly the action cost and returns the output', async () => {
  const r = await runBilledAction('job_fit_explanation', 'free', LEDGER, 'r1', NOW, async () => ({ ok: true, output: 'explanation' }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.creditsCharged, 1);
    assert.equal(r.output, 'explanation');
    assert.equal(balanceAt(r.ledger, NOW), 4);
  }
});

test('a failed generation refunds the debit in full; the member ends with the same balance', async () => {
  const r = await runBilledAction('resume_create_or_rewrite', 'free', LEDGER, 'r1', NOW, async () => ({ ok: false, retryable: true }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(r.error, { kind: 'provider_unavailable', retryable: true });
    assert.equal(balanceAt(r.ledger, NOW), 5, 'full refund');
  }
});

test('the DEV unavailable generator never pretends to answer and is always refunded', async () => {
  const r = await runBilledAction('resource_concierge', 'free', LEDGER, 'r1', NOW, unavailableDevGenerator());
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.kind, 'provider_unavailable');
    assert.equal(balanceAt(r.ledger, NOW), 5);
  }
});

test('replaying the same request id does not double-charge on a second successful call', async () => {
  const first = await runBilledAction('job_fit_explanation', 'free', LEDGER, 'same', NOW, async () => ({ ok: true, output: 'a' }));
  if (!first.ok) throw new Error('setup failed');
  const second = await runBilledAction('job_fit_explanation', 'free', first.ledger, 'same', NOW, async () => ({ ok: true, output: 'a' }));
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(balanceAt(second.ledger, NOW), 4, 'still only charged once');
});

test('every error kind has a member-facing message that never exposes internals', () => {
  for (const [kind, msg] of Object.entries(USER_MESSAGE)) {
    assert.ok(msg.length > 0, kind);
    assert.equal(/error:|stack|undefined|null/i.test(msg), false, kind);
  }
});
