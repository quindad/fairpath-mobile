import assert from 'node:assert/strict';
import test from 'node:test';
import { CleanupRegistry, assertDevMutatingSession, createRunId } from '../scripts/lib/dev-qa-run.mjs';

test('createRunId is unique and safe to log', () => {
  const a = createRunId('t');
  const b = createRunId('t');
  assert.notEqual(a, b);
  assert.match(a, /^t-/);
});

test('assertDevMutatingSession requires --confirm-dev', () => {
  assert.throws(
    () =>
      assertDevMutatingSession({
        url: 'https://znvhmuhojvwvjzmaqwff.supabase.co',
        linkedRef: 'znvhmuhojvwvjzmaqwff',
        confirmDev: false,
      }),
    /--confirm-dev/,
  );
});

test('CleanupRegistry marks failure when a task throws', async () => {
  const reg = new CleanupRegistry();
  reg.add('fail task', async () => {
    throw new Error('boom');
  });
  await reg.runAll();
  assert.equal(reg.failed, true);
  assert.equal(reg.errors.length, 1);
});
