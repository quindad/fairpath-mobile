// Local (PGlite) SQL suite for Resources: guest search + member state (saved / progress / reports), against the real
// migration SQL, grants and RLS. `npm run test:sql:resources`
import { addUser, asRole, createLocalDb, tryAs } from './lib/local-db.mjs';
import { loadResourceFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
await loadResourceFixtures(db);

const A = await addUser(db, 'a@test.local');
const B = await addUser(db, 'b@test.local');
const PANTRY = rid('pantry-cle-44113'), SHELTER = rid('shelter-cle-24h'), CLINIC = rid('clinic-cle'), HIDDEN = rid('pantry-unverified');
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);

// ---------------- guest search ----------------
await test('guest: search returns verified fresh/stale only and never hidden states', async () => {
  const rows = must(await rpc('anon', 'search_resources', null, null, 25, null, false, false, null, true, 50, 0), 'search');
  ok(rows.length > 40, 'expected the visible fixtures, got ' + rows.length);
  const ids = rows.map((r) => r.resource_row.id);
  for (const k of ['pantry-unverified', 'legal-unverified', 'benefits-bal', 'rejected-example', 'retired-example', 'pantry-cle-expired']) ok(!ids.includes(rid(k)), k + ' leaked');
  ok(rows.every((r) => ['fresh', 'stale'].includes(r.resource_row.freshness)), 'freshness leak');
});
await test('guest: base tables are closed', async () => {
  for (const t of ['resources', 'resource_locations', 'resource_verification_events', 'resource_reports', 'saved_resources']) {
    const r = await tryAs(db, 'anon', `select * from public.${t} limit 1`);
    ok(r.error || r.rows.length === 0, t + ' readable by anon');
  }
});
await test('guest: cannot call member functions', async () => {
  for (const [fn, a] of [['save_resource', [PANTRY]], ['set_resource_progress', [PANTRY, 'started']], ['report_resource', [PANTRY, 'closed', null]], ['my_resource_counts', []], ['list_my_saved_resources', [50, 0]]]) {
    denied(await rpc('anon', fn, ...a), 'permission denied', fn);
  }
});
await test('ranking: "somewhere to stay" puts the shelter above the meals program', async () => {
  const rows = must(await rpc('anon', 'search_resources', 'somewhere to stay', '44113', 25, null, false, false, null, true, 50, 0), 'search').map((r) => r.resource_row.id);
  ok(rows.indexOf(SHELTER) >= 0 && rows.indexOf(SHELTER) < rows.indexOf(rid('kitchen-cle-meals')), 'ranking wrong: ' + rows.slice(0, 4));
});
await test('national toggle: include_national=false hides national + virtual (fix migration 2b)', async () => {
  const on = must(await rpc('anon', 'search_resources', null, '44113', 25, null, false, false, null, true, 50, 0), 'on').map((r) => r.resource_row.id);
  const off = must(await rpc('anon', 'search_resources', null, '44113', 25, null, false, false, null, false, 50, 0), 'off').map((r) => r.resource_row.id);
  ok(on.includes(rid('id-help-national')) && !off.includes(rid('id-help-national')) && !off.includes(rid('ged-online')), 'toggle broken');
});

