// Local (PGlite) SQL suite: AI provenance ledger + member reminder generation. `npm run test:sql:ai`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { loadRecordReliefFixtures, loadResourceFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
await loadResourceFixtures(db);
await loadRecordReliefFixtures(db);

const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 220)}`);
const q = (sql, p = []) => db.query(sql, p).then((r) => r.rows);
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const yearsAgo = (y, extra = 0) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() - extra); return d.toISOString().slice(0, 10); };
const log = (who, o = {}) => tryAs(db, who, 'select public.log_ai_interaction($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9) as id', [
  o.task ?? 'credit_explain', o.intent ?? 'why_flagged', o.engine ?? 'deterministic_router', o.route ?? '/credit/item/abc', JSON.stringify(o.refs ?? [{ kind: 'credit_item', id: 'i1' }]),
  JSON.stringify(o.rules ?? []), JSON.stringify(o.official ?? [{ label: 'CFPB', url: 'https://www.consumerfinance.gov/' }]), o.confidence ?? 'deterministic', o.confirmation ?? 'not_required']);

// ------------------------------------------------------------------ AI provenance
await test('guests cannot log or read AI provenance; it is owner-only', async () => {
  denied(await log('anon'), 'permission denied', 'anon log');
  denied(await tryAs(db, 'anon', 'select * from public.ai_interactions'), 'permission denied', 'anon read');
  const id = must(await log(M), 'M log')[0].id;
  ok(must(await tryAs(db, N, 'select id from public.ai_interactions'), 'N').length === 0, "N reads M's provenance");
  ok(must(await tryAs(db, M, 'select id from public.ai_interactions'), 'M').some((r) => r.id === id), 'M reads their own');
  denied(await tryAs(db, M, `update public.ai_interactions set confidence = 'high'`), 'permission denied', 'no direct edits');
  denied(await tryAs(db, M, `insert into public.ai_interactions (user_id, task, intent, engine, confidence) values ($1,'navigation','x_y','model','high')`, [M]), 'permission denied', 'no direct inserts');
});

await test('provenance stores references, never content: strict shape validation', async () => {
  denied(await log(M, { task: 'free_chat' }), 'violates check', 'unknown task');
  denied(await log(M, { engine: 'gpt' }), 'violates check', 'unknown engine');
  denied(await log(M, { intent: 'Why did you flag this?!' }), 'violates check', 'free text intent');
  denied(await log(M, { route: 'https://evil.example/x' }), 'violates check', 'external route');
  denied(await log(M, { route: 'javascript:alert(1)' }), 'violates check', 'script route');
  denied(await log(M, { refs: [{ kind: 'credit_item', id: 'i1', text: 'Metro Credit Card balance $2650' }] }), 'INVALID_PROVENANCE', 'content smuggled into refs');
  denied(await log(M, { refs: [{ kind: 'ssn', id: '123' }] }), 'INVALID_PROVENANCE', 'unknown ref kind');
  denied(await log(M, { refs: [{ kind: 'credit_item', id: 'x'.repeat(80) }] }), 'INVALID_PROVENANCE', 'oversized id');
  denied(await log(M, { official: [{ label: 'x', url: 'http://insecure.example' }] }), 'INVALID_PROVENANCE', 'non-https source');
  denied(await log(M, { rules: [{ rule_key: 'ok', extra: 1, more: 2 }] }), 'INVALID_PROVENANCE', 'extra keys in rule versions');
  must(await log(M, { task: 'relief_explain', intent: 'when_eligible', refs: [{ kind: 'relief_case', id: 'c1' }, { kind: 'relief_evaluation', id: 'e1' }], rules: [{ rule_key: 'test-a-misdemeanor-expunge', rule_version: 1 }], confidence: 'medium', confirmation: 'pending' }), 'valid rich log');
  const cols = await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='ai_interactions' and data_type = 'text'`);
  ok(cols.map((c) => c.column_name).sort().join() === 'confidence,confirmation_state,engine,intent,route,task', 'the only text columns are enumerated/validated ones: ' + cols.map((c) => c.column_name));
});

