// Local PGlite: community contributions draft migration.
// `node scripts/test-local-community-contributions.mjs`
import fs from 'node:fs';
import path from 'node:path';
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { loadResourceFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Baseline failed:', errors); process.exit(1); }
await loadResourceFixtures(db);
const migration = fs.readFileSync(path.join('supabase/migrations/20261026220000_community_contributions.sql'), 'utf8');
await db.exec(migration);

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, code, what) => ok(r.error && r.error.includes(code), `${what}: expected ${code}`);
const rpcJson = (who, fn, ...args) => tryAs(db, who, `select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')}) as j`, args);
const setReaction = (who, resourceId, reaction, anon) =>
  tryAs(db, who, 'select public.set_resource_reaction($1::uuid, $2, $3) as j', [resourceId, reaction, anon]);
const clearReaction = (who, resourceId) => tryAs(db, who, 'select public.clear_resource_reaction($1::uuid) as j', [resourceId]);
const submitContribution = (who, kind, payload, resourceId, jurisdiction, displayName, anon) =>
  tryAs(db, who, 'select * from public.submit_community_contribution($1, $2::jsonb, $3::uuid, $4, $5, $6)', [
    kind,
    JSON.stringify(payload),
    resourceId,
    jurisdiction,
    displayName,
    anon,
  ]);

const MEMBER = await addUser(db, 'contrib-member@test.local');
const MEMBER2 = await addUser(db, 'contrib-member2@test.local');
const ADMIN = await addUser(db, 'contrib-admin@test.local', 'admin');
await db.query(`update public.profiles set account_type = 'admin' where id = $1`, [ADMIN]);
const PANTRY = rid('pantry-cle-44113');

await test('guest can read reaction summary', async () => {
  const rows = must(await rpcJson('anon', 'get_resource_reaction_summary', PANTRY), 'summary');
  ok(rows[0].j.available === true, 'available');
});

await test('member sets reaction and summary shows my_reaction only to self', async () => {
  must(await setReaction(MEMBER, PANTRY, 'helpful', true), 'set');
  const mine = must(await rpcJson(MEMBER, 'get_resource_reaction_summary', PANTRY), 'mine');
  ok(mine[0].j.my_reaction === 'helpful', 'my reaction');
  const other = must(await rpcJson(MEMBER2, 'get_resource_reaction_summary', PANTRY), 'other');
  ok(other[0].j.my_reaction == null, 'no leak to other member');
  ok(Number(other[0].j.counts.helpful) >= 1, 'aggregate count visible');
});

await test('changing reaction replaces prior vote', async () => {
  must(await setReaction(MEMBER, PANTRY, 'worked', true), 'change');
  const mine = must(await rpcJson(MEMBER, 'get_resource_reaction_summary', PANTRY), 'changed');
  ok(mine[0].j.my_reaction === 'worked', 'updated reaction');
  const countRows = must(await db.query(`select count(*)::int as c from public.resource_reactions where user_id = $1 and resource_id = $2`, [MEMBER, PANTRY]), 'one row');
  ok(countRows[0].c === 1, 'single row per user/resource');
});

await test('clear reaction removes vote', async () => {
  must(await clearReaction(MEMBER, PANTRY), 'clear');
  const mine = must(await rpcJson(MEMBER, 'get_resource_reaction_summary', PANTRY), 'cleared');
  ok(mine[0].j.my_reaction == null, 'cleared');
});

await test('broken_link reaction queues pending edit contribution', async () => {
  must(await setReaction(MEMBER, PANTRY, 'broken_link', true), 'flag');
  const rows = must(await db.query(`select count(*)::int as c from public.community_contributions where contributor_id = $1 and resource_id = $2 and status = 'pending'`, [MEMBER, PANTRY]), 'contrib');
  ok(rows[0].c >= 1, 'pending contribution');
});

await test('private payload rejected on record relief contribution', async () => {
  denied(await submitContribution(MEMBER, 'record_relief_source', { case_number: 'X' }, null, 'US-OH', null, true), 'PRIVATE_INFO_REJECTED', 'private');
});

await test('member submits resource add contribution', async () => {
  const rows = must(
    await submitContribution(MEMBER, 'resource_add', { resource_name: 'New pantry', description: 'Free food', service_area: '44113' }, null, null, null, true),
    'add',
  );
  ok(rows[0].status === 'pending', 'pending');
});

await test('non-admin cannot list moderation queue', async () => {
  denied(await tryAs(db, MEMBER, 'select * from public.admin_list_community_contributions($1, $2)', ['pending', 10]), 'FORBIDDEN', 'list');
});

await test('admin reviews contribution', async () => {
  const pending = must(await tryAs(db, ADMIN, 'select * from public.admin_list_community_contributions($1, $2)', ['pending', 10]), 'list');
  ok(pending.length >= 1, 'queue rows');
  const reviewed = must(await tryAs(db, ADMIN, 'select * from public.admin_review_community_contribution($1::uuid, $2, $3)', [pending[0].id, 'needs_more_info', 'Need official URL']), 'review');
  ok(reviewed[0].status === 'needs_more_info', 'status updated');
});

await done();
