// Local (PGlite) SQL suite: server-derived member summary + privacy / account deletion requests. `npm run test:sql:member`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { loadResourceFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
await loadResourceFixtures(db);

const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const E = await addUser(db, 'e@test.local', 'employer');
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 200)}`);
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const summary = async (who) => must(await tryAs(db, who, 'select public.get_member_home_summary() as s'), 'summary')[0].s;

// fixtures: two jobs, saved jobs, housing rows, resources
const job1 = await one(`insert into public.jobs (employer_id, title, company_name, status, easy_apply_enabled, application_method, published_at) values ($1,'A','Co A','published',true,'fairpath',now()) returning id`, [E]);
const job2 = await one(`insert into public.jobs (employer_id, title, company_name, status, easy_apply_enabled, application_method, published_at) values ($1,'B','Co B','published',true,'fairpath',now()) returning id`, [E]);
await db.query(`update public.profiles set first_name='Marcus', last_name='Reed', phone='(614) 555-0101', zip_code='44113' where id=$1`, [M]);

await test('guests cannot read the summary or touch deletion requests', async () => {
  denied(await tryAs(db, 'anon', 'select public.get_member_home_summary()'), 'permission denied', 'summary');
  denied(await tryAs(db, 'anon', 'select public.request_account_deletion(null)'), 'permission denied', 'request');
  denied(await tryAs(db, 'anon', 'select * from public.account_deletion_requests'), 'permission denied', 'table');
  denied(await tryAs(db, M, 'select public.member_summary_core($1)', [M]), 'permission denied', 'core is internal (a member could ask for another id)');
});

await test('a new member starts at zero: no invented numbers', async () => {
  const s = await summary(N);
  ok(s.jobs.applied === 0 && s.jobs.saved === 0 && s.housing.applications === 0 && s.housing.saved_homes === 0, 'jobs/housing zero: ' + JSON.stringify([s.jobs, s.housing]));
  ok(s.resources.saved === 0 && s.resources.started === 0 && s.resources.completed === 0, 'resources zero');
  ok(s.profile.completed_sections === 0 && s.profile.total_sections === 8 && s.profile.next_section === 'contact', 'profile 0 of 8, next = contact: ' + JSON.stringify(s.profile));
  ok(s.documents.generated === 0 && s.notifications.unread === 0 && s.deletion_request === null, 'documents/notifications/deletion');
});

await test('summary counts come from real rows and only the caller\'s rows', async () => {
  const apply = (jobId) => tryAs(db, M, 'select public.submit_job_application($1, $2::jsonb)', [jobId, JSON.stringify({ profile: { first_name: 'Marcus', last_name: 'Reed', phone: '(614) 555-0101' }, employer_questions: {} })]);
  must(await apply(job1.id), 'apply 1'); must(await apply(job2.id), 'apply 2');
  const wid = (await one(`select id from public.job_applications where user_id=$1 and job_id=$2`, [M, job2.id])).id;
  await db.query(`update public.job_applications set status='withdrawn' where id=$1`, [wid]);
  await db.query(`insert into public.saved_jobs (user_id, job_id) values ($1,$2)`, [M, job1.id]);
  await db.query(`insert into public.housing_applications (user_id, listing_id, status, submitted_at) select $1, gen_random_uuid(), 'submitted', now()`, [M]).catch(() => {});
  must(await tryAs(db, M, 'select public.save_resource($1)', [rid('pantry-cle-44113')]), 'save');
  must(await tryAs(db, M, `select public.set_resource_progress($1,'started')`, [rid('shelter-cle-24h')]), 'start');
  must(await tryAs(db, M, `select public.set_resource_progress($1,'completed')`, [rid('kitchen-cle-meals')]), 'complete');
  const s = await summary(M);
  ok(s.jobs.applied === 1 && s.jobs.by_status.submitted === 1 && s.jobs.by_status.withdrawn === 1 && s.jobs.saved === 1, 'jobs: ' + JSON.stringify(s.jobs));
  ok(s.resources.saved === 1 && s.resources.started === 1 && s.resources.completed === 1, 'resources: ' + JSON.stringify(s.resources));
  ok(s.profile.completed_sections === 2 && s.profile.next_section === 'work_experience', 'profile: ' + JSON.stringify(s.profile));
  const n = await summary(N);
  ok(n.jobs.applied === 0 && n.resources.saved === 0, "N's summary must not include M's data");
  ok(s.plus && typeof s.plus === 'object', 'FairPath+ status is included from the entitlement function');
});

await test('unavailable saved resources are counted for the "needs attention" hint without revealing them', async () => {
  await db.query(`update public.resources set publish_status='retired' where id=$1`, [rid('pantry-cle-44113')]);
  const s = await summary(M);
  ok(s.resources.unavailable_saved === 1, 'unavailable_saved: ' + s.resources.unavailable_saved);
  await db.query(`update public.resources set publish_status='published' where id=$1`, [rid('pantry-cle-44113')]);
});

await test('module extension point: marketplace and meetings summaries reflect real per-member state (Home/Me cohesion gap closed this session)', async () => {
  const seller = await addUser(db, 'summary-seller@test.local');
  const item = await one(`insert into public.marketplace_items (seller_id, title, description, category, city, state) values ($1,'Summary test item','desc','furniture','Cleveland','OH') returning id`, [seller]);
  must(await tryAs(db, seller, 'select public.set_marketplace_item_availability($1, true)', [item.id]), 'publish item');
  must(await tryAs(db, M, 'select public.request_marketplace_claim($1, null)', [item.id]), 'M claims item');
  let s = await summary(M);
  ok(s.marketplace && s.marketplace.active_claims === 1, 'marketplace.active_claims should reflect the real claim: ' + JSON.stringify(s.marketplace));
  const sellerSummary = await summary(seller);
  ok(sellerSummary.marketplace.pending_requests_on_my_items === 1 && sellerSummary.marketplace.active_listings === 1, 'seller summary: ' + JSON.stringify(sellerSummary.marketplace));

  await db.query(`insert into public.member_meetings (user_id, title, meeting_type, start_at) values ($1,'Summary test meeting','other', now() + interval '2 days')`, [M]);
  s = await summary(M);
  ok(s.meetings && s.meetings.upcoming === 1 && s.meetings.next_start_at, 'meetings.upcoming should reflect the real meeting: ' + JSON.stringify(s.meetings));
});

await test('module extension point: credit and record-relief summaries are merged, real and per-member', async () => {
  const s = await summary(M);
  ok(s.credit && s.credit.reports === 0 && s.credit.items_to_review === 0 && s.credit.disputes_active === 0, 'credit block for a member with no reports: ' + JSON.stringify(s.credit));
  ok(s.record_relief && s.record_relief.cases === 0 && s.record_relief.eligible_now === 0, 'record relief block: ' + JSON.stringify(s.record_relief));
  await db.query(`create function public.member_summary_zzz(p uuid) returns jsonb language sql as $$ select jsonb_build_object('x', 1) $$`);
  ok(!('zzz' in (await summary(M))), 'only registered modules are merged (unknown functions are ignored)');
  await db.query('drop function public.member_summary_zzz(uuid)');
});

await test('account deletion: request is idempotent, honest, cancellable, and audited', async () => {
  const r1 = must(await tryAs(db, M, `select public.request_account_deletion('privacy') as r`), 'request')[0].r;
  const r2 = must(await tryAs(db, M, `select public.request_account_deletion('other') as r`), 'again')[0].r;
  ok(r1.status === 'requested' && r1.id === r2.id, 'a second request must return the same active request');
  const days = (new Date(r1.scheduled_for) - new Date(r1.requested_at)) / 86400000;
  ok(Math.round(days) === 14, 'grace period should be 14 days: ' + days);
  ok(Number((await one(`select count(*)::int n from public.account_deletion_requests where user_id=$1`, [M])).n) === 1, 'exactly one row');
  const st = must(await tryAs(db, M, 'select public.get_account_deletion_status() as s'), 'status')[0].s;
  ok(st.status === 'requested' && !('failure_note' in st), 'status view');
  ok((await summary(M)).deletion_request.status === 'requested', 'summary reflects the request');
  ok((await db.query(`select 1 from public.consent_events where user_id=$1 and event_type='data_deletion_requested' and granted`, [M])).rows.length === 1, 'consent ledger entry');
  denied(await tryAs(db, M, `insert into public.account_deletion_requests (user_id, status) values ($1,'completed')`, [M]), 'permission denied', 'direct insert');
  denied(await tryAs(db, M, `update public.account_deletion_requests set status='completed' where user_id=$1`, [M]), 'permission denied', 'direct update');
  denied(await tryAs(db, M, `select failure_note from public.account_deletion_requests`), 'permission denied', 'failure note is internal');
  ok(must(await tryAs(db, N, 'select id, status from public.account_deletion_requests'), 'N').length === 0, "N sees M's request");
  must(await tryAs(db, M, 'select public.cancel_account_deletion()'), 'cancel');
  denied(await tryAs(db, M, 'select public.cancel_account_deletion()'), 'NOT_CANCELLABLE', 'cancel twice');
  ok((await summary(M)).deletion_request === null, 'cancelled request is no longer active');
  ok((await db.query(`select 1 from public.consent_events where user_id=$1 and event_type='data_deletion_requested' and not granted`, [M])).rows.length === 1, 'cancellation is in the ledger too');
  const r3 = must(await tryAs(db, M, 'select public.request_account_deletion(null) as r'), 'new request after cancel')[0].r;
  ok(r3.id !== r1.id, 'a new request after cancellation is a new row');
});

await test('processing is service-only and never automatic in the database', async () => {
  denied(await tryAs(db, M, 'select * from public.list_due_account_deletions()'), 'permission denied', 'member list due');
  ok(must(await tryAs(db, 'service', 'select * from public.list_due_account_deletions()'), 'service').length === 0, 'nothing due inside the grace period');
  await db.query(`update public.account_deletion_requests set scheduled_for = now() - interval '1 hour' where user_id=$1 and status='requested'`, [M]);
  ok(must(await tryAs(db, 'service', 'select * from public.list_due_account_deletions()'), 'service2').length === 1, 'due after the grace period');
  ok((await one(`select count(*)::int n from auth.users where id=$1`, [M])).n === 1, 'nothing deletes the account by itself');
  // Until processing actually starts the member can still cancel, even after the grace period ended.
  must(await tryAs(db, M, 'select public.cancel_account_deletion()'), 'cancel before processing');
  ok((await one(`select status from public.account_deletion_requests where user_id=$1 order by requested_at desc limit 1`, [M])).status === 'cancelled', 'cancelled');
});

done('local Postgres');
