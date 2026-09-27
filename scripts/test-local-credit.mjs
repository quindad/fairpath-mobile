// Local (PGlite) SQL suite for the Credit Builder workspace. `npm run test:sql:credit`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const E = await addUser(db, 'e@test.local', 'employer');
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 220)}`);
const q = (sql, p = []) => db.query(sql, p).then((r) => r.rows);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);
const setEnv = (v) => v === null ? db.query(`delete from public.app_config where key='environment'`) : db.query(`insert into public.app_config (key, value) values ('environment', $1::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify(v)]);

await test('guests and other roles have no access to any credit table or function', async () => {
  for (const t of ['credit_report_uploads', 'credit_reports', 'credit_accounts', 'credit_review_items', 'credit_disputes', 'credit_inquiries', 'credit_extraction_jobs']) {
    denied(await tryAs(db, 'anon', `select * from public.${t}`), 'permission denied', t);
  }
  for (const [fn, a] of [['load_credit_sample_report', []], ['run_credit_review', ['00000000-0000-4000-8000-000000000000']], ['set_credit_item_stage', ['00000000-0000-4000-8000-000000000000', 'dismissed', null]],
    ['create_credit_dispute', ['bureau', 'X Bureau', ['00000000-0000-4000-8000-000000000000'], 'a reason that is long enough']]]) {
    denied(await rpc('anon', fn, ...a), 'permission denied', fn);
  }
  denied(await rpc(M, 'ingest_credit_report', M, null, '{}', 'fixture'), 'permission denied', 'members cannot ingest arbitrary reports');
  denied(await rpc(M, 'ingest_credit_extraction', '00000000-0000-4000-8000-000000000000', '{}', 'ocr_v1'), 'permission denied', 'members cannot fake extraction');
  denied(await rpc(M, 'expire_credit_uploads'), 'permission denied', 'expire');
  denied(await rpc(M, 'member_summary_credit', M), 'permission denied', 'summary internals');
});

await test('sample data is DEV-only: refused unless app_config.environment = dev', async () => {
  await setEnv(null);
  denied(await rpc(M, 'load_credit_sample_report'), 'SAMPLE_DATA_DEV_ONLY', 'unset environment');
  await setEnv('production');
  denied(await rpc(M, 'load_credit_sample_report'), 'SAMPLE_DATA_DEV_ONLY', 'production environment');
  ok((await q('select 1 from public.credit_reports')).length === 0, 'nothing may be created when refused');
  await setEnv('dev');
  must(await rpc(M, 'load_credit_sample_report'), 'dev load');
  denied(await rpc(M, 'load_credit_sample_report'), 'SAMPLE_ALREADY_LOADED', 'second load');
});

await test('extracted data starts as needs_review, is labelled fixture, and stores only the last 4 digits', async () => {
  const reports = await q('select * from public.credit_reports where user_id = $1', [M]);
  ok(reports.length === 2 && reports.every((r) => r.source === 'fixture'), 'two fixture reports');
  const acc = await q('select * from public.credit_accounts where user_id = $1', [M]);
  ok(acc.length === 9, 'nine sample accounts, got ' + acc.length);
  ok(acc.every((a) => a.extraction_state === 'needs_review' && a.source === 'fixture'), 'every extracted account must need review');
  ok(acc.every((a) => a.account_last4 === null || /^[0-9]{4}$/.test(a.account_last4)), 'only 4-digit endings');
  ok(!JSON.stringify(acc).match(/\b\d{5,}\b/g)?.some((s) => s === '000000004421' || s === '5100007788'), 'full account numbers must not be stored anywhere');
  ok(acc.find((a) => a.furnisher_name === 'Lakeside Auto Finance' && a.report_id === reports.find((r) => r.bureau === 'transunion').id).account_last4 === '4421', 'last4 kept');
});

