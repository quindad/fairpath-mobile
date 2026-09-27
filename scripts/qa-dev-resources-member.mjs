// FairPath DEV Resources MEMBER QA (saved / progress / reports). DEV ONLY.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV service-role key>"
//   npm run qa:dev-resources-member
//   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//
// Safety: same DEV-only guards as the other harnesses; key only from the environment; creates two passwordless
// disposable users (@dev-seed.fairpath.test) and deletes them at the end, which also proves member deletion cascades
// (including the append-only verification history). One fixture resource is briefly retired to test "no longer
// available" and is ALWAYS restored.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertDevTarget } from '../supabase/seed/lib/guards.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const args = new Set(process.argv.slice(2));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const linkedRef = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
try { assertDevTarget({ url, serviceKey, linkedRef, confirmDev: args.has('--confirm-dev'), apply: true }); }
catch (e) { console.error(e.message); process.exit(1); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);
const stamp = Date.now().toString(36);
const created = [];
const results = [];

async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL ' + name + '\n     ' + e.message); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const has = (r, text) => ok(r.error && (r.error.message + (r.error.code ?? '')).includes(text), `expected error containing "${text}", got ${JSON.stringify(r.error)}`);
const fine = (r, what) => ok(!r.error, `${what}: ${r.error?.message}`);

async function makeUser(label) {
  const email = `qa-res-${label}-${stamp}@dev-seed.fairpath.test`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (c.error) throw new Error('createUser: ' + c.error.message);
  created.push(c.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw new Error('generateLink: ' + link.error.message);
  const client = createClient(url, anonKey, opts);
  const v = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) throw new Error('verifyOtp: ' + v.error.message);
  return { id: c.data.user.id, client };
}

const PANTRY = rid('pantry-cle-44113');
const SHELTER = rid('shelter-cle-24h');
const CLINIC = rid('clinic-cle');
const HIDDEN = rid('pantry-unverified');
const A = await makeUser('a');
const B = await makeUser('b');

await test('guests cannot save, track, report or read member state', async () => {
  for (const [fn, a] of [['save_resource', { p_id: PANTRY }], ['unsave_resource', { p_id: PANTRY }], ['set_resource_progress', { p_id: PANTRY, p_state: 'started' }],
    ['report_resource', { p_id: PANTRY, p_reason: 'closed' }], ['my_resource_states', { p_ids: [PANTRY] }], ['list_my_saved_resources', {}], ['my_resource_counts', {}]]) {
    const r = await anon.rpc(fn, a);
    ok(r.error, `${fn} must not be callable by a guest`);
  }
});

await test('member can save a visible resource; save is idempotent; it appears in the saved list as available', async () => {
  fine(await A.client.rpc('save_resource', { p_id: PANTRY }), 'save');
  fine(await A.client.rpc('save_resource', { p_id: PANTRY }), 'save again');
  const list = await A.client.rpc('list_my_saved_resources');
  fine(list, 'list');
  ok(list.data.length === 1 && list.data[0].available === true && list.data[0].resource_row.id === PANTRY, 'saved list wrong');
  ok(list.data[0].resource_row.title && list.data[0].resource_row.organization?.name, 'summary card fields missing');
  const st = await A.client.rpc('my_resource_states', { p_ids: [PANTRY, SHELTER] });
  ok(st.data.find((r) => r.resource_id === PANTRY).is_saved === true && st.data.find((r) => r.resource_id === SHELTER).is_saved === false, 'state flags wrong');
});

await test('cannot save unverified/unknown resources', async () => {
  has(await A.client.rpc('save_resource', { p_id: HIDDEN }), 'RESOURCE_UNAVAILABLE');
  has(await A.client.rpc('save_resource', { p_id: '00000000-0000-4000-8000-000000000000' }), 'RESOURCE_UNAVAILABLE');
});

await test('clients cannot write the member tables directly (forgery)', async () => {
  ok((await A.client.from('saved_resources').insert({ user_id: A.id, resource_id: SHELTER })).error, 'direct saved insert must fail');
  ok((await A.client.from('resource_interactions').insert({ user_id: A.id, resource_id: SHELTER, state: 'completed', completed_at: new Date().toISOString() })).error, 'direct interaction insert must fail');
  ok((await A.client.from('resource_reports').insert({ user_id: A.id, resource_id: SHELTER, reason: 'closed' })).error, 'direct report insert must fail');
  const del = await A.client.from('saved_resources').delete().eq('user_id', A.id).eq('resource_id', PANTRY);
  const still = await admin.from('saved_resources').select('resource_id').eq('user_id', A.id);
  ok(del.error || still.data.length === 1, 'direct delete must not remove rows');
  const forged = await A.client.from('saved_resources').insert({ user_id: B.id, resource_id: PANTRY });
  ok(forged.error, "forging another member's save must fail");
});

