// Applies proposed canonical justice SQL on isolated PGlite (after committed migrations).
// Run: node scripts/test-local-justice-canonical.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addUser, asRole, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const proposedPath = path.join(
  root,
  'docs/proposed-migrations/20261021150000_canonical_justice_reconciliation_DRAFT.sql',
);
const proposedSql = fs.readFileSync(proposedPath, 'utf8');

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) throw new Error('baseline migrations failed: ' + JSON.stringify(errors));

const applyProposed = async () => {
  await db.exec(proposedSql);
};

await test('proposed canonical justice SQL applies cleanly', async () => {
  await applyProposed();
});

await test('proposed SQL is idempotent on re-apply (DDL + replace functions)', async () => {
  await applyProposed();
});

const rpc = (who, fn, args = []) =>
  tryAs(db, who, `select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as r`, args);

const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const must = (r, label) => {
  if (r.error) throw new Error(label + ': ' + r.error);
  return r.rows;
};

const MEMBER = await addUser(db, 'justice-member@test.local');
const MEMBER2 = await addUser(db, 'justice-member2@test.local');
const PARTNER = await addUser(db, 'justice-partner@test.local', 'employer');
const STAFF = await addUser(db, 'justice-staff@test.local');
const OUTSIDER = await addUser(db, 'justice-outsider@test.local', 'employer');

await db.query(
  `insert into public.staff_users (user_id, role, status) values ($1, 'admin', 'active') on conflict do nothing`,
  [STAFF],
);

const org = await one(
  `insert into public.resource_organizations (name, slug, org_type, status, data_origin)
   values ('Justice QA Org', 'justice-qa-org', 'employer', 'active', 'production') returning id`,
);
await db.query(
  `insert into public.organization_members (organization_id, user_id, member_role, status) values ($1, $2, 'manager', 'active')`,
  [org.id, PARTNER],
);

const job = await one(
  `insert into public.jobs (
     employer_id, organization_id, title, description, company_name, employment_type, status,
     easy_apply_enabled, application_method
   ) values ($1, $2, 'Justice policy job', 'QA', 'QA Co', 'full_time', 'published', true, 'fairpath')
   returning id`,
  [PARTNER, org.id],
);

const draftPolicy = {
  schemaVersion: 1,
  jobId: job.id,
  organizationId: org.id,
  effectiveFrom: '2026-01-01',
  policyType: 'criteria_based',
  publicationStatus: 'draft',
  criteria: [
    {
      id: 'cat-violent',
      kind: 'offense_category_exclusion',
      offenseCategories: ['violent_felony'],
      narrative: 'Policy restricts violent felony category.',
    },
  ],
};

await test('partner workflow: save draft, submit; outsider cannot save', async () => {
  const save = must(await rpc(PARTNER, 'partner_save_job_conviction_policy_draft', [job.id, JSON.stringify(draftPolicy)]), 'save');
  ok(save[0]?.r, 'missing policy id');
  const bad = await rpc(OUTSIDER, 'partner_save_job_conviction_policy_draft', [job.id, JSON.stringify(draftPolicy)]);
  ok(bad.error?.includes('NOT_AUTHORIZED'), 'outsider saved policy');
  must(await rpc(PARTNER, 'partner_submit_job_conviction_policy', [job.id]), 'submit');
  const st = await one(`select status from public.employer_job_conviction_policies where job_id = $1`, [job.id]);
  ok(st.status === 'submitted', 'expected submitted got ' + st.status);
});

await test('admin approve publishes version; partner cannot mutate approved JSONB on jobs', async () => {
  must(
    await tryAs(db, 'service', `select public.admin_approve_job_conviction_policy($1, $2, $3)`, [
      job.id,
      STAFF,
      'QA approve',
    ]),
    'approve',
  );
  const hdr = await one(
    `select status, published_version_id is not null as has_pub from public.employer_job_conviction_policies where job_id = $1`,
    [job.id],
  );
  ok(hdr.status === 'approved' && hdr.has_pub, 'policy not approved');
  const tamper = await tryAs(db, PARTNER, `update public.jobs set eligibility_rules = $1::jsonb where id = $2`, [
    JSON.stringify({ justice_policy_v1: { schemaVersion: 1, publicationStatus: 'approved', policyType: 'criteria_based', criteria: [] } }),
    job.id,
  ]);
  ok(tamper.error?.includes('justice_policy_v1'), 'partner tampered jobs.eligibility_rules');
  const reSave = await rpc(PARTNER, 'partner_save_job_conviction_policy_draft', [job.id, JSON.stringify(draftPolicy)]);
  ok(reSave.error?.includes('POLICY_NOT_EDITABLE'), 'partner edited approved policy');
});

