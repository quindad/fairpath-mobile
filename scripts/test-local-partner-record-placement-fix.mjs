// Local proof that the DRAFT fix (docs/proposed-migrations/20261013010000_..._DRAFT.sql) actually closes the
// capability-check gap proven in scripts/test-local-partner-record-placement-capability.mjs, without breaking
// the normal, authorized hire-recording path. Ephemeral PGlite only; nothing hosted touched.
//
// Jobs are created by a separate CREATOR account in every case, never by the manager under test -- otherwise
// jobs.employer_id (always the creator) lets that manager through via the individual-owner branch regardless
// of org capability, masking the thing this test is supposed to prove. See the capability-gap test file for
// the full explanation of that fixture pitfall.
//
// `node scripts/test-local-partner-record-placement-fix.mjs`
import fs from 'node:fs';
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const fixSql = fs.readFileSync('docs/proposed-migrations/20261013010000_partner_record_placement_capability_check_DRAFT.sql', 'utf8').replace(/\r\n/g, '\n');
try { await db.exec(fixSql); } catch (e) { console.error('Fix failed to apply locally:', e.message); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what) => ok(r.error && /NOT_AUTHORIZED/.test(r.error), `${what}: expected NOT_AUTHORIZED, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);

await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);
const MEMBER = await addUser(db, 'fix-member@test.local');
const CREATOR = await addUser(db, 'fix-creator@test.local'); // creates every job; never the manager under test
const GOOD_MGR = await addUser(db, 'fix-good-mgr@test.local');
const REVOKED_MGR = await addUser(db, 'fix-revoked-mgr@test.local');

await db.query(`insert into public.resource_organizations (id, name, slug, org_type, status, data_origin, fixture_set) values
  ('66666666-6666-4666-8666-666666666661','Good Co','fix-good-co','employer','active','dev_fixture','placement-fix-test'),
  ('66666666-6666-4666-8666-666666666662','Revoked Co','fix-revoked-co','employer','active','dev_fixture','placement-fix-test')`);
await db.query(`insert into public.organization_members (organization_id, user_id, member_role, status) values
  ('66666666-6666-4666-8666-666666666661', $1, 'manager', 'active'),
  ('66666666-6666-4666-8666-666666666661', $2, 'manager', 'active'),
  ('66666666-6666-4666-8666-666666666662', $1, 'manager', 'active'),
  ('66666666-6666-4666-8666-666666666662', $3, 'manager', 'active')`, [CREATOR, GOOD_MGR, REVOKED_MGR]);
await db.query(`insert into public.organization_capabilities (organization_id, capability, status) values
  ('66666666-6666-4666-8666-666666666661','employment','active'),
  ('66666666-6666-4666-8666-666666666662','employment','revoked')`);

async function hiredApplication(organizationId, hirerId) {
  const job = (await db.query(
    `insert into public.jobs (employer_id, organization_id, title, description, company_name, employment_type, status, easy_apply_enabled, application_method)
     values ($1,$2,'Fix QA job','QA only','QA Co','full_time','published',true,'fairpath') returning id`,
    [CREATOR, organizationId],
  )).rows[0].id;
  const answers = JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Applicant', phone: '2165550100' }, employer_questions: {} });
  must(await tryAs(db, MEMBER, 'select public.submit_job_application($1,$2)', [job, answers]), 'submit');
  const appId = (await db.query('select id from public.job_applications where job_id=$1 and user_id=$2', [job, MEMBER])).rows[0].id;
  must(await tryAs(db, hirerId, `update public.job_applications set status='hired' where id=$1`, [appId]), 'force to hired');
  return appId;
}

await test('FIXED: a manager (not the job creator) at an org with a revoked employment capability can no longer record a placement', async () => {
  const appId = await hiredApplication('66666666-6666-4666-8666-666666666662', REVOKED_MGR);
  denied(await tryAs(db, REVOKED_MGR, 'select public.partner_record_placement($1,20,$2,$3,$4)', [appId, 'hourly', 'full_time', 'QA']), 'revoked-capability manager');
});

await test('a manager (not the job creator) at an org with an ACTIVE employment capability can still record a placement normally', async () => {
  const appId = await hiredApplication('66666666-6666-4666-8666-666666666661', GOOD_MGR);
  const rows = must(await tryAs(db, GOOD_MGR, 'select public.partner_record_placement($1,20,$2,$3,$4)', [appId, 'hourly', 'full_time', 'QA']), 'active-capability manager');
  ok(rows[0].partner_record_placement, 'placement was not recorded for a legitimately authorized manager');
});

await test('the individual-employer path (job creator acting alone, no organization_id) is unaffected by this fix', async () => {
  const job = (await db.query(
    `insert into public.jobs (employer_id, title, description, company_name, employment_type, status, easy_apply_enabled, application_method)
     values ($1,'Solo QA job','QA only','Solo QA Co','full_time','published',true,'fairpath') returning id`,
    [CREATOR],
  )).rows[0].id;
  const answers = JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Applicant', phone: '2165550100' }, employer_questions: {} });
  must(await tryAs(db, MEMBER, 'select public.submit_job_application($1,$2)', [job, answers]), 'solo submit');
  const appId = (await db.query('select id from public.job_applications where job_id=$1 and user_id=$2', [job, MEMBER])).rows[0].id;
  must(await tryAs(db, CREATOR, `update public.job_applications set status='hired' where id=$1`, [appId]), 'solo force to hired');
  const rows = must(await tryAs(db, CREATOR, 'select public.partner_record_placement($1,20,$2,$3,$4)', [appId, 'hourly', 'full_time', 'QA']), 'solo employer placement');
  ok(rows[0].partner_record_placement, 'an individual employer with no organization could no longer record their own placement');
});

done('local Postgres — partner_record_placement capability-check FIX verified (NOT applied to any real database)');
await db.close();