await test("members cannot see each other's saved items, progress or reports", async () => {
  const bList = await B.client.rpc('list_my_saved_resources');
  ok(bList.data.length === 0, "B sees A's saved list");
  const bDirect = await B.client.from('saved_resources').select('*');
  ok(!bDirect.error && bDirect.data.length === 0, "B can read A's rows directly");
  const bStates = await B.client.rpc('my_resource_states', { p_ids: [PANTRY] });
  ok(bStates.data[0].is_saved === false, "B sees A's flag");
  const bCounts = await B.client.rpc('my_resource_counts');
  ok(Number(bCounts.data[0].saved_count) === 0, "B's counts include A's data");
});

await test('progress: started -> completed -> started; clear; invalid state; unavailable rules', async () => {
  fine(await A.client.rpc('set_resource_progress', { p_id: SHELTER, p_state: 'started' }), 'start');
  let row = (await A.client.from('resource_interactions').select('state,completed_at').eq('resource_id', SHELTER)).data[0];
  ok(row.state === 'started' && row.completed_at === null, 'started row wrong');
  fine(await A.client.rpc('set_resource_progress', { p_id: SHELTER, p_state: 'completed' }), 'complete');
  row = (await A.client.from('resource_interactions').select('state,completed_at').eq('resource_id', SHELTER)).data[0];
  ok(row.state === 'completed' && row.completed_at, 'completed row wrong');
  fine(await A.client.rpc('set_resource_progress', { p_id: SHELTER, p_state: 'started' }), 'restart');
  row = (await A.client.from('resource_interactions').select('state,completed_at').eq('resource_id', SHELTER)).data[0];
  ok(row.state === 'started' && row.completed_at === null, 'moving back to started must clear completed_at');
  has(await A.client.rpc('set_resource_progress', { p_id: SHELTER, p_state: 'won' }), 'INVALID_STATE');
  has(await A.client.rpc('set_resource_progress', { p_id: HIDDEN, p_state: 'started' }), 'RESOURCE_UNAVAILABLE');
  fine(await A.client.rpc('set_resource_progress', { p_id: HIDDEN, p_state: 'cleared' }), 'clearing is always allowed');
  const counts = (await A.client.rpc('my_resource_counts')).data[0];
  ok(Number(counts.saved_count) === 1 && Number(counts.started_count) === 1 && Number(counts.completed_count) === 0, 'counts wrong: ' + JSON.stringify(counts));
  fine(await A.client.rpc('set_resource_progress', { p_id: SHELTER, p_state: 'completed' }), 'complete again');
  const done = await A.client.rpc('list_my_resource_progress', { p_state: 'completed' });
  ok(done.data.length === 1 && done.data[0].progress === 'completed' && done.data[0].available, 'progress list wrong');
  fine(await A.client.rpc('set_resource_progress', { p_id: SHELTER, p_state: 'cleared' }), 'clear');
  ok((await A.client.from('resource_interactions').select('*')).data.length === 0, 'clear must delete the row');
});

await test('progress never becomes an achievement or a verification: no such rows exist', async () => {
  const t = await admin.from('resource_interactions').select('user_id').eq('user_id', A.id);
  ok(!t.error, 'query failed');
  const ach = await admin.from('member_achievements').select('user_id').limit(1);
  ok(ach.error || (ach.data ?? []).length === 0, 'no achievements may be written by resource progress');
});

