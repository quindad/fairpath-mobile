// Local (PGlite) integration test for the PROPOSED `partner_update_job_application_status` RPC and its
// prerequisite immutable-field trigger. Neither has ever been exercised against real Postgres semantics before
// this file: docs/EMPLOYER_ATS_BACKEND_CONTRACT_2026-10-09.md explicitly says the only prior check was a static
// text scan (scripts/test-partner-job-status-contract.mjs, 17 regex-style checks) and that "real Postgres tests
// must prove role, RLS, revoked grants, event actor, rollback behavior... before deployment."
//
// This test touches ONLY an ephemeral, in-memory PGlite instance created fresh by createLocalDb() -- the same
// harness every other test-local-*.mjs file in this repo uses. It never connects to hosted DEV or production,
// applies no migration to any real database, and is fully reversible (delete the file; nothing persists).
//
// The two files under test:
//   - supabase/migrations/20261009053401_job_application_update_integrity.sql (untracked, but a real migration
//     file already in supabase/migrations/, so createLocalDb() applies it automatically like every other file)
//   - docs/proposed-migrations/20261009093000_partner_job_application_status_RPC_DRAFT.sql (deliberately NOT in
//     supabase/migrations/, so it is NOT auto-applied -- this test reads and applies it itself, directly into
//     this one ephemeral database, exactly mirroring what the DRAFT comment says must happen before it could
//     ever be approved for real use).
//
// `node scripts/test-local-partner-job-status-rpc.mjs`
import fs from 'node:fs';
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