await test('confirmation is member-only and pending-only; history can be deleted; expiry is service-only', async () => {
  const pending = (await q(`select id from public.ai_interactions where user_id=$1 and confirmation_state='pending'`, [M]))[0].id;
  denied(await tryAs(db, N, 'select public.set_ai_confirmation($1, $2)', [pending, 'confirmed']), 'INTERACTION_UNAVAILABLE', "N confirms M's");
  denied(await tryAs(db, M, 'select public.set_ai_confirmation($1, $2)', [pending, 'maybe']), 'INVALID_STATE', 'bad state');
  must(await tryAs(db, M, 'select public.set_ai_confirmation($1, $2)', [pending, 'confirmed']), 'confirm');
  denied(await tryAs(db, M, 'select public.set_ai_confirmation($1, $2)', [pending, 'rejected']), 'INTERACTION_UNAVAILABLE', 'cannot flip a decided confirmation');
  denied(await tryAs(db, M, 'select public.expire_ai_interactions()'), 'permission denied', 'members cannot expire');
  await db.query(`update public.ai_interactions set expires_at = now() - interval '1 day' where user_id = $1 and task = 'credit_explain'`, [M]);
  ok(Number(must(await tryAs(db, 'service', 'select public.expire_ai_interactions() as n'), 'expire')[0].n) >= 1, 'expired rows removed');
  const n = Number(must(await tryAs(db, M, 'select public.delete_my_ai_history() as n'), 'delete')[0].n);
  ok(n >= 1 && (await q('select 1 from public.ai_interactions where user_id=$1', [M])).length === 0, 'members can delete all of their AI provenance');
});

await test('rate limit: 300 logs per member per day', async () => {
  for (let i = 0; i < 300; i++) { const r = await log(N, { intent: 'nav_' + (i % 5) }); if (r.error) throw new Error('log ' + i + ': ' + r.error); }
  denied(await log(N), 'AI_LOG_RATE_LIMIT', '301st');
  await db.query('delete from public.ai_interactions where user_id=$1', [N]);
});

// ------------------------------------------------------------------ reminders
await test('setup: real state for reminders (dispute, countdowns, expiring document, unavailable resource)', async () => {
  await db.query(`insert into public.credit_disputes (user_id, target_kind, target_name, reason, status, sent_on, response_due_on) values ($1,'bureau','TransUnion','A long enough reason for the dispute.','sent',$2,$3)`, [M, iso(-25), iso(5)]);
  await db.query(`insert into public.credit_disputes (user_id, target_kind, target_name, reason, status, sent_on, response_due_on) values ($1,'furnisher','Metro Credit Card','Another long enough reason here.','sent',$2,$3)`, [M, iso(-50), iso(-20)]);
  const save = (obj) => tryAs(db, M, 'select * from public.save_record_relief_case($1, $2::jsonb)', [null, JSON.stringify({ jurisdiction_code: 'TEST-A', label: 'Sensitive Label 2016 theft', case_number: 'CR-2016-1234', offense_class: 'misdemeanor', disposition: 'conviction', fines_paid: true, pending_charges: false, ...obj })]);
  must(await save({ sentence_completion_date: yearsAgo(4) }), 'eligible now case');
  must(await save({ jurisdiction_code: 'TEST-B', label: 'Soon case', sentence_completion_date: yearsAgo(5, -20), other_convictions_count: 0 }), 'soon case');
  await db.query(`insert into public.generated_documents (user_id, document_type, source_module, title, file_name, format, template_id, template_version, input_fingerprint, persist_policy, storage_path, expires_at, sensitivity)
                  values ($1,'credit_review_summary','credit','Secret Title Doc','FairPath_Account_Summary_2026-10-04.pdf','pdf','t','1','abcdef12','stored',$2,$3,'highly_sensitive')`, [M, `${M}/x/v1.pdf`, new Date(Date.now() + 3 * 86400000).toISOString()]);
  must(await tryAs(db, M, 'select public.save_resource($1)', [rid('pantry-cle-44113')]), 'save resource');
  await db.query(`update public.resources set publish_status='retired' where id=$1`, [rid('pantry-cle-44113')]);
});