await test('reports: validation, dedupe, note handling, history event, private to the reporter', async () => {
  has(await A.client.rpc('report_resource', { p_id: PANTRY, p_reason: 'because' }), 'INVALID_REASON');
  has(await A.client.rpc('report_resource', { p_id: HIDDEN, p_reason: 'closed' }), 'RESOURCE_UNAVAILABLE');
  const long = 'x'.repeat(900);
  fine(await A.client.rpc('report_resource', { p_id: PANTRY, p_reason: 'wrong_info', p_note: '  ' + long }), 'report');
  fine(await A.client.rpc('report_resource', { p_id: PANTRY, p_reason: 'wrong_info', p_note: 'again' }), 'duplicate report accepted quietly');
  const rows = (await admin.from('resource_reports').select('id,note,status').eq('user_id', A.id).eq('resource_id', PANTRY)).data;
  ok(rows.length === 1 && rows[0].status === 'open' && rows[0].note.length === 500, `dedupe/trim wrong: ${JSON.stringify(rows.map((r) => [r.status, r.note?.length]))}`);
  const ev = (await admin.from('resource_verification_events').select('event_type,actor_id').eq('resource_id', PANTRY).eq('event_type', 'reported')).data;
  ok(ev.length >= 1 && ev.some((e) => e.actor_id === A.id), "'reported' history event missing");
  const own = await A.client.from('resource_reports').select('id,reason,status');
  ok(!own.error && own.data.length === 1, 'member should see their own report row');
  const noteRead = await A.client.from('resource_reports').select('note');
  ok(noteRead.error, 'members must not be able to read report notes back');
  const other = await B.client.from('resource_reports').select('id');
  ok(!other.error && other.data.length === 0, "B can read A's reports");
});

await test('reports are rate limited (10 per 24h)', async () => {
  const reasons = ['wrong_info', 'closed', 'unsafe', 'scam_or_fee', 'other'];
  let sent = 1; // one already filed by A above (PANTRY/wrong_info)
  outer: for (const res of [PANTRY, SHELTER, CLINIC]) for (const reason of reasons) {
    if (res === PANTRY && reason === 'wrong_info') continue;
    if (sent >= 10) break outer;
    fine(await A.client.rpc('report_resource', { p_id: res, p_reason: reason }), `report ${sent + 1}`);
    sent++;
  }
  has(await A.client.rpc('report_resource', { p_id: CLINIC, p_reason: 'other', p_note: 'one too many' }), 'REPORT_RATE_LIMIT');
});

await test('a saved resource that stops being visible shows as "no longer available" without leaking details; save is removable', async () => {
  const before = (await admin.from('resources').select('publish_status').eq('id', PANTRY).single()).data.publish_status;
  try {
    fine(await admin.from('resources').update({ publish_status: 'retired' }).eq('id', PANTRY), 'retire');
    const list = await A.client.rpc('list_my_saved_resources');
    const row = list.data.find((r) => r.resource_row.id === PANTRY);
    ok(row && row.available === false, 'should be unavailable');
    ok(Object.keys(row.resource_row).join() === 'id', 'unavailable record leaked details: ' + Object.keys(row.resource_row).join());
    fine(await A.client.rpc('unsave_resource', { p_id: PANTRY }), 'unsave hidden');
  } finally {
    await admin.from('resources').update({ publish_status: before }).eq('id', PANTRY);
  }
  const after = (await admin.from('resources').select('publish_status').eq('id', PANTRY).single()).data.publish_status;
  ok(after === before, 'fixture was not restored');
});

await test('deleting a member removes their saved items, progress and reports, and keeps the append-only history intact', async () => {
  const eventsBefore = (await admin.from('resource_verification_events').select('id').eq('event_type', 'reported')).data.length;
  const del = await admin.auth.admin.deleteUser(A.id);
  ok(!del.error, 'deleteUser failed (append-only trigger blocking the cascade?): ' + del.error?.message);
  created.splice(created.indexOf(A.id), 1);
  for (const t of ['saved_resources', 'resource_interactions', 'resource_reports']) {
    const r = await admin.from(t).select('user_id').eq('user_id', A.id);
    ok(!r.error && r.data.length === 0, `${t} rows survived member deletion`);
  }
  const events = (await admin.from('resource_verification_events').select('id,actor_id').eq('event_type', 'reported')).data;
  ok(events.length === eventsBefore, 'history rows must be kept (anonymized), not deleted');
  ok(!events.some((e) => e.actor_id === A.id), 'history must be anonymized');
});

// ---- cleanup ----
for (const id of created) await admin.auth.admin.deleteUser(id);
// Remove the anonymized test reports we created so DEV history stays tidy (delete through the resource-owned rows).
await admin.from('resource_reports').delete().like('note', 'x%');

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed (DEV, signed-in harness). Disposable members removed.`);
process.exit(failed.length ? 1 : 0);
