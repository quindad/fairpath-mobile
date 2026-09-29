// National Record Relief data-ops foundation: legal source monitoring + rule-candidate staging.
// Proves the core trust boundary: members can NEVER read staging/candidate data, and promotion to the live
// rules table always lands as status='draft' (never 'verified'), requiring a separately verified candidate.
// `node scripts/test-local-legal-monitoring.mjs`
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const M = await addUser(db, 'member@test.local');
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what) => ok(r.error && /permission denied|row-level security/i.test(r.error), `${what}: expected denial, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);

await test('an authenticated member cannot read any staging/monitoring table, at all', async () => {
  for (const t of ['legal_source_registry', 'legal_source_snapshots', 'legal_change_candidates', 'legal_rule_candidates', 'legal_review_queue']) {
    denied(await tryAs(db, M, `select * from public.${t}`), `member select on ${t}`);
  }
});

await test('a member cannot call promote_legal_rule_candidate or the impact RPC', async () => {
  denied(await rpc(M, 'promote_legal_rule_candidate', '00000000-0000-4000-8000-000000000000'), 'member calls promote');
  denied(await rpc(M, 'record_relief_rule_impact', 'x', 1), 'member calls impact RPC');
});

await test('promotion is refused for a candidate that is not yet verified', async () => {
  const src = must(await db.query(
    `insert into public.legal_source_registry (jurisdiction_code, authority_name, source_title, source_url) values ('US-OH','Ohio Legislative Service Commission','ORC Title 29','https://codes.ohio.gov/ohio-revised-code/title-29') returning id`), 'seed source');
  ok(src.length === 1, 'source seeded');

  const cand = must(await db.query(
    `insert into public.legal_rule_candidates (jurisdiction_code, pathway_key, lifecycle_state, payload, researched_by)
     values ('US-OH','legal-mon-test-rule','researched','{"rule_key":"legal-mon-test-rule","remedy":"expungement","title":"Test","applies_dispositions":["conviction"],"applies_offense_classes":["misdemeanor"],"waiting_anchor":"disposition_date","source_authority":"statute","source_url":"https://codes.ohio.gov/x","citation_text":"Test cite","effective_from":"2024-01-01"}'::jsonb,'researcher-1')
     returning id`), 'seed candidate');
  const candId = cand[0].id;

  const result = await db.query(`select public.promote_legal_rule_candidate($1)`, [candId]).catch((e) => ({ error: e.message }));
  ok(result.error && result.error.includes('CANDIDATE_NOT_VERIFIED'), `expected CANDIDATE_NOT_VERIFIED, got ${JSON.stringify(result)}`);
});

await test('promotion succeeds once verified, and always lands as draft - never verified - in the live table', async () => {
  const cand = must(await db.query(
    `insert into public.legal_rule_candidates (jurisdiction_code, pathway_key, lifecycle_state, payload, researched_by, reviewed_by)
     values ('US-OH','legal-mon-promote-test','verified','{"rule_key":"legal-mon-promote-test","remedy":"expungement","title":"Promotable rule","applies_dispositions":["conviction"],"applies_offense_classes":["misdemeanor"],"waiting_anchor":"disposition_date","source_authority":"statute","source_url":"https://codes.ohio.gov/x","citation_text":"Test cite","effective_from":"2024-01-01","court_discretion":true}'::jsonb,'researcher-1','reviewer-2')
     returning id`), 'seed verified candidate');
  const candId = cand[0].id;

  const promoted = await db.query(`select public.promote_legal_rule_candidate($1) as id`, [candId]);
  const newRuleId = promoted.rows[0].id;
  ok(!!newRuleId, 'promotion should return a new rule id');

  const row = (await db.query(`select status, court_discretion from public.record_relief_rules where id=$1`, [newRuleId])).rows[0];
  ok(row.status === 'draft', `promoted row must be status='draft', got "${row.status}" - promotion must never publish directly`);
  ok(row.court_discretion === true, 'the court_discretion flag from the candidate payload must survive promotion');

  const candAfter = (await db.query(`select lifecycle_state, promoted_rule_id from public.legal_rule_candidates where id=$1`, [candId])).rows[0];
  ok(candAfter.lifecycle_state === 'promoted' && candAfter.promoted_rule_id === newRuleId, 'candidate should be marked promoted with the new rule id linked');

  denied(await tryAs(db, M, `select * from public.record_relief_rules where id=$1`, [newRuleId]), "member reading a promoted-but-draft rule (must still be RLS-blocked, exactly like ordinary drafts)");
});

await test('a rejected/schema-blocked candidate cannot be promoted', async () => {
  const cand = must(await db.query(
    `insert into public.legal_rule_candidates (jurisdiction_code, pathway_key, lifecycle_state, payload, researched_by, reviewed_by, schema_blocked, schema_blocked_reason)
     values ('US-OH','legal-mon-blocked-test','verified','{"rule_key":"legal-mon-blocked-test","remedy":"expungement","title":"Blocked","applies_dispositions":["conviction"],"applies_offense_classes":["misdemeanor"],"waiting_anchor":"disposition_date","source_authority":"statute","source_url":"https://codes.ohio.gov/x","citation_text":"x","effective_from":"2024-01-01"}'::jsonb,'r1','r2',true,'needs multi-case aggregation logic the schema does not have yet')
     returning id`), 'seed schema-blocked candidate');
  const result = await db.query(`select public.promote_legal_rule_candidate($1)`, [cand[0].id]).catch((e) => ({ error: e.message }));
  ok(result.error && result.error.includes('CANDIDATE_SCHEMA_BLOCKED'), `expected CANDIDATE_SCHEMA_BLOCKED, got ${JSON.stringify(result)}`);
});

await test('reviewed_by must differ from researched_by (a candidate cannot self-verify)', async () => {
  const result = await db.query(
    `insert into public.legal_rule_candidates (jurisdiction_code, pathway_key, lifecycle_state, payload, researched_by, reviewed_by)
     values ('US-OH','legal-mon-self-verify-test','verified','{}'::jsonb,'same-person','same-person')`,
  ).catch((e) => ({ error: e.message }));
  ok(result.error, 'a candidate with reviewed_by = researched_by should be rejected by the CHECK constraint');
});

await test('impact analysis correctly counts only non-superseded evaluations for the exact rule version', async () => {
  await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);
  await db.query(`insert into public.record_relief_jurisdictions (code, name, kind, data_origin, fixture_set) values ('IMPACT-TEST','Impact Test','test','dev_fixture','legal-mon-test') on conflict do nothing`);
  const c1 = await addUser(db, 'impact-1@test.local');
  const c2 = await addUser(db, 'impact-2@test.local');
  await db.query(`insert into public.record_relief_cases (user_id, jurisdiction_code, label) values ($1,'IMPACT-TEST','c1'),($2,'IMPACT-TEST','c2')`, [c1, c2]);
  const cases = (await db.query(`select id, user_id from public.record_relief_cases where jurisdiction_code='IMPACT-TEST'`)).rows;
  for (const c of cases) {
    await db.query(`insert into public.record_relief_evaluations (case_id, user_id, rule_key, rule_version, jurisdiction_code, outcome, superseded) values ($1,$2,'impact-rule',1,'IMPACT-TEST','waiting_period',false)`, [c.id, c.user_id]);
  }
  // One gets superseded (should not count).
  await db.query(`update public.record_relief_evaluations set superseded=true where case_id=$1`, [cases[0].id]);

  const impact = must(await tryAs(db, 'service', `select * from public.record_relief_rule_impact('impact-rule', 1)`), 'impact query');
  ok(impact[0].affected_case_count === '1' || Number(impact[0].affected_case_count) === 1, `expected 1 non-superseded case, got ${JSON.stringify(impact[0])}`);
});

done();
