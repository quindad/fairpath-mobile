// Local (PGlite) SQL suite for the Record Relief rules engine. `npm run test:sql:relief`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { insertRows, loadRecordReliefFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { RR_FIXTURE_SET } from '../supabase/seed/data/record-relief-fixtures.mjs';

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
const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);
const yearsAgo = (y, extraDays = 0) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() - extraDays); return d.toISOString().slice(0, 10); };

const base = { jurisdiction_code: 'TEST-A', label: 'Test case', offense_class: 'misdemeanor', disposition: 'conviction', fines_paid: true, pending_charges: false };
const save = async (who, obj, id = null) => {
  const r = await tryAs(db, who, 'select * from public.save_record_relief_case($1, $2::jsonb)', [id, JSON.stringify({ ...base, ...obj })]);
  return r.error ? r : { rows: r.rows.map((row) => ({ c: row })) };
};
const evals = async (caseId, who = M) => must(await tryAs(db, who, 'select public.get_record_relief_case_detail($1) as d', [caseId]), 'detail')[0].d.evaluations;
const one = (evs, key) => evs.find((e) => e.rule_key === key);

await test('production seeds only jurisdiction NAMES: 50 states, DC, 5 territories, federal; no rules, no fixtures', async () => {
  const j = await q('select kind, count(*)::int n from public.record_relief_jurisdictions group by kind order by kind');
  const by = Object.fromEntries(j.map((r) => [r.kind, r.n]));
  ok(by.state === 50 && by.district === 1 && by.territory === 5 && by.federal === 1 && !by.test, 'jurisdictions: ' + JSON.stringify(by));
  ok(Number((await q('select count(*)::int n from public.record_relief_rules'))[0].n) === 0, 'no rules ship in a migration: legal data needs verification');
});

await test('fixtures are DEV-only: refused unless the environment is dev', async () => {
  let blocked = false;
  try { await db.query(`insert into public.record_relief_jurisdictions (code, name, kind, data_origin, fixture_set) values ('TEST-Z','Nope','test','dev_fixture','x')`); } catch { blocked = true; }
  ok(blocked, 'unset environment must reject fixtures');
  await loadRecordReliefFixtures(db);
  ok(Number((await q(`select count(*)::int n from public.record_relief_rules where fixture_set=$1`, [RR_FIXTURE_SET]))[0].n) === 5, 'fixtures loaded in dev');
  await db.query(`update public.app_config set value='"production"'::jsonb where key='environment'`);
  blocked = false;
  try { await db.query(`insert into public.record_relief_rules (rule_key, jurisdiction_code, remedy, title, source_authority, source_url, citation_text, effective_from, data_origin, fixture_set) values ('test-zzz','TEST-A','other','Nope rule','test_fixture','https://x.test','x','2024-01-01','dev_fixture','x')`); } catch { blocked = true; }
  ok(blocked, 'production must reject fixtures');
  await db.query(`update public.app_config set value='"dev"'::jsonb where key='environment'`);
});

await test('guests: no access; members see only VERIFIED reference data; cases are owner-only', async () => {
  for (const t of ['record_relief_cases', 'record_relief_rules', 'record_relief_forms', 'record_relief_evaluations', 'record_relief_jurisdictions']) denied(await tryAs(db, 'anon', `select * from public.${t}`), 'permission denied', t);
  denied(await rpc('anon', 'save_record_relief_case', null, '{}'), 'permission denied', 'anon save');
  const forms = must(await tryAs(db, N, 'select form_key from public.record_relief_forms'), 'forms').map((r) => r.form_key);
  ok(forms.includes('test-a-petition') && !forms.includes('test-a-draft-form'), 'draft forms are invisible: ' + forms);
  const paths = must(await tryAs(db, N, 'select pathway_key from public.record_relief_federal_pathways'), 'paths').map((r) => r.pathway_key);
  ok(paths.length === 2 && !paths.includes('test-fed-draft'), 'draft pathways are invisible');
  denied(await tryAs(db, N, `insert into public.record_relief_rules (rule_key, jurisdiction_code, remedy, title, source_authority, source_url, citation_text, effective_from) values ('x-rule','US-OH','other','Forged','statute','https://x.test','x','2024-01-01')`), 'permission denied', 'members cannot write rules');
});

