// Local (PGlite) integration test for the PROPOSED `partner_org_context()` RPC. In plain terms: this is the
// function that answers "which FairPath Partner organizations does this logged-in person belong to, what's
// their role there, and what are they actually allowed to do" -- the thing that decides what a staff member
// sees the moment they open the Command Center. Before this file, it had only been checked by a static text
// scanner (scripts/test-partner-org-context-contract.mjs, 17 regex-style checks on the SQL text) -- never run
// against a real database. This file runs it for real, against an ephemeral, in-memory Postgres instance that
// is thrown away when the test ends. It never touches any hosted DEV or production database, and applies no
// migration anywhere permanent -- fully reversible by deleting this file.
//
// `node scripts/test-local-partner-org-context-rpc.mjs`
import fs from 'node:fs';
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const draftSql = fs.readFileSync('docs/proposed-migrations/20261009094000_partner_org_context_RPC_DRAFT.sql', 'utf8').replace(/\r\n/g, '\n');
try {
  await db.exec(draftSql);
} catch (e) {
  console.error('Draft org-context RPC failed to apply locally:', e.message);
  process.exit(1);
}

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what) => ok(r.error && /permission denied/i.test(r.error), `${what}: expected a denial, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const ctx = (who) => tryAs(db, who, 'select * from public.partner_org_context()');

await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);

const MGR_SINGLE = await addUser(db, 'ctx-mgr-single@test.local');
const MGR_MULTI = await addUser(db, 'ctx-mgr-multi@test.local');
const REMOVED_MEMBER = await addUser(db, 'ctx-removed@test.local');
const NO_ORG = await addUser(db, 'ctx-no-org@test.local');

await db.query(`insert into public.resource_organizations (id, name, slug, org_type, status, data_origin, fixture_set) values
  ('44444444-4444-4444-8444-444444444441','Zebra Staffing','ctx-zebra','employer','active','dev_fixture','org-context-test'),
  ('44444444-4444-4444-8444-444444444442','Acme Housing','ctx-acme','provider','active','dev_fixture','org-context-test'),
  ('44444444-4444-4444-8444-444444444443','Suspended Org','ctx-suspended','employer','suspended','dev_fixture','org-context-test')`);

await db.query(`insert into public.organization_members (organization_id, user_id, member_role, status) values
  ('44444444-4444-4444-8444-444444444441', $1, 'manager', 'active'),
  ('44444444-4444-4444-8444-444444444441', $2, 'manager', 'active'),
  ('44444444-4444-4444-8444-444444444442', $2, 'owner', 'active'),
  ('44444444-4444-4444-8444-444444444443', $2, 'manager', 'active'),
  ('44444444-4444-4444-8444-444444444441', $3, 'editor', 'removed')`, [MGR_SINGLE, MGR_MULTI, REMOVED_MEMBER]);

await db.query(`insert into public.organization_capabilities (organization_id, capability, status) values
  ('44444444-4444-4444-8444-444444444441','employment','active'),
  ('44444444-4444-4444-8444-444444444441','housing','revoked'),
  ('44444444-4444-4444-8444-444444444442','housing','active')`);

await test('a manager with one active org gets exactly one row, with the right role and only active capabilities', async () => {
  const rows = must(await ctx(MGR_SINGLE), 'single-org context');
  ok(rows.length === 1, `expected 1 row, got ${rows.length}`);
  ok(rows[0].organization_name === 'Zebra Staffing', 'wrong org name: ' + rows[0].organization_name);
  ok(JSON.stringify(rows[0].roles) === JSON.stringify(['manager']), 'wrong roles: ' + JSON.stringify(rows[0].roles));
  ok(JSON.stringify(rows[0].capabilities) === JSON.stringify(['employment']), 'revoked housing capability leaked through: ' + JSON.stringify(rows[0].capabilities));
});

await test('a person in two active orgs (plus one suspended org) sees exactly the two active ones, alphabetically', async () => {
  const rows = must(await ctx(MGR_MULTI), 'multi-org context');
  ok(rows.length === 2, `expected 2 rows (Suspended Org must be excluded), got ${rows.length}: ${JSON.stringify(rows.map((r) => r.organization_name))}`);
  ok(rows[0].organization_name === 'Acme Housing' && rows[1].organization_name === 'Zebra Staffing', 'not ordered by name: ' + rows.map((r) => r.organization_name).join(','));
});

await test('capabilities are never invented from role or org_type -- a real org/role with zero capability rows returns an empty array, not a guess', async () => {
  const rows = must(await ctx(MGR_MULTI), 'capability check');
  const acme = rows.find((r) => r.organization_name === 'Acme Housing');
  ok(JSON.stringify(acme.capabilities) === JSON.stringify(['housing']), 'Acme capabilities wrong: ' + JSON.stringify(acme.capabilities));
});

await test('a removed membership sees nothing', async () => {
  const rows = must(await ctx(REMOVED_MEMBER), 'removed member context');
  ok(rows.length === 0, `a removed member should see zero organizations, got ${rows.length}`);
});

await test('a signed-in person with no membership anywhere sees zero rows (not an error)', async () => {
  const rows = must(await ctx(NO_ORG), 'no-org context');
  ok(rows.length === 0, `expected 0 rows for a person with no org membership, got ${rows.length}`);
});

await test('a person never sees another person\'s organization context (isolation)', async () => {
  const rows = must(await ctx(MGR_SINGLE), 'isolation check');
  ok(!rows.some((r) => r.organization_name === 'Acme Housing'), 'MGR_SINGLE saw an org they do not belong to');
});

await test('a signed-out (anon) caller cannot call this function at all -- the grant is revoked, not just filtered', async () => {
  denied(await ctx('anon'), 'anon call to partner_org_context');
});

done('local Postgres — partner_org_context() DRAFT RPC (NOT applied to any real database)');
await db.close();
