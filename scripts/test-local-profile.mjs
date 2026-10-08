// Local (PGlite) SQL suite for the Opportunity Profile: ownership, validation, real completion, and the employer-safe
// application snapshot. `npm run test:sql:profile`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const E = await addUser(db, 'e@test.local', 'employer');
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 200)}`);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const ins = (who, table, obj) => {
  const cols = Object.keys(obj);
  return tryAs(db, who, `insert into public.${table} (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning id`, Object.values(obj));
};

await test('guests have no access to any member profile table', async () => {
  for (const t of ['member_work_experience', 'member_education', 'member_credentials', 'member_skills', 'member_job_preferences']) {
    denied(await tryAs(db, 'anon', `select * from public.${t}`), 'permission denied', t);
    denied(await tryAs(db, 'anon', `insert into public.${t} (user_id) values ($1)`, [M]), 'permission denied', t + ' insert');
  }
  denied(await tryAs(db, 'anon', 'select * from public.get_opportunity_completion()'), 'permission denied', 'completion');
});

await test('work experience: valid insert, then validation (dates, current flag, future, lengths)', async () => {
  must(await ins(M, 'member_work_experience', { user_id: M, job_title: 'Forklift Operator', employer_name: 'Acme Logistics', start_date: '2019-03-01', end_date: '2021-06-30', is_current: false }), 'valid');
  denied(await ins(M, 'member_work_experience', { user_id: M, job_title: 'X Y', employer_name: 'Co Ltd', start_date: '2020-01-01', end_date: '2019-01-01', is_current: false }), 'violates check', 'end before start');
  denied(await ins(M, 'member_work_experience', { user_id: M, job_title: 'Cook', employer_name: 'Diner', start_date: '2020-01-01', end_date: '2021-01-01', is_current: true }), 'violates check', 'current with end date');
  denied(await ins(M, 'member_work_experience', { user_id: M, job_title: 'Cook', employer_name: 'Diner', start_date: '2020-01-01', is_current: false }), 'violates check', 'not current without end date');
  denied(await ins(M, 'member_work_experience', { user_id: M, job_title: 'Cook', employer_name: 'Diner', start_date: '2999-01-01', is_current: true }), 'INVALID_DATE', 'future start');
  denied(await ins(M, 'member_work_experience', { user_id: M, job_title: 'C', employer_name: 'Diner', start_date: '2020-01-01', is_current: true }), 'violates check', 'short title');
  must(await ins(M, 'member_work_experience', { user_id: M, job_title: 'Prep Cook', employer_name: 'Corner Diner', start_date: '2022-01-10', is_current: true }), 'current job');
});

await test('education, credentials, skills, preferences: enums, uniqueness, ranges', async () => {
  must(await ins(M, 'member_education', { user_id: M, school_name: 'Lincoln High School', credential: 'ged', status: 'completed', end_year: 2015 }), 'edu');
  denied(await ins(M, 'member_education', { user_id: M, school_name: 'Lincoln High', credential: 'phd_magic', status: 'completed' }), 'violates check', 'bad credential');
  denied(await ins(M, 'member_education', { user_id: M, school_name: 'Lincoln High', credential: 'ged', start_year: 2016, end_year: 2015 }), 'violates check', 'year order');
  must(await ins(M, 'member_credentials', { user_id: M, credential_type: 'certification', name: 'OSHA 10', issuer: 'OSHA', issued_date: '2023-05-01' }), 'cert');
  denied(await ins(M, 'member_credentials', { user_id: M, credential_type: 'license', name: 'CDL', issued_date: '2024-01-01', expires_date: '2023-01-01' }), 'violates check', 'expiry before issue');
  must(await ins(M, 'member_skills', { user_id: M, skill: 'Forklift' }), 'skill');
  denied(await ins(M, 'member_skills', { user_id: M, skill: 'forklift ' }), 'duplicate', 'case-insensitive duplicate');
  must(await tryAs(db, M, `insert into public.member_job_preferences (user_id, desired_titles, employment_types, available_days, transportation_modes, pay_min_hourly) values ($1, array['Warehouse'], array['full_time'], array['mon','tue'], array['public_transit'], 18.5)`, [M]), 'prefs');
  denied(await tryAs(db, M, `update public.member_job_preferences set employment_types = array['forever'] where user_id = $1`, [M]), 'violates check', 'bad employment type');
  denied(await tryAs(db, M, `update public.member_job_preferences set desired_titles = array['a1','a2','a3','a4','a5','a6'] where user_id = $1`, [M]), 'violates check', 'too many titles');
});

await test('row caps: the 21st work-experience row is rejected', async () => {
  const have = Number((await one('select count(*)::int n from public.member_work_experience where user_id = $1', [M])).n);
  for (let i = have; i < 20; i++) must(await ins(M, 'member_work_experience', { user_id: M, job_title: 'Role ' + i, employer_name: 'Company ' + i, start_date: '2010-01-01', end_date: '2011-01-01', is_current: false }), 'fill ' + i);
  denied(await ins(M, 'member_work_experience', { user_id: M, job_title: 'One More', employer_name: 'Too Many', start_date: '2010-01-01', end_date: '2011-01-01', is_current: false }), 'ROW_LIMIT', 'cap');
  await db.query(`delete from public.member_work_experience where user_id = $1 and job_title like 'Role %'`, [M]);
});

await test('ownership: members cannot read, write or forge across accounts; employers cannot read the live profile', async () => {
  ok(must(await tryAs(db, N, 'select * from public.member_work_experience'), 'n read').length === 0, "N reads M's experience");
  ok(must(await tryAs(db, N, 'select * from public.member_skills'), 'n skills').length === 0, "N reads M's skills");
  denied(await ins(N, 'member_skills', { user_id: M, skill: 'Sneaky' }), 'row-level security', 'forged insert');
  const upd = await tryAs(db, N, `update public.member_skills set skill = 'Hacked' where user_id = $1 returning id`, [M]);
  ok(!upd.error && upd.rows.length === 0, "N updated M's skill");
  const del = await tryAs(db, N, `delete from public.member_work_experience where user_id = $1 returning id`, [M]);
  ok(!del.error && del.rows.length === 0, "N deleted M's experience");
  for (const t of ['member_work_experience', 'member_education', 'member_credentials', 'member_skills', 'member_job_preferences']) {
    ok(must(await tryAs(db, E, `select * from public.${t}`), 'employer ' + t).length === 0, `employer can read ${t}`);
  }
  denied(await tryAs(db, N, 'select public.build_opportunity_snapshot($1, array[\'skills\'])', [M]), 'permission denied', 'snapshot builder must not be callable by members');
});

await test('completion is real: 8 fixed sections computed from actual rows', async () => {
  let rows = must(await tryAs(db, N, 'select * from public.get_opportunity_completion()'), 'empty');
  ok(rows.length === 8 && rows.every((r) => r.is_complete === false), 'a new member must start at 0 of 8');
  await db.query(`update public.profiles set first_name = 'Marcus', last_name = 'Reed', phone = '(614) 555-0101', zip_code = '44113' where id = $1`, [M]);
  rows = must(await tryAs(db, M, 'select * from public.get_opportunity_completion() order by sort_order'), 'M');
  const by = Object.fromEntries(rows.map((r) => [r.section_key, r.is_complete]));
  ok(by.contact && by.location && by.work_experience && by.education, 'contact/location/experience/education should be complete: ' + JSON.stringify(by));
  ok(!by.skills, 'one skill is not enough (needs 3)');
  ok(by.preferences && by.availability && by.transportation, 'preferences/availability/transportation should be complete');
  await db.query(`insert into public.member_skills (user_id, skill) values ($1, 'Inventory'), ($1, 'Teamwork')`, [M]);
  rows = must(await tryAs(db, M, 'select * from public.get_opportunity_completion()'), 'M2');
  ok(rows.every((r) => r.is_complete), 'all eight sections should now be complete');
  // "no work experience yet" is an honest way to complete that section
  await db.query(`insert into public.member_job_preferences (user_id, no_work_experience_yet) values ($1, true)`, [N]);
  rows = must(await tryAs(db, N, 'select * from public.get_opportunity_completion()'), 'N');
  ok(rows.find((r) => r.section_key === 'work_experience').is_complete, '"no work experience yet" should complete that section');
});

// ---------- employer-safe snapshot ----------
const job = await one(`insert into public.jobs (employer_id, title, company_name, status, easy_apply_enabled, application_method, published_at)
                       values ($1, 'Warehouse Associate', 'Acme Logistics', 'published', true, 'fairpath', now()) returning id`, [E]);
await db.query(`update public.profiles set date_of_birth = '1985-02-03' where id = $1`, [M]);
const dobJob = await one(`insert into public.jobs (employer_id, title, company_name, status, easy_apply_enabled, application_method, published_at)
                          values ($1, 'Cook', 'Corner Diner', 'published', true, 'fairpath', now()) returning id`, [E]);
const payload = (extra = {}) => ({ profile: { first_name: 'Marcus', last_name: 'Reed', phone: '(614) 555-0101' }, employer_questions: {}, ...extra });
const apply = (who, jobId, answers) => tryAs(db, who, 'select public.submit_job_application($1, $2::jsonb) as id', [jobId, JSON.stringify(answers)]);

await test('application without opt-in stores NO snapshot', async () => {
  const r = must(await apply(M, dobJob.id, payload()), 'apply');
  const a = await one('select answers from public.job_applications where id = $1', [r[0].id]);
  ok(!('opportunity_snapshot' in a.answers), 'snapshot stored without opt-in');
});

await test('application with opt-in stores a server-built whitelist snapshot; client-sent content is ignored', async () => {
  const forged = { taken_at: 'x', work_experience: [{ job_title: 'CEO of Everything' }], date_of_birth: '1985-02-03', justice: { conviction: 'felony' } };
  const r = must(await apply(M, job.id, payload({
    share_opportunity_profile: true,
    share_sections: ['experience', 'skills', 'preferences', 'availability', 'transportation', 'justice_history', 'date_of_birth'],
    opportunity_snapshot: forged, date_of_birth: '1985-02-03', address: '1 Main St',
  })), 'apply');
  const a = (await one('select answers from public.job_applications where id = $1', [r[0].id])).answers;
  const snap = a.opportunity_snapshot;
  ok(snap && snap.work_experience[0].employer_name && !JSON.stringify(snap).includes('CEO of Everything'), 'snapshot must be server-built');
  ok(JSON.stringify(snap.sections) === JSON.stringify(['experience', 'skills', 'preferences', 'availability', 'transportation']), 'unknown sections must be dropped: ' + JSON.stringify(snap.sections));
  const text = JSON.stringify(a);
  ok(!text.includes('1985') && !text.includes('date_of_birth') && !text.includes('1 Main St') && !/conviction|justice|felony/i.test(text), 'snapshot/answers leaked DOB, address or justice data');
  ok(!('pay_min_hourly' in snap.preferences) && !text.includes('18.5'), 'private pay expectation must not be shared');
  ok(!('education' in snap) && !('credentials' in snap), 'sections the member did not choose must be absent');
  ok(Object.keys(a.profile).sort().join() === 'email,first_name,last_name,phone', 'profile fields must stay the whitelist: ' + Object.keys(a.profile));
});

await test('employer can read the application (snapshot) but still not the live profile; server still owns status', async () => {
  const apps = must(await tryAs(db, E, 'select answers from public.job_applications'), 'employer apps');
  ok(apps.length === 2 && apps.some((x) => x.answers.opportunity_snapshot), 'employer should see the applications');
  ok(must(await tryAs(db, E, 'select * from public.member_work_experience'), 'exp').length === 0, 'employer reads live experience');
  denied(await tryAs(db, M, `update public.job_applications set status = 'hired' where user_id = $1`, [M]), 'row-level security', 'member set own status');
  denied(await tryAs(db, M, `insert into public.job_applications (user_id, job_id, status, answers) values ($1, $2, 'submitted', '{}')`, [M, job.id]), 'permission denied', 'direct application insert');
});

await test('snapshot is a point-in-time copy: editing the live profile later does not change an existing application', async () => {
  await db.query(`update public.member_work_experience set job_title = 'Changed Later' where user_id = $1`, [M]);
  const apps = (await db.query(`select answers from public.job_applications where user_id = $1 and answers ? 'opportunity_snapshot'`, [M])).rows;
  ok(apps.length === 1 && !JSON.stringify(apps[0].answers).includes('Changed Later'), 'existing snapshot must not follow live edits');
});

// Regression for the DEV harness failure INVALID_APPLICATION:question:license: required employer questions are enforced,
// a payload that answers them succeeds, and the duplicate rule still wins over payload validation.
await test('required employer questions are enforced; a complete first application succeeds; duplicates say ALREADY_APPLIED', async () => {
  const qJob = await one(`insert into public.jobs (employer_id, title, company_name, status, easy_apply_enabled, application_method, published_at, application_questions)
                          values ($1, 'Driver', 'Route Co', 'published', true, 'fairpath', now(), '[{"id":"license","label":"Valid license?","required":true},{"id":"notes","label":"Notes","required":false}]'::jsonb) returning id`, [E]);
  denied(await apply(M, qJob.id, payload()), 'INVALID_APPLICATION:question:license', 'unanswered required question');
  ok((await q('select 1 from public.job_applications where user_id = $1 and job_id = $2', [M, qJob.id])).length === 0, 'a rejected application must leave no row');
  const full = payload({ employer_questions: { license: 'Yes' }, share_opportunity_profile: true, share_sections: ['skills'] });
  const r = must(await apply(M, qJob.id, full), 'complete apply');
  const a = (await one('select answers from public.job_applications where id = $1', [r[0].id])).answers;
  ok(a.employer_questions.license === 'Yes' && a.opportunity_snapshot && JSON.stringify(a.opportunity_snapshot.sections) === '["skills"]', 'answers and server-built snapshot stored');
  denied(await apply(M, qJob.id, payload()), 'ALREADY_APPLIED', 'duplicate with an incomplete payload');
  ok((await q('select 1 from public.job_applications where user_id = $1 and job_id = $2', [M, qJob.id])).length === 1, 'exactly one row');
});

await test('deleting a member removes all profile data', async () => {
  await db.query('delete from auth.users where id = $1', [M]);
  for (const t of ['member_work_experience', 'member_education', 'member_credentials', 'member_skills', 'member_job_preferences']) {
    ok((await db.query(`select 1 from public.${t} where user_id = $1`, [M])).rows.length === 0, t + ' survived');
  }
});

done('local Postgres');
