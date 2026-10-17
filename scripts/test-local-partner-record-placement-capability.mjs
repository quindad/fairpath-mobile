// Local (PGlite) proof for a real gap found by inspection, not guessing: `partner_record_placement`
// (supabase/migrations/20261007110000_job_placements.sql, ALREADY COMMITTED/possibly live) checks that the
// caller is an active owner/manager of the job's organization, but unlike the newer
// `partner_update_job_application_status` RPC, it never checks organization_capabilities for an active
// 'employment' capability. In plain terms: if staff revokes a company's ability to hire, a manager there can
// still permanently record "we hired this person" as placement evidence, because that check was only ever
// added to the status-update RPC, not to this one.
//
// IMPORTANT fixture detail: jobs.employer_id is always set to whoever CREATED the job, even for an org-owned
// job (confirmed against scripts/test-local-org-ownership.mjs). partner_record_placement's authorization check
// is `v_job.employer_id = uid OR (org membership check)` -- so if the same person both creates the job and
// later calls the RPC, they always pass via the individual-owner branch regardless of capability, and the org
// branch never actually gets exercised. To prove the ORG branch's gap specifically, the job must be created by
// a different account (CREATOR) than the manager being tested (ORG_MGR), so ORG_MGR's only path to
// authorization is through org membership + (missing) capability check.
//
// This file only PROVES the gap locally (ephemeral PGlite, nothing hosted touched). It does not fix it --
// fixing committed/possibly-deployed code needs founder approval first, per the standing safety rules.
//
// `node scripts/test-local-partner-record-placement-capability.mjs`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };

await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);

const MEMBER = await addUser(db, 'placement-member@test.local');
const CREATOR = await addUser(db, 'placement-creator@test.local'); // creates the job; NOT the manager under test
const ORG_MGR = await addUser(db, 'placement-org-mgr@test.local'); // a DIFFERENT, separately-authorized manager

await db.query(`insert into public.resource_organizations (id, name, slug, org_type, status, data_origin, fixture_set) values
  ('55555555-5555-4555-8555-555555555551','Revoked Capability Co','placement-revoked-co','employer','active','dev_fixture','placement-capability-test')`);
await db.query(`insert into public.organization_members (organization_id, user_id, member_role, status) values
  ('55555555-5555-4555-8555-555555555551', $1, 'manager', 'active'),
  ('55555555-5555-4555-8555-555555555551', $2, 'manager', 'active')`, [CREATOR, ORG_MGR]);
// The org's employment capability is explicitly REVOKED -- this org should not be able to hire anyone right now.
await db.query(`insert into public.organization_capabilities (organization_id, capability, status) values
  ('55555555-5555-4555-8555-555555555551','employment','revoked')`);

const job = (await db.query(
  `insert into public.jobs (employer_id, organization_id, title, description, company_name, employment_type, status, easy_apply_enabled, application_method)
   values ($1,$2,'Placement capability QA job','QA only','Revoked Capability Co','full_time','published',true,'fairpath') returning id`,
  [CREATOR, '55555555-5555-4555-8555-555555555551'],
)).rows[0].id;
const answers = JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Applicant', phone: '2165550100' }, employer_questions: {} });
must(await tryAs(db, MEMBER, 'select public.submit_job_application($1,$2)', [job, answers]), 'submit');
const appId = (await db.query('select id from public.job_applications where job_id=$1 and user_id=$2', [job, MEMBER])).rows[0].id;
// Advance to hired as ORG_MGR specifically (the manager under test, not the job's creator) -- this migration
// predates the status-transition RPC, so a direct UPDATE is the only way to reach 'hired' using just this
// file's own tooling, and the existing permissive RLS policy allows any active owner/manager to do it.
must(await tryAs(db, ORG_MGR, `update public.job_applications set status='hired' where id=$1`, [appId]), 'force to hired as ORG_MGR');

await test('GAP: a DIFFERENT manager (not the job creator) at an org with a REVOKED employment capability can still record a placement', async () => {
  const r = await tryAs(db, ORG_MGR, 'select public.partner_record_placement($1,20,$2,$3,$4)', [appId, 'hourly', 'full_time', 'QA']);
  if (r.error) {
    ok(false, 'If this fails, the gap is already closed -- re-check this test against current code before trusting it: ' + r.error);
  } else {
    ok(true, 'CONFIRMED: placement was recorded despite the revoked employment capability -- partner_record_placement has no capability check');
  }
});

done('local Postgres — partner_record_placement capability-check gap proof (read-only finding, NOTHING fixed or applied anywhere)');
await db.close();