await test('review rules flag the right things, in the right stage', async () => {
  const items = await q('select issue_type, stage, origin, title, evidence, account_id from public.credit_review_items where user_id = $1', [M]);
  const by = (t) => items.filter((i) => i.issue_type === t);
  ok(by('negative_item').length === 3 && by('negative_item').every((i) => i.stage === 'negative_item'), 'negative items (Metro x2 late, Riverbend collection) stay negative_item: ' + by('negative_item').length);
  ok(by('duplicate_account').length === 1 && by('duplicate_account')[0].stage === 'possible_inaccuracy', 'duplicate Metro listing');
  ok(by('conflicting_balance').length === 1 && by('conflicting_balance')[0].evidence.this_report_balance_cents !== by('conflicting_balance')[0].evidence.other_report_balance_cents, 'balance conflict (Lakeside)');
  ok(by('conflicting_status').length === 1, 'status conflict (Metro late vs current)');
  ok(by('date_inconsistency').length === 1 && by('date_inconsistency')[0].title.startsWith('Sunrise'), 'closed-before-opened');
  ok(by('possible_outdated_item').length === 1 && by('possible_outdated_item')[0].title.startsWith('Riverbend'), 'old collection prompts a check, not a claim');
  ok(by('unclear_extraction').length >= 2, 'low-confidence reads');
  ok(items.every((i) => ['negative_item', 'possible_inaccuracy'].includes(i.stage) && i.origin === 'rule'), 'the rules alone never put anything into a dispute stage');
  ok(!items.some((i) => /will (be )?(delete|remov)|guarantee|score (will|increase)|improve your score/i.test(i.title + ' ' + (i.explanation ?? ''))), 'no promises in rule text');
  const text = (await q('select explanation from public.credit_review_items where user_id = $1', [M])).map((r) => r.explanation).join(' ');
  ok(/generally/.test(text) && !/illegal|violat|must be removed/i.test(text), 'careful, non-legal wording');
});

await test('the four stages: no shortcut from a negative item to a confirmed dispute', async () => {
  const neg = (await q(`select id from public.credit_review_items where user_id=$1 and issue_type='negative_item' limit 1`, [M]))[0].id;
  denied(await rpc(M, 'set_credit_item_stage', neg, 'confirmed_dispute_issue', 'I say this is wrong for many reasons'), 'INVALID_TRANSITION', 'negative -> confirmed');
  denied(await rpc(M, 'set_credit_item_stage', neg, 'member_disputes_accuracy', null), 'STATEMENT_REQUIRED', 'no statement');
  denied(await rpc(M, 'set_credit_item_stage', neg, 'member_disputes_accuracy', 'short'), 'STATEMENT_REQUIRED', 'too short');
  denied(await rpc(M, 'set_credit_item_stage', neg, 'won', null), 'INVALID_STAGE', 'unknown stage');
  const s2 = must(await rpc(M, 'set_credit_item_stage', neg, 'member_disputes_accuracy', 'The balance shown is higher than my statement says.'), 'member disputes')[0];
  ok(s2.stage === 'member_disputes_accuracy' && s2.member_statement.includes('statement'), 'member statement stored in their own words');
  const s3 = must(await rpc(M, 'set_credit_item_stage', neg, 'confirmed_dispute_issue', null), 'confirm')[0];
  ok(s3.stage === 'confirmed_dispute_issue', 'confirmed after the member stated the issue');
  denied(await rpc(M, 'set_credit_item_stage', neg, 'dismissed', null), 'INVALID_TRANSITION', 'a confirmed issue cannot be quietly dismissed');
  denied(await rpc(M, 'set_credit_item_stage', neg, 'reopen', null), 'INVALID_TRANSITION', 'reopen from confirmed');
  const dup = (await q(`select id from public.credit_review_items where user_id=$1 and issue_type='duplicate_account'`, [M]))[0].id;
  must(await rpc(M, 'set_credit_item_stage', dup, 'dismissed', null), 'dismiss');
  const back = must(await rpc(M, 'set_credit_item_stage', dup, 'reopen', null), 'reopen')[0];
  ok(back.stage === 'possible_inaccuracy', 'reopen returns to possible_inaccuracy');
});

