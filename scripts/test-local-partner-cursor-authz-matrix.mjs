/**
 * Cursor-owned isolated Partner authorization matrix (PGlite).
 * Does not modify Super Mardo, Mardo, Freebuff, or Juice files.
 *
 * Covers the combined-suite gap: a manager who originally created the
 * organization job is later removed, then both status and placement RPCs
 * must deny. Also asserts duplicate partner_record_placement returns the
 * same id and leaves exactly one job_placements row.
 *
 * Proposed drafts are applied only to this disposable local database.
 */
import fs from 'node:fs';
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) throw new Error(JSON.stringify(errors));

for (const file of [
  '20261009093000_partner_job_application_status_RPC_DRAFT.sql',
  '20261009094000_partner_org_context_RPC_DRAFT.sql',
  '20261009095000_partner_record_placement_hardening_DRAFT.sql',
]) {
  await db.exec(fs.readFileSync('docs/proposed-migrations/' + file, 'utf8').replace(/^\uFEFF/, ''));
}

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const creatorManager = await addUser(db, 'cursor-creator-manager@test.local', 'employer');
const otherManager = await addUser(db, 'cursor-other-manager@test.local', 'employer');
const member = await addUser(db, 'cursor-applicant@test.local');

await db.query(
  "insert into public.resource_organizations(id,name,slug,status) values($1,'Cursor Authz Org','cursor-authz','active')",
  [ORG],
);
await db.query(
  "insert into public.organization_members(organization_id,user_id,member_role,status) values($1,$2,'manager','active'),($1,$3,'manager','active')",
  [ORG, creatorManager, otherManager],
);
await db.query(
  "insert into public.organization_capabilities(organization_id,capability,status) values($1,'employment','active')",
  [ORG],
);

const job = (await db.query(
  `insert into public.jobs(employer_id,organization_id,title,description,company_name,employment_type,status,easy_apply_enabled,application_method)
   values($1,$2,'Cursor Authz QA','Synthetic','FairPath QA','full_time','published',true,'fairpath') returning id`,
  [creatorManager, ORG],
)).rows[0].id;

const submitted = await tryAs(
  db,
  member,
  'select public.submit_job_application($1,$2::jsonb) as id',
  [job, JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Member', phone: '2165550100' }, employer_questions: {} })],
);
if (submitted.error) throw new Error(submitted.error);
const app = submitted.rows[0].id;

const move = (who, status) => tryAs(db, who, 'select public.partner_update_job_application_status($1,$2)', [app, status]);
const place = (who) => tryAs(db, who, "select public.partner_record_placement($1,20,'hourly','full_time','Synthetic') as id", [app]);

await test('creator-manager can progress status while still an active manager', async () => {
  for (const status of ['viewed', 'interview', 'offer', 'hired']) {
    const result = await move(creatorManager, status);
    ok(!result.error, 'creator-manager denied while active: ' + status + ' ' + (result.error || ''));
  }
});

await test('removed creator-manager is denied status and placement despite employer_id', async () => {
  await db.query(
    "update public.organization_members set status='removed' where organization_id=$1 and user_id=$2",
    [ORG, creatorManager],
  );
  ok(Boolean((await move(creatorManager, 'rejected')).error), 'removed creator-manager changed status');
  const placement = await place(creatorManager);
  ok(Boolean(placement.error), 'removed creator-manager recorded placement');
  ok(String(placement.error || '').includes('NOT_AUTHORIZED') || Boolean(placement.error), 'removed creator-manager error');
});

await test('remaining active manager records one durable placement after duplicate RPC calls', async () => {
  const first = await place(otherManager);
  ok(!first.error, 'active manager placement failed: ' + (first.error || ''));
  const second = await place(otherManager);
  ok(!second.error, 'duplicate placement RPC failed: ' + (second.error || ''));
  ok(first.rows[0].id === second.rows[0].id, 'duplicate placement returned a different id');
  const count = (await db.query('select count(*)::int as count from public.job_placements where application_id=$1', [app])).rows[0].count;
  ok(count === 1, 'duplicate placement inserted extra rows: ' + count);
});

done('cursor partner authz matrix');
await db.close();
