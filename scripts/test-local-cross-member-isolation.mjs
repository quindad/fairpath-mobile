// Phase E of the boardroom sprint: adversarial cross-member isolation coverage for the modules that had none -
// Meetings and Resume Studio (pure RLS, no SECURITY DEFINER surface) and Opportunity Profile (5 tables sharing
// one generated owner-only policy pattern). Credit and Documents already have real isolation tests
// (test-local-credit.mjs, test-local-documents.mjs) - not duplicated here.
// `node scripts/test-local-cross-member-isolation.mjs`
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what) => ok((r.error && /permission denied|row-level security/i.test(r.error)) || r.rows.length === 0, `${what}: expected denial or zero rows, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);

const A = await addUser(db, 'iso-a@test.local');
const B = await addUser(db, 'iso-b@test.local');

// ---------------- Meetings ----------------
await test('meetings: B cannot read, update, delete, or forge-cancel A\'s meeting', async () => {
  const rows = must(await tryAs(db, A,
    `insert into public.member_meetings (user_id, title, meeting_type, start_at) values ($1,'A private meeting','other', now() + interval '1 day') returning id`,
    [A]), 'A creates meeting');
  const meetingId = rows[0].id;

  denied(await tryAs(db, B, `select id from public.member_meetings where id=$1`, [meetingId]), 'B direct read');
  const updByB = must(await tryAs(db, B, `update public.member_meetings set title='Hijacked' where id=$1 returning id`, [meetingId]), 'B update attempt');
  ok(updByB.length === 0, 'B could update A\'s meeting');
  const delByB = must(await tryAs(db, B, `delete from public.member_meetings where id=$1 returning id`, [meetingId]), 'B delete attempt');
  ok(delByB.length === 0, 'B could delete A\'s meeting');

  // set_meeting_status is SECURITY DEFINER and scoped to x.user_id = uid - forged claim id from B must fail closed.
  const cancelByB = await rpc(B, 'set_meeting_status', meetingId, 'cancelled', null);
  ok(cancelByB.error && cancelByB.error.includes('MEETING_UNAVAILABLE'), `B forging A's meeting id through the RPC should fail: ${JSON.stringify(cancelByB)}`);
});

await test('meetings: an authenticated user with zero meetings cannot list another member\'s meetings via a wildcard select', async () => {
  const rows = must(await tryAs(db, B, `select * from public.member_meetings`), 'B lists all meetings');
  ok(rows.length === 0, 'B saw meetings that are not theirs via an unfiltered select');
});

// ---------------- Resume Studio ----------------
await test('resume studio: B cannot read, update, or delete A\'s resume', async () => {
  const rows = must(await tryAs(db, A, `insert into public.member_resumes (user_id, title) values ($1,'A private resume') returning id`, [A]), 'A creates resume');
  const resumeId = rows[0].id;

  denied(await tryAs(db, B, `select id from public.member_resumes where id=$1`, [resumeId]), 'B direct read');
  const updByB = must(await tryAs(db, B, `update public.member_resumes set title='Hijacked' where id=$1 returning id`, [resumeId]), 'B update attempt');
  ok(updByB.length === 0, 'B could update A\'s resume');
  const delByB = must(await tryAs(db, B, `delete from public.member_resumes where id=$1 returning id`, [resumeId]), 'B delete attempt');
  ok(delByB.length === 0, 'B could delete A\'s resume');
});

await test('resume studio: B cannot insert a resume forging A\'s user_id', async () => {
  const forged = await tryAs(db, B, `insert into public.member_resumes (user_id, title) values ($1,'Forged') returning id`, [A]);
  denied(forged, 'B inserting with user_id=A should be denied by the WITH CHECK clause');
});