await test('isolation: no cross-member reads, writes, transitions or review runs', async () => {
  for (const t of ['credit_reports', 'credit_accounts', 'credit_review_items', 'credit_inquiries']) {
    ok(must(await tryAs(db, N, `select id from public.${t}`), 'N ' + t).length === 0, `N reads ${t}`);
    ok(must(await tryAs(db, E, `select id from public.${t}`), 'E ' + t).length === 0, `employer reads ${t}`);
  }
  const item = (await q(`select id, report_id, account_id from public.credit_review_items where user_id=$1 limit 1`, [M]))[0];
  denied(await rpc(N, 'set_credit_item_stage', item.id, 'dismissed', null), 'ITEM_UNAVAILABLE', 'N transitions M item');
  denied(await rpc(N, 'run_credit_review', item.report_id), 'REPORT_UNAVAILABLE', 'N reviews M report');
  denied(await rpc(N, 'confirm_credit_account', item.account_id, '{}'), 'ACCOUNT_UNAVAILABLE', 'N confirms M account');
  denied(await rpc(N, 'flag_credit_account_not_mine', item.account_id, 'this is definitely not mine at all'), 'ACCOUNT_UNAVAILABLE', 'N flags M account');
  denied(await rpc(N, 'delete_credit_report', item.report_id), 'REPORT_UNAVAILABLE', 'N deletes M report');
  denied(await tryAs(db, M, `insert into public.credit_accounts (user_id, report_id, furnisher_name) values ($1, $2, 'Forged Co')`, [M, item.report_id]), 'permission denied', 'direct account insert');
  denied(await tryAs(db, M, `update public.credit_review_items set stage = 'confirmed_dispute_issue' where user_id = $1`, [M]), 'permission denied', 'direct stage update');
  denied(await tryAs(db, M, `update public.credit_accounts set extraction_state = 'member_confirmed' where user_id = $1`, [M]), 'permission denied', 'direct confirmation');
});

await test('confirming vs correcting: originals are kept, and fixing data resolves the finding', async () => {
  const lakeTU = (await q(`select a.id, a.report_id from public.credit_accounts a join public.credit_reports r on r.id=a.report_id where a.user_id=$1 and r.bureau='transunion' and a.furnisher_name='Lakeside Auto Finance'`, [M]))[0];
  const before = (await q(`select count(*)::int n from public.credit_review_items where user_id=$1 and issue_type='conflicting_balance'`, [M]))[0].n;
  ok(before === 1, 'conflict present before');
  const corrected = must(await rpc(M, 'confirm_credit_account', lakeTU.id, JSON.stringify({ balance_cents: 510000 })), 'correct')[0];
  ok(corrected.extraction_state === 'corrected_by_member' && Number(corrected.balance_cents) === 510000 && Number(corrected.extracted_values.balance_cents) === 820000, 'corrected + original preserved: ' + JSON.stringify(corrected.extracted_values));
  ok((await q(`select count(*)::int n from public.credit_review_items where user_id=$1 and issue_type='conflicting_balance'`, [M]))[0].n === 0, 'a corrected balance resolves the untouched finding');
  const harbor = (await q(`select id from public.credit_accounts where user_id=$1 and furnisher_name='Harbor Bank Card'`, [M]))[0];
  const confirmed = must(await rpc(M, 'confirm_credit_account', harbor.id, '{}'), 'confirm')[0];
  ok(confirmed.extraction_state === 'member_confirmed' && confirmed.extracted_values === null, 'confirming without changes is member_confirmed');
  ok((await q(`select count(*)::int n from public.credit_review_items where account_id=$1 and issue_type='unclear_extraction'`, [harbor.id]))[0].n === 0, 'unclear finding cleared after review');
});