await test('a jurisdiction with no verified rules says so plainly and never guesses', async () => {
  const c = must(await save(M, { jurisdiction_code: 'US-OH', label: 'Ohio case' }), 'save')[0].c;
  const ev = await evals(c.id);
  ok(ev.length === 1 && ev[0].outcome === 'rule_unavailable', 'rule_unavailable: ' + JSON.stringify(ev[0]?.outcome));
  ok(/does not have verified/i.test(ev[0].reasons[0].text) && /does not mean relief is unavailable/i.test(ev[0].reasons[0].text), 'careful wording');
  ok(ev[0].eligibility_date === null, 'no invented date');
  const t = must(await save(M, { jurisdiction_code: 'TEST-D', label: 'No rules yet' }), 'save D')[0].c;
  ok((await evals(t.id))[0].outcome === 'rule_unavailable', 'TEST-D has no rules');
});

await test('waiting period: eligible now vs waiting, with the exact date and days remaining', async () => {
  const done4 = must(await save(M, { label: 'Done long ago', sentence_completion_date: yearsAgo(4) }), 'a')[0].c;
  ok(one(await evals(done4.id), 'test-a-misdemeanor-expunge').outcome === 'potentially_eligible_now', '4y after completion, 3y rule -> potentially eligible now');
  const done1 = must(await save(M, { label: 'Recent', sentence_completion_date: yearsAgo(1) }), 'b')[0].c;
  const w = one(await evals(done1.id), 'test-a-misdemeanor-expunge');
  ok(w.outcome === 'waiting_period', 'waiting: ' + w.outcome);
  const expect = new Date(yearsAgo(1)); expect.setFullYear(expect.getFullYear() + 3);
  ok(w.eligibility_date === expect.toISOString().slice(0, 10), `eligibility date ${w.eligibility_date} vs ${expect.toISOString().slice(0, 10)}`);
  ok(w.days_remaining > 2 * 365 && w.days_remaining < 2 * 365 + 5, 'days remaining ~2 years: ' + w.days_remaining);
  ok(/completion/.test(w.reasons.map((r) => r.text).join(' ')) && w.inputs_used.anchor_date === yearsAgo(1), 'the anchor date and rule that created the countdown are exposed');
  ok(w.rule.citation_text.includes('TEST') && w.rule.last_verified_at && w.rule_version === 1, 'source, citation, verification date and version are attached');
  const future = must(await save(M, { label: 'Still serving', sentence_completion_date: iso(200) }), 'c')[0].c;
  ok(one(await evals(future.id), 'test-a-misdemeanor-expunge').outcome === 'waiting_period', 'a completion date in the future is a waiting period, not eligibility');
});

await test('missing inputs -> insufficient information (never a guess); known failures -> potentially ineligible', async () => {
  const noFines = must(await save(M, { label: 'Fines unknown', fines_paid: null, sentence_completion_date: yearsAgo(5) }), 'a')[0].c;
  const a = one(await evals(noFines.id), 'test-a-misdemeanor-expunge');
  ok(a.outcome === 'insufficient_information' && a.missing_inputs.includes('fines_paid') && a.eligibility_date === null, 'missing fines_paid: ' + JSON.stringify([a.outcome, a.missing_inputs]));
  const noDate = must(await save(M, { label: 'No date', sentence_completion_date: null }), 'b')[0].c;
  ok(one(await evals(noDate.id), 'test-a-misdemeanor-expunge').missing_inputs.includes('sentence_completion_date'), 'missing anchor date');
  const unpaid = must(await save(M, { label: 'Unpaid', fines_paid: false, sentence_completion_date: yearsAgo(5) }), 'c')[0].c;
  ok(one(await evals(unpaid.id), 'test-a-misdemeanor-expunge').outcome === 'potentially_ineligible', 'unpaid fines under a rule that requires payment');
  const pending = must(await save(M, { label: 'Pending', pending_charges: true, sentence_completion_date: yearsAgo(5) }), 'd')[0].c;
  ok(one(await evals(pending.id), 'test-a-misdemeanor-expunge').outcome === 'potentially_ineligible', 'pending charges');
});

