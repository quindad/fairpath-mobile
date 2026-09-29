// Adversarial coverage for the Record Relief candidate-data importer (scripts/lib/record-relief-importer.mjs),
// against docs/RECORD_RELIEF_DATA_OPERATIONS.md's spec: research output is CANDIDATE DATA, never production law.
// `node scripts/test-local-relief-importer.mjs`
import { createLocalDb } from './lib/local-db.mjs';
import { loadRecordReliefFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { importBatch, validateCandidate } from './lib/record-relief-importer.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
await loadRecordReliefFixtures(db); // seeds TEST-A/B/C/D jurisdictions (kind='test')

// TEST-D has no pre-seeded fixture rules (unlike TEST-A/B/C), so it's safe as the default coverage-overlap-free target.
const validRule = () => ({
  kind: 'rule', jurisdiction_code: 'TEST-D', rule_key: 'import-test-rule', rule_version: 1,
  remedy: 'expungement', title: 'Import test rule', applies_dispositions: ['conviction'],
  applies_offense_classes: ['misdemeanor'], waiting_anchor: 'sentence_completion_date',
  source_authority: 'test_fixture', source_url: 'https://x.test/rule', citation_text: 'Test Code § 1',
  effective_from: '2024-01-01', researched_by: 'researcher-1', data_origin: 'dev_fixture', fixture_set: 'importer-test',
  staff_notes: 'imported for adversarial test coverage',
});

await test('valid simple rule: VALID, dry-run writes nothing, import writes a draft row', async () => {
  const valid = validRule();
  const structural = validateCandidate(valid);
  ok(structural.status === 'VALID', 'expected VALID, got ' + JSON.stringify(structural.issues));

  const dry = await importBatch(db, [valid], { dryRun: true });
  ok(dry.imported === false && dry.dryRun === true, 'dry run should not import');
  const countBefore = (await db.query(`select count(*)::int as n from public.record_relief_rules where rule_key=$1`, [valid.rule_key])).rows[0].n;
  ok(countBefore === 0, 'dry run must not write a row');

  const real = await importBatch(db, [valid]);
  ok(real.imported === true, 'expected import to succeed: ' + real.reason);
  const row = (await db.query(`select status, manual_review_flags from public.record_relief_rules where rule_key=$1`, [valid.rule_key])).rows[0];
  ok(row.status === 'draft', `importer must always insert status='draft', got "${row.status}"`);
});

await test('duplicate (rule_key, rule_version) is rejected', async () => {
  const dup = { ...validRule(), rule_key: 'import-test-rule' }; // same key+version as the row already inserted above
  const result = await importBatch(db, [dup]);
  ok(result.imported === false, 'duplicate version should be rejected');
  ok(result.reports[0].report.issues.some((i) => i.field === 'rule_version'), 'expected a rule_version rejection reason');
});

await test('unknown jurisdiction is rejected', async () => {
  const bad = { ...validRule(), rule_key: 'unknown-jur-test', jurisdiction_code: 'NOPE-99' };
  const result = await importBatch(db, [bad]);
  ok(result.imported === false, 'unknown jurisdiction should be rejected');
});

await test('unknown field is rejected, never silently dropped', async () => {
  const bad = { ...validRule(), rule_key: 'unknown-field-test', made_up_field: 'x' };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'made_up_field'), 'expected an unknown-field rejection');
});

await test('invalid enum value is rejected', async () => {
  const bad = { ...validRule(), rule_key: 'invalid-enum-test', remedy: 'pardon_me_please' };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'remedy'), 'expected a remedy rejection');
});

await test('production candidate missing an official source is rejected (TEST fixtures are exempt)', async () => {
  const bad = { ...validRule(), rule_key: 'missing-source-test', jurisdiction_code: 'US-OH', data_origin: 'production', fixture_set: undefined, source_url: '' };
  delete bad.fixture_set;
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'source_url'), 'expected a source_url rejection for a production import');
});

await test('malformed / non-official source URL is rejected for production candidates', async () => {
  const bad = { ...validRule(), rule_key: 'malformed-url-test', jurisdiction_code: 'US-OH', data_origin: 'production', source_url: 'not a url at all', citation_text: 'Ohio Rev. Code § 1' };
  delete bad.fixture_set;
  const r1 = validateCandidate(bad);
  ok(r1.status === 'REJECTED', 'malformed URL should be rejected');

  const untrustedDomain = { ...bad, rule_key: 'untrusted-domain-test', source_url: 'https://some-random-blog.com/ohio-law' };
  const r2 = validateCandidate(untrustedDomain);
  ok(r2.status === 'REJECTED' && r2.issues.some((i) => i.field === 'source_url'), 'a non-.gov/court source should be rejected, not trusted merely for having a URL');
});