await test('"not mine" is the member\'s claim, tracked separately, and removes FairPath\'s own flag', async () => {
  const riv = (await q(`select id from public.credit_accounts where user_id=$1 and furnisher_name='Riverbend Collections'`, [M]))[0];
  denied(await rpc(M, 'flag_credit_account_not_mine', riv.id, 'short'), 'STATEMENT_REQUIRED', 'needs their words');
  const it = must(await rpc(M, 'flag_credit_account_not_mine', riv.id, 'I never had an account with this collection agency.'), 'flag')[0];
  ok(it.origin === 'member' && it.stage === 'member_disputes_accuracy' && it.issue_type === 'not_mine_reported', 'member origin + stage');
  ok(/cannot verify/i.test(it.explanation), 'FairPath states it cannot verify the claim');
  const rep = (await q('select report_id from public.credit_accounts where id=$1', [riv.id]))[0].report_id;
  must(await rpc(M, 'run_credit_review', rep), 'rerun');
  ok((await q(`select count(*)::int n from public.credit_review_items where account_id=$1 and origin='rule'`, [riv.id]))[0].n === 0, 'FairPath no longer files its own negative-item finding for an account the member says is not theirs');
  ok((await q(`select count(*)::int n from public.credit_review_items where id=$1 and stage='member_disputes_accuracy'`, [it.id]))[0].n === 1, 'the member claim is untouched by re-review');
});

await test('disputes: only confirmed issues; tracker dates; events; active disputes lock their items', async () => {
  const unconfirmed = (await q(`select id from public.credit_review_items where user_id=$1 and stage in ('possible_inaccuracy','negative_item') limit 1`, [M]))[0].id;
  denied(await rpc(M, 'create_credit_dispute', 'bureau', 'TransUnion', [unconfirmed], 'The information is wrong as I explained.'), 'ITEMS_NOT_CONFIRMED', 'unconfirmed');
  denied(await rpc(M, 'create_credit_dispute', 'bureau', 'TransUnion', [], 'The information is wrong as I explained.'), 'ITEMS_REQUIRED', 'none');
  const confirmed = (await q(`select id from public.credit_review_items where user_id=$1 and stage='confirmed_dispute_issue'`, [M]))[0].id;
  denied(await rpc(N, 'create_credit_dispute', 'bureau', 'TransUnion', [confirmed], 'The information is wrong as I explained.'), 'ITEMS_NOT_CONFIRMED', "N disputes M's item");
  const d = must(await rpc(M, 'create_credit_dispute', 'bureau', 'TransUnion', [confirmed], 'The balance on this account is higher than my statements show.'), 'create')[0];
  ok(d.status === 'draft' && d.sent_on === null, 'starts as a draft');
  denied(await rpc(M, 'mark_credit_dispute_sent', d.id, '2999-01-01', 'mail', null, 30), 'INVALID_DATE', 'future sent date');
  denied(await rpc(M, 'mark_credit_dispute_sent', d.id, '2026-01-01', 'carrier_pigeon', null, 30), 'INVALID_METHOD', 'method');
  const sentOn = new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10);
  const sent = must(await rpc(M, 'mark_credit_dispute_sent', d.id, sentOn, 'mail', '  9400 1000 0000 0000  ', 30), 'sent')[0];
  ok(sent.status === 'sent' && sent.tracking_reference === '9400 1000 0000 0000' && sent.response_due_on !== null, 'sent + reference + due date');
  const due = new Date(sent.response_due_on); const expect = new Date(sentOn); expect.setDate(expect.getDate() + 30);
  ok(due.toISOString().slice(0, 10) === expect.toISOString().slice(0, 10), 'due date is sent + 30 days (member-adjustable window)');
  denied(await rpc(M, 'set_credit_item_stage', confirmed, 'dismissed', null), 'ITEM_IN_ACTIVE_DISPUTE', 'locked while active');
  const rem = must(await rpc('service', 'credit_dispute_reminders_due'), 'reminders');
  ok(rem.some((r) => r.dispute_id === d.id && r.kind === 'due_soon'), 'due-soon reminder surfaces for the service job: ' + JSON.stringify(rem));
  denied(await tryAs(db, M, 'select * from public.credit_dispute_reminders_due()'), 'permission denied', 'members cannot run the reminder job');
  const summary = must(await tryAs(db, M, 'select public.get_member_home_summary() as s'), 'summary')[0].s;
  ok(summary.credit.disputes_awaiting_response === 1 && summary.credit.response_due_soon === 1 && summary.credit.reports === 2, 'home summary carries real credit state: ' + JSON.stringify(summary.credit));
  denied(await rpc(M, 'record_credit_dispute_response', d.id, '2999-01-01', 'corrected', null), 'INVALID_DATE', 'future response');
  denied(await rpc(M, 'record_credit_dispute_response', d.id, sentOn, 'magic', null), 'INVALID_OUTCOME', 'outcome');
  const dbToday = (await q('select current_date::text as d'))[0].d;
  const resp = must(await rpc(M, 'record_credit_dispute_response', d.id, dbToday, 'verified_accurate', 'They said it is accurate.'), 'response')[0];
  ok(resp.status === 'response_received' && resp.outcome === 'verified_accurate', 'an outcome of "verified accurate" is recorded honestly');
  must(await rpc(M, 'update_credit_dispute', d.id, new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), 'Will try a direct dispute with the furnisher.', false), 'follow up');
  must(await rpc(M, 'add_credit_dispute_evidence', d.id, 'Photo of my January statement'), 'evidence');
  const events = (await q('select event_type from public.credit_dispute_events where dispute_id=$1 order by created_at', [d.id])).map((e) => e.event_type);
  ok(events.join() === 'created,marked_sent,response_recorded,follow_up_set', 'audit trail: ' + events);
  ok(must(await tryAs(db, N, 'select * from public.credit_disputes'), 'N').length === 0 && must(await tryAs(db, N, 'select * from public.credit_dispute_events'), 'Ne').length === 0, "N sees M's disputes");
  ok(must(await tryAs(db, E, 'select * from public.credit_dispute_evidence'), 'E').length === 0, 'employer sees dispute evidence');
});