// ---------------- Opportunity Profile (5 tables, one generated policy pattern) ----------------
const OPP_TABLES = [
  ['member_work_experience', `(user_id, job_title, employer_name, start_date, is_current) values ($1,'Test role','Test employer','2020-01-01',true)`, `job_title='Hijacked'`],
  ['member_education', `(user_id, school_name, credential) values ($1,'Test school','ged')`, `school_name='Hijacked'`],
  ['member_credentials', `(user_id, credential_type, name) values ($1,'certification','Test cert')`, `name='Hijacked'`],
  ['member_skills', `(user_id, skill) values ($1,'Test skill')`, `skill='Hijacked'`],
];

for (const [table, insertShape, updateShape] of OPP_TABLES) {
  await test(`opportunity profile: B cannot read/update/delete/forge A's ${table} row`, async () => {
    const rows = must(await tryAs(db, A, `insert into public.${table} ${insertShape} returning id`, [A]), `A inserts ${table}`);
    const rowId = rows[0].id;

    denied(await tryAs(db, B, `select id from public.${table} where id=$1`, [rowId]), `B direct read of ${table}`);
    const updByB = must(await tryAs(db, B, `update public.${table} set ${updateShape} where id=$1 returning id`, [rowId]), `B update attempt on ${table}`);
    ok(updByB.length === 0, `B could update A's ${table} row`);
    const delByB = must(await tryAs(db, B, `delete from public.${table} where id=$1 returning id`, [rowId]), `B delete attempt on ${table}`);
    ok(delByB.length === 0, `B could delete A's ${table} row`);

    const forged = await tryAs(db, B, `insert into public.${table} ${insertShape} returning id`, [A]);
    denied(forged, `B forging user_id=A on an insert into ${table}`);
  });
}

// ---------------- Saved Jobs / Saved Housing (composite PK, no id column) ----------------
await test('saved jobs: B cannot read, delete, or forge-insert A\'s saved job', async () => {
  const jobRows = must(await tryAs(db, A,
    `insert into public.jobs (employer_id, title, description, company_name, employment_type, status) values ($1,'Iso test job','desc','Acme','full_time','published') returning id`,
    [A]), 'seed job');
  const jobId = jobRows[0].id;
  must(await tryAs(db, A, `insert into public.saved_jobs (user_id, job_id) values ($1,$2)`, [A, jobId]), 'A saves job');

  denied(await tryAs(db, B, `select * from public.saved_jobs where user_id=$1 and job_id=$2`, [A, jobId]), 'B direct read');
  const delByB = must(await tryAs(db, B, `delete from public.saved_jobs where user_id=$1 and job_id=$2 returning job_id`, [A, jobId]), 'B delete attempt');
  ok(delByB.length === 0, 'B could delete A\'s saved job');
  denied(await tryAs(db, B, `insert into public.saved_jobs (user_id, job_id) values ($1,$2)`, [A, jobId]), 'B forging a saved-job row for A');
});

await test('saved housing: B cannot read, delete, or forge-insert A\'s saved listing', async () => {
  const listingRows = must(await tryAs(db, A,
    `insert into public.housing_listings (owner_id, title, description, property_type, city, state, postal_code, rent_monthly, status) values ($1,'Iso test listing','desc','apartment','Cleveland','OH','44113',900,'published') returning id`,
    [A]), 'seed listing');
  const listingId = listingRows[0].id;
  must(await tryAs(db, A, `insert into public.saved_housing (user_id, listing_id) values ($1,$2)`, [A, listingId]), 'A saves listing');

  denied(await tryAs(db, B, `select * from public.saved_housing where user_id=$1 and listing_id=$2`, [A, listingId]), 'B direct read');
  const delByB = must(await tryAs(db, B, `delete from public.saved_housing where user_id=$1 and listing_id=$2 returning listing_id`, [A, listingId]), 'B delete attempt');
  ok(delByB.length === 0, 'B could delete A\'s saved listing');
  denied(await tryAs(db, B, `insert into public.saved_housing (user_id, listing_id) values ($1,$2)`, [A, listingId]), 'B forging a saved-housing row for A');
});

done();
