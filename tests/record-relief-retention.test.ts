import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRetention, type RetentionDeps, type ExpiredUploadRow } from '../supabase/functions/record-relief-retention/handler.ts';

const TOKEN = 'sweep-token-abc';

function makeDeps(over: Partial<RetentionDeps> = {}): RetentionDeps {
  return {
    checkToken: async (t) => t === TOKEN,
    listExpired: async () => [],
    removeFromStorage: async () => ({ ok: true }),
    markDeleted: async () => ({ ok: true }),
    ...over,
  };
}

test('a GET request is rejected as method not allowed, not run', async () => {
  let listed = false;
  const out = await handleRetention('GET', JSON.stringify({ token: TOKEN }), makeDeps({ listExpired: async () => { listed = true; return []; } }));
  assert.deepEqual(out, { status: 405, body: { error: 'method_not_allowed' } });
  assert.equal(listed, false);
});

test('malformed JSON is rejected before any token check or query', async () => {
  let checked = false;
  const out = await handleRetention('POST', '{not json', makeDeps({ checkToken: async () => { checked = true; return true; } }));
  assert.deepEqual(out, { status: 400, body: { error: 'invalid_json' } });
  assert.equal(checked, false);
});

test('a wrong or missing token is unauthorized and the sweep never runs', async () => {
  let listed = false;
  const deps = makeDeps({ listExpired: async () => { listed = true; return []; } });
  assert.deepEqual(await handleRetention('POST', JSON.stringify({ token: 'wrong' }), deps), { status: 401, body: { error: 'unauthorized' } });
  assert.deepEqual(await handleRetention('POST', JSON.stringify({}), deps), { status: 401, body: { error: 'unauthorized' } });
  assert.equal(listed, false);
});

test('a query failure reports query_failed and deletes nothing', async () => {
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), makeDeps({ listExpired: async () => null }));
  assert.deepEqual(out, { status: 500, body: { error: 'query_failed' } });
});

test('a row is marked deleted only AFTER storage removal succeeds, never before or instead', async () => {
  const rows: ExpiredUploadRow[] = [{ id: 'u1', storage_path: 'member/u1.pdf' }];
  const order: string[] = [];
  const deps = makeDeps({
    listExpired: async () => rows,
    removeFromStorage: async (path) => { order.push('remove:' + path); return { ok: true }; },
    markDeleted: async (id) => { order.push('markDeleted:' + id); return { ok: true }; },
  });
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), deps);
  assert.deepEqual(out, { status: 200, body: { deleted: 1, failed: 0 } });
  assert.deepEqual(order, ['remove:member/u1.pdf', 'markDeleted:u1']);
});

test('when storage removal fails, the row is NOT marked deleted — it stays for the next sweep', async () => {
  const rows: ExpiredUploadRow[] = [{ id: 'u1', storage_path: 'member/u1.pdf' }];
  let markDeletedCalled = false;
  const deps = makeDeps({
    listExpired: async () => rows,
    removeFromStorage: async () => ({ ok: false }),
    markDeleted: async () => { markDeletedCalled = true; return { ok: true }; },
  });
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), deps);
  assert.deepEqual(out, { status: 200, body: { deleted: 0, failed: 1 } });
  assert.equal(markDeletedCalled, false);
});

test('a row with no storage_path (nothing was ever stored) is marked deleted directly, with no remove call', async () => {
  const rows: ExpiredUploadRow[] = [{ id: 'u2', storage_path: null }];
  let removeCalled = false;
  const deps = makeDeps({
    listExpired: async () => rows,
    removeFromStorage: async () => { removeCalled = true; return { ok: true }; },
  });
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), deps);
  assert.deepEqual(out, { status: 200, body: { deleted: 1, failed: 0 } });
  assert.equal(removeCalled, false);
});

test('a batch mixes successes and failures and reports both counts correctly', async () => {
  const rows: ExpiredUploadRow[] = [
    { id: 'u1', storage_path: 'member/u1.pdf' },
    { id: 'u2', storage_path: 'member/u2.pdf' },
    { id: 'u3', storage_path: null },
  ];
  const deps = makeDeps({
    listExpired: async () => rows,
    removeFromStorage: async (path) => ({ ok: path !== 'member/u2.pdf' }), // u2's removal fails
  });
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), deps);
  assert.deepEqual(out, { status: 200, body: { deleted: 2, failed: 1 } });
});

test('a failed database write after successful storage removal counts as failed, not silently lost', async () => {
  const rows: ExpiredUploadRow[] = [{ id: 'u1', storage_path: 'member/u1.pdf' }];
  const deps = makeDeps({ listExpired: async () => rows, markDeleted: async () => ({ ok: false }) });
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), deps);
  assert.deepEqual(out, { status: 200, body: { deleted: 0, failed: 1 } });
});

test('an empty expired list is a clean no-op', async () => {
  const out = await handleRetention('POST', JSON.stringify({ token: TOKEN }), makeDeps());
  assert.deepEqual(out, { status: 200, body: { deleted: 0, failed: 0 } });
});