await test('uploads: validation, private path, job queue, ingestion (service), retention, deletion, cleanup', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  denied(await rpc(M, 'register_credit_upload', id, 'experian', 'exe', 3, 1000, 'application/pdf', null), 'UNSUPPORTED_TYPE', 'type');
  denied(await rpc(M, 'register_credit_upload', id, 'experian', 'pdf', 3, 99999999, 'application/pdf', null), 'FILE_TOO_LARGE', 'size');
  denied(await rpc(M, 'register_credit_upload', id, 'experian', 'pdf', 99, 1000, 'application/pdf', null), 'TOO_MANY_PAGES', 'pages');
  denied(await rpc(M, 'register_credit_upload', id, 'experian', 'pdf', 3, 1000, 'application/pdf', null), 'FILE_NOT_UPLOADED', 'file must exist first');
  denied(await tryAs(db, M, `insert into storage.objects (bucket_id, name, owner) values ('credit-uploads', $1, $2)`, [`${N}/${id}/report.pdf`, M]), 'row-level security', "upload into N's folder");
  must(await tryAs(db, M, `insert into storage.objects (bucket_id, name, owner) values ('credit-uploads', $1, $2)`, [`${M}/${id}/report.pdf`, M]), 'own upload');
  denied(await rpc(N, 'register_credit_upload', id, 'experian', 'pdf', 3, 1000, 'application/pdf', null), 'FILE_NOT_UPLOADED', "N cannot register M's file");
  const up = must(await rpc(M, 'register_credit_upload', id, 'experian', 'pdf', 3, 5000, 'application/pdf', 'b'.repeat(64)), 'register')[0];
  ok(up.status === 'uploaded' && up.storage_path === `${M}/${id}/report.pdf` && new Date(up.expires_at) < new Date(Date.now() + 31 * 86400000), 'registered with a 30-day default retention');
  ok((await q('select status from public.credit_extraction_jobs where upload_id=$1', [id]))[0].status === 'queued', 'extraction job queued (no engine is connected)');
  ok(must(await tryAs(db, N, 'select * from public.credit_report_uploads'), 'N').length === 0, "N sees M's upload");
  ok((await q(`select public from storage.buckets where id='credit-uploads'`))[0].public === false, 'bucket is private');
  const payload = { bureau: 'experian', report_date: '2026-09-20', accounts: [{ furnisher_name: 'Test Card Co', account_type: 'revolving', account_number: '4111111111111111', payment_status: 'current', opened_date: '2020-01-01', balance_cents: 1000 }] };
  const rid = must(await rpc('service', 'ingest_credit_extraction', id, JSON.stringify(payload), 'ocr_v1'), 'ingest')[0].ingest_credit_extraction;
  const a = (await q('select account_last4, extraction_state, source from public.credit_accounts where report_id=$1', [rid]))[0];
  ok(a.account_last4 === '1111' && a.extraction_state === 'needs_review' && a.source === 'extracted', 'only last 4, needs review, source extracted');
  ok((await q('select status from public.credit_report_uploads where id=$1', [id]))[0].status === 'needs_review', 'upload moves to needs_review');
  denied(await rpc(M, 'extend_credit_upload_retention', id, 45), 'INVALID_RETENTION', '45 days');
  ok(new Date(must(await rpc(M, 'extend_credit_upload_retention', id, 90), 'extend')[0].extend_credit_upload_retention) > new Date(Date.now() + 89 * 86400000), '90-day extension');
  must(await rpc(M, 'delete_credit_upload', id), 'delete');
  const row = (await q('select status, storage_path from public.credit_report_uploads where id=$1', [id]))[0];
  ok(row.status === 'deleted' && row.storage_path === null, 'tombstone');
  ok((await q(`select 1 from public.document_storage_cleanup where bucket='credit-uploads' and storage_path=$1`, [`${M}/${id}/report.pdf`])).length === 1, 'file queued for storage cleanup in the credit bucket');
  ok((await q('select 1 from public.credit_accounts where report_id=$1', [rid])).length === 1, 'deleting the FILE does not delete the accounts the member already reviewed');
  must(await rpc(M, 'delete_credit_report', rid), 'delete report');
  ok((await q('select 1 from public.credit_accounts where report_id=$1', [rid])).length === 0, 'deleting the report removes its accounts');
});