await test('missing effective date is rejected', async () => {
  const bad = { ...validRule(), rule_key: 'missing-date-test', effective_from: undefined };
  delete bad.effective_from;
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'effective_from'), 'expected an effective_from rejection');
});

await test('future-effective rule (over 1 year out) is rejected as a likely data-entry error', async () => {
  const farFuture = new Date(); farFuture.setFullYear(farFuture.getFullYear() + 5);
  const bad = { ...validRule(), rule_key: 'far-future-test', effective_from: farFuture.toISOString().slice(0, 10) };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'effective_from'), 'expected an effective_from rejection for an implausibly future date');
});

await test('TEST jurisdiction + production data_origin is a TEST/real mismatch, rejected at the DB check', async () => {
  const bad = { ...validRule(), rule_key: 'test-prod-mismatch', jurisdiction_code: 'TEST-A', data_origin: 'production' };
  delete bad.fixture_set;
  const result = await importBatch(db, [bad]);
  ok(result.imported === false, 'TEST jurisdiction targeted by a production import should be rejected');
});

await test('production data_origin targeting a real jurisdiction with dev_fixture flag is also a mismatch', async () => {
  const bad = { ...validRule(), rule_key: 'real-jur-fixture-flag', jurisdiction_code: 'US-OH' }; // data_origin stays dev_fixture from validRule()
  const result = await importBatch(db, [bad]);
  ok(result.imported === false, 'dev_fixture data targeting a real (non-test) jurisdiction should be rejected');
});

await test('attempted auto-publish (input tries to set status directly) is structurally impossible: status is not a candidate-data field', async () => {
  const bad = { ...validRule(), rule_key: 'auto-publish-test', status: 'verified' };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'status'), 'a "status" field in candidate input must be rejected as unknown - the importer has no path to set verified');
});

await test('manual-review classification is preserved through import, never silently dropped', async () => {
  const withFlag = { ...validRule(), rule_key: 'manual-review-preserved', jurisdiction_code: 'TEST-D', manual_review_flags: ['juvenile'], staff_notes: 'flagged for review' };
  const result = await importBatch(db, [withFlag]);
  ok(result.imported === true, 'expected import to succeed: ' + JSON.stringify(result.reports?.[0]?.report?.issues));
  const row = (await db.query(`select manual_review_flags from public.record_relief_rules where rule_key=$1`, [withFlag.rule_key])).rows[0];
  ok(row.manual_review_flags.includes('juvenile'), 'manual_review_flags must survive import exactly as researched');
});

await test('a local form claiming statewide scope by omission is rejected: scope_detail required for non-statewide', async () => {
  const localForm = { kind: 'form', jurisdiction_code: 'TEST-A', form_key: 'county-form-test', name: 'County petition', form_kind: 'instructions', scope: 'county' };
  const r = validateCandidate(localForm);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'scope_detail'), 'a county-scoped form without scope_detail must be rejected, never silently presented as statewide');
});

await test('a duplicate/overlapping active rule for the same coverage is rejected even without a matching rule_key', async () => {
  // First rule covers TEST-B misdemeanor expungement, verified and currently effective.
  await db.query(
    `insert into public.record_relief_rules (rule_key, rule_version, jurisdiction_code, remedy, title, applies_dispositions, applies_offense_classes,
       waiting_anchor, source_authority, source_url, citation_text, effective_from, last_verified_at, status, data_origin, fixture_set)
     values ('existing-coverage','1','TEST-B','expungement','Existing rule','{conviction}','{misdemeanor}','sentence_completion_date',
       'test_fixture','https://x.test/existing','Test Code § 2','2024-01-01',current_date,'verified','dev_fixture','importer-test')`,
  );
  const overlapping = { ...validRule(), rule_key: 'new-overlapping-rule', jurisdiction_code: 'TEST-B', applies_offense_classes: ['misdemeanor'] };
  const result = await importBatch(db, [overlapping]);
  ok(result.imported === false, 'a second rule claiming the same jurisdiction/remedy/offense-class coverage with an overlapping window should be rejected');
});

await test('all-or-nothing: one bad record in a batch blocks the whole batch, not just itself', async () => {
  const good = { ...validRule(), rule_key: 'batch-good-record' };
  const bad = { ...validRule(), rule_key: 'batch-bad-record', remedy: 'not_a_real_remedy' };
  const result = await importBatch(db, [good, bad]);
  ok(result.imported === false, 'batch with one invalid record must import nothing');
  const row = (await db.query(`select 1 from public.record_relief_rules where rule_key='batch-good-record'`)).rows;
  ok(row.length === 0, 'the valid record in a rejected batch must not have been partially imported');
});

done();