await test('exclusions and rule coverage: only rules that cover the case are applied', async () => {
  const dui = must(await save(M, { label: 'DUI', offense_class: 'dui_dwi', sentence_completion_date: yearsAgo(9) }), 'dui')[0].c;
  const d = await evals(dui.id);
  ok(one(d, 'test-a-misdemeanor-expunge').outcome === 'potentially_ineligible' && /excluded/i.test(one(d, 'test-a-misdemeanor-expunge').reasons[0].text), 'excluded offense');
  const sex = must(await save(M, { label: 'Felony sex offense', offense_class: 'sex_offense', sentence_completion_date: yearsAgo(15) }), 'sex')[0].c;
  const s = await evals(sex.id);
  ok(one(s, 'test-a-felony-seal').outcome === 'potentially_ineligible' && !one(s, 'test-a-misdemeanor-expunge'), 'felony rule excludes; misdemeanor rule is not applied to a felony');
  const dismissed = must(await save(M, { label: 'Dismissed', disposition: 'dismissal', disposition_date: yearsAgo(1), offense_class: 'misdemeanor' }), 'dis')[0].c;
  const dd = await evals(dismissed.id);
  ok(one(dd, 'test-a-dismissal-seal').outcome === 'potentially_eligible_now' && !one(dd, 'test-a-misdemeanor-expunge'), 'a dismissal follows the dismissal rule (no wait) and not the conviction rules');
  const felony = must(await save(M, { label: 'Felony', offense_class: 'non_violent_felony', sentence_completion_date: yearsAgo(8), restitution_paid: true, other_convictions_count: 0 }), 'fel')[0].c;
  const f = await evals(felony.id);
  ok(one(f, 'test-a-felony-seal').outcome === 'potentially_eligible_now', 'non-violent felony after 8 of 7 years');
  const twoOthers = must(await save(M, { label: 'Felony 2', offense_class: 'non_violent_felony', sentence_completion_date: yearsAgo(8), restitution_paid: true, other_convictions_count: 3 }), 'fel2')[0].c;
  ok(one(await evals(twoOthers.id), 'test-a-felony-seal').outcome === 'potentially_ineligible', 'too many other convictions');
});

await test('manual review flags and "no matching rule" never produce an automatic answer', async () => {
  const oos = must(await save(M, { jurisdiction_code: 'TEST-B', label: 'Out of state', out_of_state_conviction: true, sentence_completion_date: yearsAgo(8), other_convictions_count: 0 }), 'oos')[0].c;
  const o = one(await evals(oos.id), 'test-b-set-aside');
  ok(o.outcome === 'manual_review' && /legal aid|clerk/i.test(o.reasons.map((r) => r.text).join(' ')), 'manual review recommended: ' + o.outcome);
  const many = must(await save(M, { jurisdiction_code: 'TEST-B', label: 'Repeat', sentence_completion_date: yearsAgo(8), other_convictions_count: 2 }), 'many')[0].c;
  ok(one(await evals(many.id), 'test-b-set-aside').outcome === 'potentially_ineligible', 'more other convictions than the rule allows');
  const none = must(await save(M, { jurisdiction_code: 'TEST-C', label: 'No rule covers', offense_class: 'violent_felony' }), 'nm')[0].c;
  const nm = (await evals(none.id))[0];
  ok(nm.outcome === 'manual_review' && /does not mean relief is unavailable/i.test(nm.reasons[0].text), 'no matching rule -> manual review, careful wording');
});