await test('expiry job removes old uploaded files (service only)', async () => {
  const id = '22222222-2222-4222-8222-222222222222';
  must(await tryAs(db, N, `insert into storage.objects (bucket_id, name, owner) values ('credit-uploads', $1, $2)`, [`${N}/${id}/report.png`, N]), 'upload');
  must(await rpc(N, 'register_credit_upload', id, 'other', 'png', 1, 2000, 'image/png', null), 'register');
  await db.query(`update public.credit_report_uploads set expires_at = now() - interval '1 day' where id = $1`, [id]);
  ok(Number(must(await rpc('service', 'expire_credit_uploads'), 'expire')[0].expire_credit_uploads) === 1, 'expired one');
  ok((await q(`select status from public.credit_report_uploads where id=$1`, [id]))[0].status === 'deleted', 'expired upload is gone');
});

await test('manual entry works without any upload, and confirmed data feeds the same rules', async () => {
  const rid = must(await rpc(N, 'create_manual_credit_report', 'equifax', '2026-09-01'), 'manual report')[0].create_manual_credit_report;
  const acc = must(await rpc(N, 'add_credit_account', rid, JSON.stringify({ furnisher_name: 'Corner Lender', account_number: '123456789', payment_status: 'late_60', opened_date: '2021-02-02', balance_cents: 50000 })), 'add')[0];
  ok(acc.source === 'manual' && acc.extraction_state === 'member_confirmed' && acc.account_last4 === '6789', 'manual entry is confirmed by definition; last4 only');
  ok((await q(`select stage from public.credit_review_items where account_id=$1`, [acc.id]))[0].stage === 'negative_item', 'manual late account -> negative item, not a dispute');
});

await test('deleting a member removes every credit record', async () => {
  await db.query('delete from auth.users where id = $1', [M]);
  for (const t of ['credit_reports', 'credit_accounts', 'credit_review_items', 'credit_disputes', 'credit_dispute_events', 'credit_dispute_evidence', 'credit_inquiries', 'credit_report_uploads']) {
    ok((await q(`select 1 from public.${t} where user_id = $1`, [M])).length === 0, t + ' survived');
  }
});

done('local Postgres');