// ---------------- member state ----------------
await test('member: save is idempotent, list shows it as available with a full card', async () => {
  must(await rpc(A, 'save_resource', PANTRY), 'save');
  must(await rpc(A, 'save_resource', PANTRY), 'save again');
  const rows = must(await rpc(A, 'list_my_saved_resources', 50, 0), 'list');
  ok(rows.length === 1 && rows[0].available && rows[0].resource_row.id === PANTRY && rows[0].resource_row.organization.name, 'saved list wrong');
  const st = must(await rpc(A, 'my_resource_states', [PANTRY, SHELTER]), 'states');
  ok(st.find((r) => r.resource_id === PANTRY).is_saved && !st.find((r) => r.resource_id === SHELTER).is_saved, 'flags wrong');
});
await test('member: cannot save unverified or unknown resources', async () => {
  denied(await rpc(A, 'save_resource', HIDDEN), 'RESOURCE_UNAVAILABLE', 'hidden');
  denied(await rpc(A, 'save_resource', '00000000-0000-4000-8000-000000000000'), 'RESOURCE_UNAVAILABLE', 'unknown');
});
await test('member: direct writes to member tables are denied (forgery)', async () => {
  denied(await tryAs(db, A, `insert into public.saved_resources (user_id, resource_id) values ($1, $2)`, [A, SHELTER]), 'permission denied', 'saved insert');
  denied(await tryAs(db, A, `insert into public.resource_interactions (user_id, resource_id, state, completed_at) values ($1, $2, 'completed', now())`, [A, SHELTER]), 'permission denied', 'interaction insert');
  denied(await tryAs(db, A, `insert into public.resource_reports (user_id, resource_id, reason) values ($1, $2, 'closed')`, [A, SHELTER]), 'permission denied', 'report insert');
  denied(await tryAs(db, A, `delete from public.saved_resources where user_id = $1`, [A]), 'permission denied', 'saved delete');
});
await test("member isolation: B sees none of A's saved/progress/reports/counts", async () => {
  ok(must(await rpc(B, 'list_my_saved_resources', 50, 0), 'b list').length === 0, "B sees A's saved list");
  ok(must(await tryAs(db, B, 'select * from public.saved_resources'), 'b direct').length === 0, "B reads A's rows");
  ok(must(await rpc(B, 'my_resource_states', [PANTRY]), 'b states')[0].is_saved === false, "B sees A's flag");
  ok(Number(must(await rpc(B, 'my_resource_counts'), 'b counts')[0].saved_count) === 0, "B's counts include A's data");
});
await test('progress: state machine, clear, invalid state, unavailable rules, counts', async () => {
  must(await rpc(A, 'set_resource_progress', SHELTER, 'started'), 'start');
  let row = must(await tryAs(db, A, 'select state, completed_at from public.resource_interactions where resource_id = $1', [SHELTER]), 'row')[0];
  ok(row.state === 'started' && row.completed_at === null, 'started wrong');
  must(await rpc(A, 'set_resource_progress', SHELTER, 'completed'), 'complete');
  row = must(await tryAs(db, A, 'select state, completed_at from public.resource_interactions where resource_id = $1', [SHELTER]), 'row')[0];
  ok(row.state === 'completed' && row.completed_at, 'completed wrong');
  must(await rpc(A, 'set_resource_progress', SHELTER, 'started'), 'restart');
  row = must(await tryAs(db, A, 'select state, completed_at from public.resource_interactions where resource_id = $1', [SHELTER]), 'row')[0];
  ok(row.state === 'started' && row.completed_at === null, 'restart must clear completed_at');
  denied(await rpc(A, 'set_resource_progress', SHELTER, 'won'), 'INVALID_STATE', 'invalid');
  denied(await rpc(A, 'set_resource_progress', HIDDEN, 'started'), 'RESOURCE_UNAVAILABLE', 'hidden start');
  must(await rpc(A, 'set_resource_progress', HIDDEN, 'cleared'), 'clear hidden');
  const c = must(await rpc(A, 'my_resource_counts'), 'counts')[0];
  ok(Number(c.saved_count) === 1 && Number(c.started_count) === 1 && Number(c.completed_count) === 0, 'counts ' + JSON.stringify(c));
  must(await rpc(A, 'set_resource_progress', SHELTER, 'completed'), 'complete again');
  const done = must(await rpc(A, 'list_my_resource_progress', 'completed', 50, 0), 'progress list');
  ok(done.length === 1 && done[0].progress === 'completed', 'progress list wrong');
  must(await rpc(A, 'set_resource_progress', SHELTER, 'cleared'), 'clear');
  ok(must(await tryAs(db, A, 'select * from public.resource_interactions'), 'left').length === 0, 'clear must delete');
});
await test('reports: validation, dedupe, trimming, history event, note privacy', async () => {
  denied(await rpc(A, 'report_resource', PANTRY, 'because', null), 'INVALID_REASON', 'reason');
  denied(await rpc(A, 'report_resource', HIDDEN, 'closed', null), 'RESOURCE_UNAVAILABLE', 'hidden');
  must(await rpc(A, 'report_resource', PANTRY, 'wrong_info', '  ' + 'x'.repeat(900)), 'report');
  must(await rpc(A, 'report_resource', PANTRY, 'wrong_info', 'again'), 'dup');
  const rows = (await db.query(`select note, status from public.resource_reports where user_id = $1 and resource_id = $2`, [A, PANTRY])).rows;
  ok(rows.length === 1 && rows[0].note.length === 500 && rows[0].status === 'open', 'dedupe/trim wrong');
  const ev = (await db.query(`select actor_id from public.resource_verification_events where resource_id = $1 and event_type = 'reported'`, [PANTRY])).rows;
  ok(ev.some((e) => e.actor_id === A), 'history event missing');
  ok(must(await tryAs(db, A, 'select id, reason from public.resource_reports'), 'own').length === 1, 'member should see own report');
  ok((await tryAs(db, A, 'select note from public.resource_reports')).error?.includes('permission denied'), 'note must not be readable');
  ok(must(await tryAs(db, B, 'select id from public.resource_reports'), 'b').length === 0, "B reads A's reports");
});
await test('reports are rate limited at 10 per 24h', async () => {
  let sent = 1;
  outer: for (const res of [PANTRY, SHELTER, CLINIC]) for (const reason of ['wrong_info', 'closed', 'unsafe', 'scam_or_fee', 'other']) {
    if (res === PANTRY && reason === 'wrong_info') continue;
    if (sent >= 10) break outer;
    must(await rpc(A, 'report_resource', res, reason, null), 'report ' + (sent + 1));
    sent++;
  }
  denied(await rpc(A, 'report_resource', CLINIC, 'other', 'too many'), 'REPORT_RATE_LIMIT', 'limit');
});
await test('a saved resource that stops being visible reveals nothing and can be removed', async () => {
  await db.query(`update public.resources set publish_status = 'retired' where id = $1`, [PANTRY]);
  const row = must(await rpc(A, 'list_my_saved_resources', 50, 0), 'list').find((r) => r.resource_row.id === PANTRY);
  ok(row && row.available === false && Object.keys(row.resource_row).join() === 'id', 'unavailable card leaked: ' + JSON.stringify(row));
  must(await rpc(A, 'unsave_resource', PANTRY), 'unsave');
  await db.query(`update public.resources set publish_status = 'published' where id = $1`, [PANTRY]);
});
await test('deleting a member cascades member state and anonymizes (not deletes) verification history', async () => {
  const before = (await db.query(`select count(*)::int as n from public.resource_verification_events where event_type = 'reported'`)).rows[0].n;
  await db.query('delete from auth.users where id = $1', [A]); // would throw if the append-only trigger blocked the actor_id SET NULL
  for (const t of ['saved_resources', 'resource_interactions', 'resource_reports']) {
    ok((await db.query(`select 1 from public.${t} where user_id = $1`, [A])).rows.length === 0, t + ' rows survived');
  }
  const after = (await db.query(`select actor_id from public.resource_verification_events where event_type = 'reported'`)).rows;
  ok(after.length === before && after.every((e) => e.actor_id !== A), 'history must be kept and anonymized');
});
await test('append-only history still rejects any other update', async () => {
  const r = await tryAs(db, 'service', `update public.resource_verification_events set notes = 'tampered' where event_type = 'reported'`);
  ok(r.error, 'notes must not be editable');
});
await test('fixture guard: dev_fixture rows are rejected when the environment is not dev', async () => {
  await db.query(`update public.app_config set value = '"production"'::jsonb where key = 'environment'`);
  let blocked = false;
  try {
    await db.query(`insert into public.resource_organizations (name, slug, data_origin, fixture_set) values ('Nope Org', 'nope-org', 'dev_fixture', 'x')`);
  } catch { blocked = true; }
  await db.query(`update public.app_config set value = '"dev"'::jsonb where key = 'environment'`);
  ok(blocked, 'production must reject dev fixtures');
  await db.query(`delete from public.app_config where key = 'environment'`);
  blocked = false;
  try { await db.query(`insert into public.resource_organizations (name, slug, data_origin, fixture_set) values ('Nope Org', 'nope-org2', 'dev_fixture', 'x')`); } catch { blocked = true; }
  ok(blocked, 'an unset environment must also reject dev fixtures');
});

done('local Postgres');