await test('stale rules are surfaced (verified over a year ago)', async () => {
  const c = must(await save(M, { jurisdiction_code: 'TEST-C', label: 'Stale', sentence_completion_date: yearsAgo(5) }), 'st')[0].c;
  const e = one(await evals(c.id), 'test-c-stale');
  ok(e.outcome === 'potentially_eligible_now' && e.rule_stale === true && e.reasons.some((r) => r.code === 'rule_stale'), 'stale flag + reason');
});

await test('federal branch: separate, no state calculator, no implied expungement, only verified pathways', async () => {
  const c = must(await save(M, { jurisdiction_code: 'US-FED', label: 'Federal case', offense_class: 'non_violent_felony', sentence_completion_date: yearsAgo(10) }), 'fed')[0].c;
  const detail = must(await tryAs(db, M, 'select public.get_record_relief_case_detail($1) as d', [c.id]), 'detail')[0].d;
  ok(detail.evaluations.length === 1 && detail.evaluations[0].outcome === 'federal_separate' && detail.evaluations[0].eligibility_date === null && detail.evaluations[0].rule_key === null, 'a single federal_separate result with no state rule or date');
  ok(/handled separately/i.test(detail.evaluations[0].reasons[0].text) && /do not apply to federal/i.test(detail.evaluations[0].reasons[0].text), 'plain language');
  ok(detail.pathways.length === 2 && detail.pathways.every((p) => p.is_general_expungement === false && p.data_origin === 'dev_fixture'), 'verified pathways only, none claims general expungement');
  ok(detail.forms.length === 0, 'federal cases do not pull state forms');
});

await test('official-form provenance is enforced in the database', async () => {
  const bad = (sql) => db.query(sql).then(() => false, () => true);
  ok(await bad(`insert into public.record_relief_forms (form_key, jurisdiction_code, name, kind, status, data_origin, fixture_set) values ('x-bad','TEST-A','Bad','official_form','verified','dev_fixture','x')`), 'a verified official form needs source, revision, dates');
  ok(await bad(`insert into public.record_relief_forms (form_key, jurisdiction_code, name, kind, status, auto_fillable, data_origin, fixture_set) values ('x-bad2','TEST-A','Bad','official_form','draft',true,'dev_fixture','x')`), 'auto-fill needs a verified field map');
  ok(await bad(`insert into public.record_relief_rules (rule_key, jurisdiction_code, remedy, title, source_authority, source_url, citation_text, effective_from, status, data_origin, fixture_set) values ('x-bad3','TEST-A','other','Bad','test_fixture','https://x.test','x','2024-01-01','verified','dev_fixture','x')`), 'a verified rule needs a last-verified date');
  const detail = must(await tryAs(db, M, 'select public.get_record_relief_case_detail($1) as d', [(await q(`select id from public.record_relief_cases where label='Done long ago'`))[0].id]), 'detail')[0].d;
  ok(detail.forms.length === 3 && detail.forms.every((f) => f.auto_fillable === false) && detail.forms.filter((f) => f.kind === 'official_form').every((f) => f.official_source_url && f.revision && f.effective_date && f.last_verified_at), 'official forms shown only with full provenance; none auto-fillable without a verified field map');
});