await test('generate_member_reminders: creates each meaningful reminder once, service-only', async () => {
  denied(await tryAs(db, M, 'select public.generate_member_reminders()'), 'permission denied', 'member run');
  denied(await tryAs(db, 'anon', 'select public.generate_member_reminders()'), 'permission denied', 'anon run');
  const n = Number(must(await tryAs(db, 'service', 'select public.generate_member_reminders() as n'), 'run')[0].n);
  const rows = await q(`select category, title, body, route, dedupe_key from public.user_notifications where user_id=$1`, [M]);
  const cats = rows.map((r) => r.category).sort().join();
  ok(n === rows.length && n >= 6, `expected 6+ reminders, made ${n}: ${cats}`);
  ok(rows.some((r) => r.category === 'credit_dispute' && /due soon/i.test(r.title)) && rows.some((r) => r.category === 'credit_dispute' && /overdue/i.test(r.title)), 'dispute due-soon and overdue');
  ok(rows.some((r) => r.category === 'record_relief' && /may have ended/i.test(r.title)) && rows.some((r) => r.category === 'record_relief' && /within a month/i.test(r.title)), 'record relief eligible-now and 30-day milestone');
  ok(rows.some((r) => r.category === 'documents') && rows.some((r) => r.category === 'resources'), 'expiring document and unavailable resource');
  const again = Number(must(await tryAs(db, 'service', 'select public.generate_member_reminders() as n'), 'rerun')[0].n);
  ok(again === 0, 're-running must not repeat any reminder (dedupe), made ' + again);
  ok((await q(`select count(*)::int n from public.user_notifications where user_id=$1`, [M]))[0].n === rows.length, 'no duplicates');
});

await test('reminder text is lock-screen safe: no names, labels, case numbers, jurisdictions or document titles', async () => {
  const text = (await q(`select title || ' ' || body as t from public.user_notifications where user_id=$1`, [M])).map((r) => r.t).join(' ');
  for (const secret of ['TransUnion', 'Metro', 'Sensitive Label', 'CR-2016', 'Testland', 'TEST-', 'Secret Title', 'Account_Summary', 'pantry', 'Lakeshore']) ok(!text.includes(secret), `notification text leaks "${secret}"`);
  ok(!/guarantee|record will be (cleared|erased|removed|deleted)|you are eligible|will be eligible/i.test(text), 'no promises or determinations in notification text');
  const routes = (await q(`select route from public.user_notifications where user_id=$1`, [M])).map((r) => r.route);
  ok(routes.every((r) => r.startsWith('/')), 'deep links are in-app routes');
  ok((await q(`select count(*)::int n from public.user_notifications where user_id=$1`, [N]))[0].n === 0, "N got none of M's reminders");
});

await test('a changed rule produces exactly one rule-update reminder; resolved cases stop reminding', async () => {
  await db.query(`insert into public.record_relief_rules (rule_key, rule_version, jurisdiction_code, remedy, title, applies_dispositions, applies_offense_classes, excluded_offense_classes, waiting_years, waiting_anchor, requires_fines_paid, requires_no_pending_charges, source_authority, source_url, citation_text, effective_from, last_verified_at, status, data_origin, fixture_set)
                  select rule_key, 2, jurisdiction_code, remedy, title, applies_dispositions, applies_offense_classes, excluded_offense_classes, 6, waiting_anchor, requires_fines_paid, requires_no_pending_charges, source_authority, source_url, 'TEST amended', current_date, current_date, 'verified', data_origin, fixture_set
                  from public.record_relief_rules where rule_key='test-a-misdemeanor-expunge' and rule_version=1`);
  const before = (await q(`select count(*)::int n from public.user_notifications where user_id=$1 and dedupe_key like 'rr:rule:%'`, [M]))[0].n;
  must(await tryAs(db, 'service', 'select public.generate_member_reminders()'), 'run');
  const after = (await q(`select count(*)::int n from public.user_notifications where user_id=$1 and dedupe_key like 'rr:rule:%'`, [M]))[0].n;
  ok(before === 0 && after === 1, `rule update reminder once: ${before} -> ${after}`);
  must(await tryAs(db, 'service', 'select public.generate_member_reminders()'), 'rerun');
  ok((await q(`select count(*)::int n from public.user_notifications where user_id=$1 and dedupe_key like 'rr:rule:%'`, [M]))[0].n === 1, 'still once');
  await db.query(`update public.record_relief_cases set filing_status='granted' where user_id=$1`, [M]);
  const rem = await q(`select * from public.record_relief_reminders_due() where user_id=$1`, [M]);
  ok(rem.length === 0, 'cases marked granted no longer generate reminders');
});

await test('deleting a member removes AI provenance and notifications', async () => {
  await tryAs(db, M, 'select public.log_ai_interaction($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9)', ['navigation', 'open_screen', 'deterministic_router', '/me', '[]', '[]', '[]', 'deterministic', 'not_required']);
  await db.query('delete from auth.users where id=$1', [M]);
  ok((await q('select 1 from public.ai_interactions where user_id=$1', [M])).length === 0 && (await q('select 1 from public.user_notifications where user_id=$1', [M])).length === 0, 'cascade');
});

done('local Postgres');