// Apply the draft RPC migration into THIS ephemeral database only. Not written to any tracked migrations
// directory; not applied to any Supabase project.
const draftSql = fs.readFileSync('docs/proposed-migrations/20261009093000_partner_job_application_status_RPC_DRAFT.sql', 'utf8').replace(/\r\n/g, '\n');
try {
  await db.exec(draftSql);
} catch (e) {
  console.error('Draft RPC migration failed to apply locally:', e.message);
  process.exit(1);
}

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what, pattern = /NOT_AUTHORIZED|permission denied|row-level security/i) =>
  ok(r.error && pattern.test(r.error), `${what}: expected a denial, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const rpc = (who, args) => tryAs(db, who, 'select public.partner_update_job_application_status($1,$2)', args);

const MEMBER = await addUser(db, 'rpc-member@test.local');
const ORG_MGR = await addUser(db, 'rpc-org-mgr@test.local');
const ORG_EDITOR = await addUser(db, 'rpc-org-editor@test.local');
const ORG_B_MGR = await addUser(db, 'rpc-org-b-mgr@test.local');
const OUTSIDER = await addUser(db, 'rpc-outsider@test.local');
const SOLO_EMPLOYER = await addUser(db, 'rpc-solo-employer@test.local');
const SOLO_OUTSIDER = await addUser(db, 'rpc-solo-outsider@test.local');

await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);
await db.query(`insert into public.resource_organizations (id, name, slug, org_type, data_origin, fixture_set) values
  ('33333333-3333-4333-8333-333333333331','RPC Org A','rpc-org-a','employer','dev_fixture','partner-job-status-rpc-test'),
  ('33333333-3333-4333-8333-333333333332','RPC Org B','rpc-org-b','employer','dev_fixture','partner-job-status-rpc-test')`);
await db.query(`insert into public.organization_members (organization_id, user_id, member_role, status) values
  ('33333333-3333-4333-8333-333333333331', $1, 'manager', 'active'),
  ('33333333-3333-4333-8333-333333333331', $2, 'editor', 'active'),
  ('33333333-3333-4333-8333-333333333332', $3, 'manager', 'active')`, [ORG_MGR, ORG_EDITOR, ORG_B_MGR]);
await db.query(`insert into public.organization_capabilities (organization_id, capability, status) values
  ('33333333-3333-4333-8333-333333333331','employment','active'),
  ('33333333-3333-4333-8333-333333333332','employment','active')`);

const answers = JSON.stringify({ profile: { first_name: 'Synthetic', last_name: 'Applicant', phone: '2165550100' }, employer_questions: {} });
async function freshApplication(employerId, organizationId) {
  const job = (await db.query(
    `insert into public.jobs (employer_id, organization_id, title, description, company_name, employment_type, status, easy_apply_enabled, application_method)
     values ($1,$2,'RPC QA job','QA only','RPC QA Co','full_time','published',true,'fairpath') returning id`,
    [employerId, organizationId],
  )).rows[0].id;
  return must(await tryAs(db, MEMBER, 'select public.submit_job_application($1,$2)', [job, answers]), 'submit').length
    && (await db.query(`select id from public.job_applications where job_id=$1 and user_id=$2`, [job, MEMBER])).rows[0].id;
}

await test('an org manager advances submitted -> viewed -> interview -> offer -> hired, one legal step at a time', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  for (const status of ['viewed', 'interview', 'offer', 'hired']) {
    must(await rpc(ORG_MGR, [appId, status]), 'advance to ' + status);
    const row = (await db.query('select status from public.job_applications where id=$1', [appId])).rows[0];
    ok(row.status === status, 'status did not become ' + status + ', got ' + row.status);
  }
  const events = (await db.query('select to_status from public.job_application_events where application_id=$1 order by created_at,id', [appId])).rows.map((x) => x.to_status);
  ok(events.join(',') === 'submitted,viewed,interview,offer,hired', 'the existing audit trigger did not fire correctly through the RPC path: ' + events.join(','));
});

await test('skipping a stage is rejected (submitted straight to hired)', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  const r = await rpc(ORG_MGR, [appId, 'hired']);
  ok(r.error && /INVALID_STATUS_TRANSITION/.test(r.error), 'a submitted application was allowed to jump straight to hired: ' + JSON.stringify(r.error ?? r.rows));
});

await test('a terminal status cannot be moved again, including reopening a rejection', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  must(await rpc(ORG_MGR, [appId, 'viewed']), 'to viewed');
  must(await rpc(ORG_MGR, [appId, 'rejected']), 'to rejected');
  const r = await rpc(ORG_MGR, [appId, 'viewed']);
  ok(r.error && /INVALID_STATUS_TRANSITION/.test(r.error), 'a rejected (terminal) application was reopened: ' + JSON.stringify(r.error ?? r.rows));
});

await test('an editor (not owner/manager) cannot call the RPC at all', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  denied(await rpc(ORG_EDITOR, [appId, 'viewed']), 'editor called status RPC');
});

await test('a manager on a different org cannot touch this application', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  denied(await rpc(ORG_B_MGR, [appId, 'viewed']), 'Org B manager reached Org A application');
});

await test('an authenticated outsider with zero membership anywhere cannot touch it', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  denied(await rpc(OUTSIDER, [appId, 'viewed']), 'outsider called status RPC');
});

await test('a revoked employment capability blocks the RPC even for an active manager', async () => {
  await db.query(`update public.organization_capabilities set status='revoked' where organization_id='33333333-3333-4333-8333-333333333332'`);
  const appId = await freshApplication(ORG_B_MGR, '33333333-3333-4333-8333-333333333332');
  denied(await rpc(ORG_B_MGR, [appId, 'viewed']), 'manager used the RPC after their org\'s employment capability was revoked');
  await db.query(`update public.organization_capabilities set status='active' where organization_id='33333333-3333-4333-8333-333333333332'`);
});

await test('the individual-employer (organization_id null) path still works unchanged', async () => {
  const appId = await freshApplication(SOLO_EMPLOYER, null);
  must(await rpc(SOLO_EMPLOYER, [appId, 'viewed']), 'solo employer advance');
  denied(await rpc(SOLO_OUTSIDER, [appId, 'interview']), 'an unrelated account moved a solo employer\'s application');
});

await test('the immutable-field trigger blocks rewriting applicant/job/answers/submitted_at even for an authorized manager, independent of the RPC', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  const r = await tryAs(db, ORG_MGR, `update public.job_applications set answers='{"hacked":true}'::jsonb where id=$1`, [appId]);
  ok(r.error && /JOB_APPLICATION_IMMUTABLE_FIELDS|permission denied/i.test(r.error), 'answers were rewritten despite the immutability trigger: ' + JSON.stringify(r.error ?? r.rows));
});

await test('direct table UPDATE is fully revoked for authenticated clients; only the RPC path works', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  const r = await tryAs(db, ORG_MGR, `update public.job_applications set status='viewed' where id=$1`, [appId]);
  ok(r.error && /permission denied/i.test(r.error), 'a direct UPDATE on job_applications succeeded after the draft migration revoked table UPDATE: ' + JSON.stringify(r.error ?? r.rows));
});

await test('the member\'s own withdrawal RPC still works and is unaffected by the new status RPC', async () => {
  const appId = await freshApplication(ORG_MGR, '33333333-3333-4333-8333-333333333331');
  must(await tryAs(db, MEMBER, 'select public.withdraw_job_application($1)', [appId]), 'withdraw');
  const row = (await db.query('select status from public.job_applications where id=$1', [appId])).rows[0];
  ok(row.status === 'withdrawn', 'withdrawal did not set status to withdrawn, got ' + row.status);
});

done('local Postgres — partner_update_job_application_status DRAFT RPC (NOT applied to any real database)');
await db.close();