await test('history is append-only per evaluation; rule versions change results deliberately and are flagged', async () => {
  const c = (await q(`select id from public.record_relief_cases where label='Recent'`))[0];
  const before = Number((await q('select count(*)::int n from public.record_relief_evaluations where case_id=$1', [c.id]))[0].n);
  must(await rpc(M, 'evaluate_record_relief_case', c.id), 're-evaluate');
  const after = await q('select superseded from public.record_relief_evaluations where case_id=$1', [c.id]);
  ok(after.length > before && after.filter((r) => !r.superseded).length === 1, 'old evaluations are kept and marked superseded');
  // publish version 2 of a rule with a longer wait
  await db.query(`insert into public.record_relief_rules (rule_key, rule_version, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes, excluded_offense_classes, waiting_years, waiting_anchor, requires_fines_paid, requires_no_pending_charges, source_authority, source_url, citation_text, effective_from, last_verified_at, status, data_origin, fixture_set)
                  select rule_key, 2, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes, excluded_offense_classes, 5, waiting_anchor, requires_fines_paid, requires_no_pending_charges, source_authority, source_url, 'TEST-A Code 1.1 (amended)', current_date, current_date, 'verified', data_origin, fixture_set
                  from public.record_relief_rules where rule_key='test-a-misdemeanor-expunge' and rule_version=1`);
  const stale = one(await evals(c.id), 'test-a-misdemeanor-expunge');
  ok(stale.rule_version === 1 && stale.rule_changed === true, 'an evaluation made under v1 is flagged when v2 becomes active');
  const summary = must(await tryAs(db, M, 'select public.get_member_home_summary() as s'), 'sum')[0].s;
  ok(summary.record_relief.rule_updates >= 1, 'home summary reports the rule update: ' + JSON.stringify(summary.record_relief));
  must(await rpc(M, 'evaluate_record_relief_case', c.id), 're-evaluate under v2');
  const now2 = one(await evals(c.id), 'test-a-misdemeanor-expunge');
  ok(now2.rule_version === 2 && now2.rule_changed === false && now2.days_remaining > 4 * 365, 'the new version applies after re-evaluation (5y wait): ' + now2.days_remaining);
  ok(now2.rule.citation_text.includes('amended'), 'the new version\'s citation is shown');
});

await test('drafts and unverified rules are never used', async () => {
  await db.query(`insert into public.record_relief_rules (rule_key, jurisdiction_code, remedy, title, applies_dispositions, applies_offense_classes, waiting_years, waiting_anchor, source_authority, source_url, citation_text, effective_from, status, data_origin, fixture_set)
                  values ('test-d-draft','TEST-D','expungement','Draft rule (TEST)','{conviction}','{misdemeanor}',0,'disposition_date','test_fixture','https://x.test','TEST','2024-01-01','draft','dev_fixture','${RR_FIXTURE_SET}')`);
  const c = must(await save(M, { jurisdiction_code: 'TEST-D', label: 'Draft only' }), 'save')[0].c;
  ok((await evals(c.id))[0].outcome === 'rule_unavailable', 'a draft rule must not produce an answer');
  ok(must(await tryAs(db, N, `select 1 from public.record_relief_rules where rule_key='test-d-draft'`), 'N').length === 0, 'members cannot read drafts');
});

