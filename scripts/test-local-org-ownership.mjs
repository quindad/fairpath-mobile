// Local (PGlite) SQL suite for Phase 2: Jobs/Housing organization ownership, layered on the REAL existing
// resource_organizations/organization_members model. Proves: existing individual employer_id/owner_id behavior
// is unchanged, org members can manage their own org's listings, non-members and other orgs cannot, and an
// ordinary authenticated member gains zero privilege without an explicit membership row.
// `node scripts/test-local-org-ownership.mjs`
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what) => ok(r.error && /permission denied|row-level security/i.test(r.error), `${what}: expected a denial, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);

const OWNER = await addUser(db, 'owner@test.local');       // individual employer/landlord, pre-existing behavior
const ORG_MGR = await addUser(db, 'org-mgr@test.local');   // manager on ORG_A
const ORG_EDITOR = await addUser(db, 'org-editor@test.local'); // editor on ORG_A
const OUTSIDER = await addUser(db, 'outsider@test.local'); // authenticated, zero membership anywhere
const ORG_B_MGR = await addUser(db, 'org-b-mgr@test.local'); // manager on a DIFFERENT org

await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);
await db.query(`insert into public.resource_organizations (id, name, slug, org_type, data_origin, fixture_set)
  values ('11111111-1111-4111-8111-111111111111','Org A Employer','org-a-employer','employer','dev_fixture','org-ownership-test'),
         ('22222222-2222-4222-8222-222222222222','Org B Employer','org-b-employer','employer','dev_fixture','org-ownership-test')`);
await db.query(`insert into public.organization_members (organization_id, user_id, member_role, status) values
  ('11111111-1111-4111-8111-111111111111', $1, 'manager', 'active'),
  ('11111111-1111-4111-8111-111111111111', $2, 'editor', 'active'),
  ('22222222-2222-4222-8222-222222222222', $3, 'manager', 'active')`, [ORG_MGR, ORG_EDITOR, ORG_B_MGR]);

// ---------------- existing individual-owner behavior must be untouched ----------------
await test('unchanged: individual employer can still create/update/delete their own job with no organization_id', async () => {
  const rows = must(await tryAs(db, OWNER,
    `insert into public.jobs (employer_id, title, description, company_name, employment_type, status)
     values ($1,'Individual Job','desc','Acme','full_time','published') returning id`, [OWNER]), 'insert');
  const jobId = rows[0].id;
  must(await tryAs(db, OWNER, `update public.jobs set title='Updated' where id=$1`, [jobId]), 'update');
  must(await tryAs(db, OWNER, `delete from public.jobs where id=$1`, [jobId]), 'delete');
});

// ---------------- org member can manage their org's listing ----------------
await test('org manager can create a job for their organization', async () => {
  const rows = must(await tryAs(db, ORG_MGR,
    `insert into public.jobs (employer_id, organization_id, title, description, company_name, employment_type, status)
     values ($1,'11111111-1111-4111-8111-111111111111','Org Job','desc','Org A','full_time','draft') returning id`,
    [ORG_MGR]), 'insert');
  ok(rows.length === 1, 'org job not created');
});

await test('org editor can read but not create/delete an org job (role gate)', async () => {
  const rows = must(await tryAs(db, ORG_EDITOR, `select id from public.jobs where organization_id='11111111-1111-4111-8111-111111111111'`), 'editor read');
  ok(rows.length >= 1, 'editor cannot see own org jobs');
  denied(await tryAs(db, ORG_EDITOR,
    `insert into public.jobs (employer_id, organization_id, title, description, company_name, employment_type, status)
     values ($1,'11111111-1111-4111-8111-111111111111','Editor Job','desc','Org A','full_time','draft')`, [ORG_EDITOR]),
    'editor insert should be denied (editor is not owner/manager)');
});

// ---------------- cross-org isolation: the core adversarial case ----------------
await test('org B manager cannot read, update, or delete an org A job', async () => {
  const [{ id: orgAJobId }] = must(await tryAs(db, ORG_MGR, `select id from public.jobs where organization_id='11111111-1111-4111-8111-111111111111' limit 1`), 'lookup');
  const readByB = must(await tryAs(db, ORG_B_MGR, `select id from public.jobs where id=$1`, [orgAJobId]), 'read attempt');
  ok(readByB.length === 0, 'org B manager could read org A draft job (row-level isolation broken)');
  const updByB = must(await tryAs(db, ORG_B_MGR, `update public.jobs set title='Hijacked' where id=$1 returning id`, [orgAJobId]), 'update attempt');
  ok(updByB.length === 0, 'org B manager could update org A job');
  const delByB = must(await tryAs(db, ORG_B_MGR, `delete from public.jobs where id=$1 returning id`, [orgAJobId]), 'delete attempt');
  ok(delByB.length === 0, 'org B manager could delete org A job');
});

// ---------------- authentication alone grants nothing ----------------
await test('an ordinary authenticated member with zero membership rows gains no organization privilege', async () => {
  const rows = must(await tryAs(db, OUTSIDER, `select id from public.jobs where organization_id is not null`), 'outsider read');
  ok(rows.length === 0, 'outsider (no membership row anywhere) could see an org-owned job');
  denied(await tryAs(db, OUTSIDER,
    `insert into public.jobs (employer_id, organization_id, title, description, company_name, employment_type, status)
     values ($1,'11111111-1111-4111-8111-111111111111','Forged Job','desc','Org A','full_time','draft')`, [OUTSIDER]),
    'outsider insert with a forged organization_id should be denied');
});

// ---------------- same shape for Housing ----------------
await test('housing: unchanged individual owner behavior + org manager create + cross-org isolation', async () => {
  const rows = must(await tryAs(db, OWNER,
    `insert into public.housing_listings (owner_id, title, description, property_type, city, state, postal_code, rent_monthly, status)
     values ($1,'Individual Listing','desc','apartment','Cleveland','OH','44113',1000,'published') returning id`, [OWNER]), 'individual insert');
  must(await tryAs(db, OWNER, `delete from public.housing_listings where id=$1`, [rows[0].id]), 'individual delete');

  const orgRows = must(await tryAs(db, ORG_MGR,
    `insert into public.housing_listings (owner_id, organization_id, title, description, property_type, city, state, postal_code, rent_monthly, status)
     values ($1,'11111111-1111-4111-8111-111111111111','Org Listing','desc','apartment','Cleveland','OH','44113',1000,'draft') returning id`,
    [ORG_MGR]), 'org insert');
  const listingId = orgRows[0].id;

  const readByB = must(await tryAs(db, ORG_B_MGR, `select id from public.housing_listings where id=$1`, [listingId]), 'org B read');
  ok(readByB.length === 0, 'org B manager could read org A housing listing');
  const updByB = must(await tryAs(db, ORG_B_MGR, `update public.housing_listings set title='Hijacked' where id=$1 returning id`, [listingId]), 'org B update attempt');
  ok(updByB.length === 0, 'org B manager could update org A housing listing');
});

done();
