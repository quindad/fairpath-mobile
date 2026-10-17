import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const workerPath = 'supabase/functions/notification-delivery-worker/index.ts';
const source = fs.readFileSync(workerPath, 'utf8');

async function invoke({ env = {}, claims = [], fetchImpl = async () => Response.json({ data: [] }), rpcImpl, attemptStatuses = [] } = {}) {
  let handler;
  const calls = [];
  const db = { from: () => ({ upsert: async () => ({ error: null }), update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }), select: () => ({ eq: async () => ({ data: attemptStatuses.map(status => ({ status })), error: null }) }) }), rpc: async (name, args) => {
    calls.push({ name, args });
    if (rpcImpl) return rpcImpl(name, args, calls);
    if (name === 'claim_notification_deliveries') return { data: claims, error: null };
    if (name === 'prepare_notification_token_attempts') return { data: (args.p_tokens ?? []).map(token => ({ token })), error: null };
    return { data: null, error: null };
  } };
  const transformed = source
    .replace(/import \{ createClient \} from 'npm:@supabase\/supabase-js@2';/, '')
    .replace('Deno.serve(', 'globalThis.__setHandler(');
  const js = ts.transpileModule(transformed, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({
    Response, Request, Headers, AbortSignal,
    fetch: fetchImpl,
    createClient: () => db,
    Deno: { env: { get: key => env[key] } },
    __setHandler: fn => { handler = fn; },
  });
  new vm.Script(js, { filename: workerPath }).runInContext(context);
  const request = new Request('https://worker.test', { method: 'POST', headers: { authorization: env.REQUEST_AUTH ?? '' } });
  const response = await handler(request);
  return { response, body: await response.text(), calls };
}

let result = await invoke();
assert.equal(result.response.status, 401);

result = await invoke({ env: { NOTIFICATION_WORKER_SECRET: 'secret', REQUEST_AUTH: 'Bearer secret' } });
assert.equal(result.response.status, 503);

const configured = { NOTIFICATION_WORKER_SECRET: 'secret', REQUEST_AUTH: 'Bearer secret', SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };
result = await invoke({ env: configured, rpcImpl: async name => name === 'claim_notification_deliveries' ? { data: null, error: { message: 'down' } } : { data: null, error: null } });
assert.equal(result.response.status, 500);

const job = { delivery_id: 'd1', notification_id: 'n1', tokens: ['ExponentPushToken[synthetic]'] };
let sentBody;
result = await invoke({ env: configured, claims: [job], fetchImpl: async (_url, init) => { sentBody = JSON.parse(init.body); return Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] }); } });
assert.deepEqual(JSON.parse(result.body), { claimed: 1, sent: 1, failed: 0 });
assert.equal(sentBody[0].body, 'You have a new update in FairPath.');
assert.equal(sentBody[0].data.route, '/notifications');
assert.equal(result.calls.at(-1).args.p_status, 'sent');

for (const fetchImpl of [
  async () => new Response('outage', { status: 503 }),
  async () => Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
  async () => { throw new DOMException('Timed out', 'TimeoutError'); },
]) {
  result = await invoke({ env: configured, claims: [job], fetchImpl });
  const retired = fetchImpl.toString().includes('DeviceNotRegistered');
  assert.deepEqual(JSON.parse(result.body), { claimed: 1, sent: 0, failed: retired ? 0 : 1 });
  assert.equal(result.calls.at(-1).args.p_status, retired ? 'skipped' : 'failed');
}

for (const [statuses, expected] of [
  [['dead'], 'skipped'],
  [['accepted'], 'sent'],
  [['dead', 'accepted'], 'sent'],
  [['pending'], 'failed'],
  [['failed'], 'failed'],
]) {
  result = await invoke({
    env: configured, claims: [job], attemptStatuses: statuses,
    rpcImpl: async (name) => name === 'claim_notification_deliveries'
      ? { data: [job], error: null }
      : name === 'prepare_notification_token_attempts'
        ? { data: [], error: null }
        : { data: null, error: null },
  });
  assert.equal(result.calls.at(-1).args.p_status, expected);
}

result = await invoke({ env: configured, claims: [{ ...job, tokens: [] }] });
assert.equal(result.calls.at(-1).args.p_status, 'skipped');
assert.equal(JSON.parse(result.body).sent, 0);

assert.match(source, /AbortSignal\.timeout\(15000\)/);
console.log('PASS worker auth, config, claim failure, mocked success, privacy-safe payload, provider rejection, timeout and no-token handling');