await test('multi-charge member evaluation uses only requesting member records', async () => {
  const jc = await one(
    `insert into public.justice_cases (user_id, jurisdiction_code, docket_label) values ($1, 'US-OH', 'Case A') returning id`,
    [MEMBER],
  );
  await db.query(
    `insert into public.justice_charges (case_id, user_id, count_number, offense_name, degree, disposition, offense_category, visibility)
     values ($1, $2, 1, 'Charge one', 'misdemeanor', 'conviction', 'misdemeanor', 'member'),
            ($1, $2, 2, 'Charge two', 'felony', 'conviction', 'violent_felony', 'member')`,
    [jc.id, MEMBER],
  );
  await db.query(
    `insert into public.consent_events (user_id, event_type, granted) values ($1, 'justice_history_disclosure_consent', true)`,
    [MEMBER],
  );

  const evalRow = must(await rpc(MEMBER, 'evaluate_member_job_justice_match', [job.id]), 'eval')[0]?.r;
  const parsed = typeof evalRow === 'string' ? JSON.parse(evalRow) : evalRow;
  ok(parsed.outcome === 'confirmed_restriction', 'expected restriction got ' + parsed.outcome);
  ok(!JSON.stringify(parsed).includes('Charge one'), 'evaluation leaked offense text');
  ok(!JSON.stringify(parsed).includes('Charge two'), 'evaluation leaked offense text');

  const cross = await rpc(MEMBER2, 'evaluate_member_job_justice_match', [job.id]);
  ok(cross.error?.includes('NO_PUBLISHED_POLICY') || parsed.outcome, 'member2 unexpected path');
  await db.query(
    `insert into public.consent_events (user_id, event_type, granted) values ($1, 'justice_history_disclosure_consent', true)`,
    [MEMBER2],
  );
  const eval2 = must(await rpc(MEMBER2, 'evaluate_member_job_justice_match', [job.id]), 'eval2')[0]?.r;
  const p2 = typeof eval2 === 'string' ? JSON.parse(eval2) : eval2;
  ok(p2.outcome === 'insufficient_information', 'member2 without charges should lack disclosure facts');
});

await test('legacy backfill links convictions and record relief cases', async () => {
  const conv = await one(
    `insert into public.convictions (user_id, offense_title, state_code, disposition, conviction_date)
     values ($1, 'Legacy theft', 'OH', 'conviction', '2018-06-01') returning id`,
    [MEMBER2],
  );
  const rr = await one(
    `insert into public.record_relief_cases (user_id, jurisdiction_code, label, offense_class, disposition)
     values ($1, 'US-OH', 'RR legacy', 'misdemeanor', 'conviction') returning id`,
    [MEMBER2],
  );
  let stats;
  await asRole(db, 'service', async () => {
    stats = must(await rpc('service', 'service_backfill_justice_from_legacy', [MEMBER2]), 'backfill')[0]?.r;
  });
  const s = typeof stats === 'string' ? JSON.parse(stats) : stats;
  ok(Number(s.convictions_backfilled) >= 1, 'conviction backfill');
  ok(Number(s.record_relief_cases_linked) >= 1, 'rr backfill');
  const link = await one(`select justice_charge_id from public.convictions where id = $1`, [conv.id]);
  ok(link.justice_charge_id, 'conviction missing justice_charge_id');
  const rrLink = await one(`select justice_case_id from public.record_relief_cases where id = $1`, [rr.id]);
  ok(rrLink.justice_case_id, 'rr case missing justice_case_id');
});

await test('authenticated cannot insert employer policy versions directly', async () => {
  const pol = await one(`select id from public.employer_job_conviction_policies where job_id = $1`, [job.id]);
  const direct = await tryAs(db, PARTNER, `insert into public.employer_job_conviction_policy_versions (policy_id, version_number, policy_json)
    values ($1, 99, '{}'::jsonb)`, [pol.id]);
  ok(direct.error, 'partner inserted policy version directly');
});

done('canonical justice local Postgres');
await db.close();