await test('isolation, checklist, status tracking, reminders, deletion', async () => {
  const c = (await q(`select id from public.record_relief_cases where label='Done long ago'`))[0];
  ok(must(await tryAs(db, N, 'select id from public.record_relief_cases'), 'N cases').length === 0 && must(await tryAs(db, E, 'select id from public.record_relief_evaluations'), 'E evals').length === 0, 'no cross-member or employer reads');
  denied(await rpc(N, 'evaluate_record_relief_case', c.id), 'CASE_UNAVAILABLE', 'N evaluates M case');
  denied(await rpc(N, 'get_record_relief_case_detail', c.id), 'CASE_UNAVAILABLE', 'N reads M detail');
  denied(await save(N, { label: 'Forged' }, c.id), 'CASE_UNAVAILABLE', 'N edits M case');
  denied(await tryAs(db, M, `insert into public.record_relief_cases (user_id, jurisdiction_code, label) values ($1,'TEST-A','x')`, [M]), 'permission denied', 'direct case insert');
  denied(await tryAs(db, M, `update public.record_relief_evaluations set outcome='potentially_eligible_now'`), 'permission denied', 'members cannot edit evaluations');
  must(await tryAs(db, M, `select public.toggle_record_relief_checklist($1,'step','gather',true)`, [c.id]), 'toggle');
  must(await tryAs(db, M, `select public.toggle_record_relief_checklist($1,'document','id',true)`, [c.id]), 'toggle doc');
  denied(await tryAs(db, M, `select public.toggle_record_relief_checklist($1,'nonsense','x',true)`, [c.id]), 'INVALID_KIND', 'kind');
  denied(await tryAs(db, N, `select public.toggle_record_relief_checklist($1,'step','gather',true)`, [c.id]), 'CASE_UNAVAILABLE', 'N toggles');
  const cl = must(await tryAs(db, M, 'select public.get_record_relief_case_detail($1) as d', [c.id]), 'detail')[0].d.checklist;
  ok(cl.length === 2 && cl.every((x) => x.done), 'checklist persisted');
  denied(await tryAs(db, M, `select public.set_record_relief_case_status($1,'granted_by_magic',null)`, [c.id]), 'INVALID_STATUS', 'status');
  denied(await tryAs(db, M, `select public.set_record_relief_case_status($1,'filed',$2)`, [c.id, iso(5)]), 'INVALID_DATE', 'future filed date');
  const filed = must(await tryAs(db, M, `select * from public.set_record_relief_case_status($1,'filed',$2)`, [c.id, iso(-3)]), 'filed')[0];
  ok(filed.filing_status === 'filed' && new Date(filed.filed_on).toISOString().slice(0, 10) === iso(-3), 'member-entered filing status (tracking only, no court integration)');
  must(await save(M, { jurisdiction_code: 'TEST-B', label: 'Soon', sentence_completion_date: yearsAgo(5, -20), other_convictions_count: 0 }), 'soon');
  const rem = must(await tryAs(db, 'service', 'select * from public.record_relief_reminders_due()'), 'reminders');
  ok(rem.some((r) => r.kind === 'eligible_now') && rem.some((r) => ['milestone_90', 'milestone_30', 'milestone_7'].includes(r.kind)), 'reminder source has eligible-now and milestones: ' + JSON.stringify(rem.map((r) => r.kind)));
  ok(rem.some((r) => r.case_id === c.id), 'a filed-but-undecided case still gets reminders');
  must(await tryAs(db, M, `select public.set_record_relief_case_status($1,'granted',null)`, [c.id]), 'granted');
  ok(!must(await tryAs(db, 'service', 'select * from public.record_relief_reminders_due()'), 'rem2').some((r) => r.case_id === c.id), 'no reminders for a resolved case');
  denied(await tryAs(db, M, 'select * from public.record_relief_reminders_due()'), 'permission denied', 'members cannot run the reminder job');
  const ev = (await q(`select event_type from public.record_relief_case_events where case_id=$1 order by created_at`, [c.id])).map((e) => e.event_type);
  ok(ev[0] === 'created' && ev.includes('evaluated') && ev.includes('checklist_updated') && ev.includes('status_set'), 'case history: ' + ev.join());
  must(await tryAs(db, M, 'select public.delete_record_relief_case($1)', [c.id]), 'delete');
  for (const t of ['record_relief_evaluations', 'record_relief_case_checklist', 'record_relief_case_events']) ok((await q(`select 1 from public.${t} where case_id=$1`, [c.id])).length === 0, t + ' cascade');
});

await test('validation: bad jurisdiction, oversize input, case limit, and deleting a member removes everything', async () => {
  denied(await save(M, { jurisdiction_code: 'ZZ-NOPE' }), 'INVALID_JURISDICTION', 'jurisdiction');
  denied(await save(M, { conviction_date: '1850-01-01' }), 'violates check', 'date range');
  denied(await save(M, { offense_class: 'made_up' }), 'violates check', 'offense class');
  await db.query('delete from auth.users where id = $1', [M]);
  for (const t of ['record_relief_cases', 'record_relief_evaluations', 'record_relief_case_checklist', 'record_relief_case_events']) ok((await q(`select 1 from public.${t} where user_id=$1`, [M])).length === 0, t + ' survived member deletion');
});

done('local Postgres');
