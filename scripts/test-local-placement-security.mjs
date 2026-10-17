import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';
import fs from 'node:fs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) throw new Error(JSON.stringify(errors));
await db.exec(fs.readFileSync('docs/proposed-migrations/20261009095000_partner_record_placement_hardening_DRAFT.sql', 'utf8').replace(/^\uFEFF/, ''));

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const orgSuspended = '33333333-3333-4333-8333-333333333333';
const creator = await addUser(db, 'placement-creator@test.local', 'employer');
const manager = await addUser(db, 'placement-manager@test.local', 'employer');
const editor = await addUser(db, 'placement-editor@test.local', 'employer');
const removedManager = await addUser(db, 'placement-removed@test.local', 'employer');
const otherOrgManager = await addUser(db, 'placement-other-org@test.local', 'employer');
const revokedManager = await addUser(db, 'placement-revoked@test.local', 'employer');
const suspendedManager = await addUser(db, 'placement-suspended@test.local', 'employer');
const member = await addUser(db, 'placement-member@test.local');

const rpc = (who, id) => tryAs(db, who,
  'select public.partner_record_placement($1, 20, \'hourly\', \'full_time\', \'Synthetic test\') as id', [id]);
const rows = result => {
  if (result.error) throw new Error(result.error);
  return result.rows;
};

await db.query(`insert into public.resource_organizations(id,name,slug,status) values
  ('${orgA}','Placement Org A','placement-org-a','active'),
  ('${orgB}','Placement Org B','placement-org-b','active'),
  ('${orgSuspended}','Placement Suspended','placement-org-suspended','suspended')`);
await db.query(`insert into public.organization_members(organization_id,user_id,member_role,status) values
  ('${orgA}',$1,'manager','active'),
  ('${orgA}',$2,'editor','active'),
  ('${orgA}',$3,'manager','removed'),
  ('${orgB}',$4,'manager','active'),
  ('${orgB}',$5,'manager','active'),
  ('${orgSuspended}',$6,'manager','active')`,
  [manager, editor, removedManager, otherOrgManager, revokedManager, suspendedManager]);
await db.query(`insert into public.organization_capabilities(organization_id,capability,status) values
  ('${orgA}','employment','active'),
  ('${orgB}','employment','revoked'),
  ('${orgSuspended}','employment','active')`);

const makeHiredApplication = async (organizationId, employerId = creator) => {
  const job = rows(await db.query(
    `insert into public.jobs(employer_id,organization_id,title,description,company_name,employment_type,status,easy_apply_enabled,application_method)
     values($1,$2,'Placement QA','Synthetic','FairPath QA','full_time','published',true,'fairpath') returning id`,
    [employerId, organizationId]))[0];
  const application = rows(await tryAs(db, member,
    `select public.submit_job_application($1,$2::jsonb) as id`,
    [job.id, JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Member', phone: '2165550100' }, employer_questions: {} })]))[0];
  rows(await db.query(`update public.job_applications set status='hired' where id=$1 returning id`, [application.id]));
  return application.id;
};

const orgAApplication = await makeHiredApplication(orgA);
const revokedApplication = await makeHiredApplication(orgB);
const suspendedApplication = await makeHiredApplication(orgSuspended);

await test('organization job creator without active membership cannot record a placement', async () => {
  const result = await rpc(creator, orgAApplication);
  ok(result.error?.includes('NOT_AUTHORIZED'), 'non-member job creator recorded an organization placement');
});

await test('only an active owner or manager with active employment capability may record an organization placement', async () => {
  const allowed = rows(await rpc(manager, orgAApplication))[0].id;
  ok(Boolean(allowed), 'active employment manager could not record placement');
  for (const user of [editor, removedManager, otherOrgManager]) {
    const result = await rpc(user, orgAApplication);
    ok(result.error?.includes('NOT_AUTHORIZED'), 'unauthorized organization actor recorded placement');
  }
});

await test('revoked employment capability and suspended organization block placement evidence', async () => {
  const revoked = await rpc(revokedManager, revokedApplication);
  ok(revoked.error?.includes('NOT_AUTHORIZED'), 'revoked employment capability recorded placement');
  const suspended = await rpc(suspendedManager, suspendedApplication);
  ok(suspended.error?.includes('NOT_AUTHORIZED'), 'suspended organization recorded placement');
});

await test('placement creation is idempotent and authenticated callers cannot mutate hire evidence', async () => {
  const first = rows(await rpc(manager, orgAApplication))[0].id;
  const second = rows(await rpc(manager, orgAApplication))[0].id;
  ok(first === second, 'duplicate placement did not return original evidence');
  const count = rows(await db.query('select count(*)::int as count from public.job_placements where id=$1', [first]))[0].count;
  ok(count === 1, 'duplicate placement inserted another evidence row');
  const mutation = await tryAs(db, manager, `update public.job_placements set starting_wage=999 where id=$1 returning id`, [first]);
  ok(!mutation.rows?.length, 'authenticated employer changed immutable hire evidence');
});

await test('placement requires a genuinely hired application', async () => {
  const job = rows(await db.query(
    `insert into public.jobs(employer_id,title,description,company_name,employment_type,status,easy_apply_enabled,application_method)
     values($1,'Not hired QA','Synthetic','FairPath QA','full_time','published',true,'fairpath') returning id`, [creator]))[0];
  const application = rows(await tryAs(db, member,
    `select public.submit_job_application($1,$2::jsonb) as id`,
    [job.id, JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Member', phone: '2165550100' }, employer_questions: {} })]))[0];
  const result = await rpc(creator, application.id);
  ok(result.error?.includes('APPLICATION_NOT_HIRED'), 'placement accepted an application that was not hired');
});

done('local Postgres');
await db.close();
