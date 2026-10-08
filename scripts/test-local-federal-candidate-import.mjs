// Federal Record Relief candidate-data pipeline: adversarial import validation + safe DEV staging + the
// dangerous-equivalence regression tests named explicitly in the boardroom-sprint federal-processing pass.
// Uses the real FEDERAL_CANDIDATE_NORMALIZED.json (reconciled V1+V1.1), the real importer, and the real
// legal_rule_candidates staging schema. `node scripts/test-local-federal-candidate-import.mjs`
import fs from 'node:fs';
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';
import { validateCandidate, validateAgainstDb, importBatch } from './lib/record-relief-importer.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, what) => ok(r.error && /permission denied|row-level security/i.test(r.error), `${what}: expected denial, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const hidden = (r, what) => ok((r.error && /permission denied|row-level security/i.test(r.error)) || Array.isArray(r.rows) && r.rows.length === 0, `${what}: expected denial or zero visible rows, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);

const M = await addUser(db, 'federal-test-member@test.local');
const NORMALIZED = JSON.parse(fs.readFileSync(new URL('../docs/research/record-relief/federal/FEDERAL_CANDIDATE_NORMALIZED.json', import.meta.url)));
const READY = NORMALIZED.pathways.find((p) => p.import_status === 'READY').candidate;
// Helper: the *_draft entries are intentionally missing effective_from (that's WHY they're blocked), so testing
// an unrelated field (like the dangerous-equivalence guard) on them needs a stand-in date or the required-field
// check masks the thing actually being tested.
const withDate = (draft) => ({ ...draft, effective_from: '2024-01-01' });

// ---------------- Real file sanity ----------------
await test('the normalized package has exactly 13 pathways, 1 ready and 12 blocked pending effective dates', () => {
  ok(NORMALIZED.pathways.length === 13, `expected 13 pathways, got ${NORMALIZED.pathways.length}`);
  ok(NORMALIZED.summary.ready_for_import === 1 && NORMALIZED.summary.blocked_missing_effective_date === 12, 'summary counts must match the actual array');
});

// ---------------- The one READY candidate validates and imports cleanly ----------------
await test('the real READY federal candidate (categorical marijuana pardon) validates as VALID', () => {
  const r = validateCandidate(READY);
  ok(r.status === 'VALID' || r.status === 'WARNING', `expected VALID/WARNING, got ${r.status}: ${JSON.stringify(r.issues)}`);
});

await test('import lands the READY candidate as draft in the LIVE table, never verified, and dry-run writes nothing', async () => {
  const dry = await importBatch(db, [READY], { dryRun: true, allowWarnings: true });
  ok(dry.imported === false, 'dry run should not import');
  const before = (await db.query(`select count(*)::int as n from public.record_relief_federal_pathways where pathway_key=$1`, [READY.pathway_key])).rows[0].n;
  ok(before === 0, 'dry run must not write a row');

  const real = await importBatch(db, [READY], { allowWarnings: true });
  ok(real.imported === true, 'expected import to succeed: ' + JSON.stringify(real.reports?.[0]?.report?.issues));
  const row = (await db.query(`select status, pathway_type, jurisdiction_subtype, is_general_expungement from public.record_relief_federal_pathways where pathway_key=$1`, [READY.pathway_key])).rows[0];
  ok(row.status === 'draft', `must always land as draft, got "${row.status}"`);
  ok(row.pathway_type === 'pardon' && row.is_general_expungement === false, 'pathway_type/is_general_expungement must survive import exactly');

  hidden(await tryAs(db, M, `select * from public.record_relief_federal_pathways where pathway_key=$1`, [READY.pathway_key]), 'member reading a draft federal pathway');
  hidden(await tryAs(db, 'anon', `select * from public.record_relief_federal_pathways where pathway_key=$1`, [READY.pathway_key]), 'anon reading a draft federal pathway');
});

// ---------------- Adversarial import scenarios ----------------
await test('malformed package (not an object) is rejected', () => {
  const r = validateCandidate('this is not an object');
  ok(r.status === 'REJECTED', 'a non-object candidate must be rejected');
});

await test('missing provenance (no source_url) is rejected for a production candidate', () => {
  const bad = { ...READY, pathway_key: 'adversarial-missing-source', source_url: undefined };
  delete bad.source_url;
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'source_url'), 'expected a source_url rejection');
});

await test('duplicate pathway (same key+version) is rejected at the DB layer', async () => {
  const dup = { ...READY }; // exact same pathway_key+version as the one already imported above
  const structural = validateCandidate(dup);
  const full = await validateAgainstDb(db, dup, structural);
  ok(full.status === 'REJECTED' && full.issues.some((i) => i.field === 'pathway_version'), 'expected a duplicate-version rejection');
});

await test('conflicting versions: a new version of the same pathway is allowed, but re-using an old version number is not', async () => {
  const v2 = { ...READY, pathway_version: 2 };
  const structural = validateCandidate(v2);
  const full = await validateAgainstDb(db, v2, structural);
  ok(full.status === 'VALID' || full.status === 'WARNING', `a genuinely new version should validate: ${JSON.stringify(full.issues)}`);
});

await test('unsupported jurisdiction subtype is rejected', () => {
  const bad = { ...READY, pathway_key: 'adversarial-bad-subtype', jurisdiction_subtype: 'texas_state_code' };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'jurisdiction_subtype'), 'expected a jurisdiction_subtype rejection');
});

await test('unknown/unsupported pathway_type is rejected, never silently coerced to "other"', () => {
  const bad = { ...READY, pathway_key: 'adversarial-bad-pathway-type', pathway_type: 'made_up_relief_category' };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'pathway_type'), 'expected a pathway_type rejection');
});

await test('future-effective candidate (more than 1 year out) is rejected as an implausible data-entry error', () => {
  const farFuture = new Date(); farFuture.setFullYear(farFuture.getFullYear() + 5);
  const bad = { ...READY, pathway_key: 'adversarial-far-future', effective_from: farFuture.toISOString().slice(0, 10) };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'effective_from'), 'expected an effective_from rejection');
});

await test('historical/repealed candidate (Youth Corrections Act) is structurally representable, never dropped', () => {
  const yca = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-historical-yca-setaside');
  ok(!!yca, 'the historical YCA pathway must still be present in the normalized package, not silently dropped');
  ok(yca.import_status === 'BLOCKED_MISSING_EFFECTIVE_DATE' && yca.reason, 'a historical pathway with no clean date is explicitly blocked WITH a reason, not silently omitted or guessed');
});

await test('attempted verified status in candidate input is structurally impossible (unknown field, rejected)', () => {
  const bad = { ...READY, pathway_key: 'adversarial-attempted-verify', status: 'verified' };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'status'), 'a "status" field must be rejected as unknown - the importer has no path to set verified');
});

await test('all-or-nothing: one bad record in a batch blocks the whole batch', async () => {
  const good = { ...READY, pathway_key: 'adversarial-batch-good' };
  const bad = { ...READY, pathway_key: 'adversarial-batch-bad', pathway_type: 'not_a_real_type' };
  const result = await importBatch(db, [good, bad], { allowWarnings: true });
  ok(result.imported === false, 'a batch with one invalid record must import nothing');
  const row = (await db.query(`select 1 from public.record_relief_federal_pathways where pathway_key='adversarial-batch-good'`)).rows;
  ok(row.length === 0, 'the valid record in a rejected batch must not have been partially imported');
});

await test('V1/V1.1 conflict preservation: the normalized package documents what V1 said AND what V1.1 corrected, not just the final answer', () => {
  const pardon = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-clemency-presidential-pardon');
  ok(pardon.candidate_draft.staff_notes.includes('FED-RT-001'), 'the reconciled candidate must cite which red-team finding corrected it, preserving the conflict trail, not just silently presenting V1.1\'s answer as if it were always true');
});

// ---------------- Dangerous-equivalence regression tests (the core Federal safety property) ----------------
await test('PARDON != EXPUNGEMENT: pardon candidates can never carry is_general_expungement=true', () => {
  const bad = { ...READY, pathway_key: 'adversarial-pardon-as-expungement', is_general_expungement: true };
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'is_general_expungement'), 'pardon + is_general_expungement=true must be rejected');
});

await test('COMMUTATION != PARDON, COMMUTATION != RECORD_CLEARING: commutation candidates can never carry is_general_expungement=true either', () => {
  const commutation = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-clemency-commutation').candidate_draft;
  const bad = withDate({ ...commutation, is_general_expungement: true });
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'is_general_expungement'), 'commutation + is_general_expungement=true must be rejected');
  ok(commutation.pathway_type === 'commutation' && commutation.pathway_type !== 'pardon', 'commutation and pardon must be distinct pathway_type values in the actual data');
});

await test('FIREARM RIGHTS RESTORATION != EXPUNGEMENT', () => {
  const firearm = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-18usc925c-firearm-disability-relief').candidate_draft;
  ok(firearm.pathway_type === 'firearm_rights_restoration', 'firearm relief must use its own distinct pathway_type');
  const bad = withDate({ ...firearm, is_general_expungement: true });
  const r = validateCandidate(bad);
  ok(r.status === 'REJECTED' && r.issues.some((i) => i.field === 'is_general_expungement'), 'firearm_rights_restoration + is_general_expungement=true must be rejected');
});

await test('JUVENILE CONFIDENTIALITY != EXPUNGEMENT', () => {
  const juvenile = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-18usc5038-juvenile-record-confidentiality').candidate_draft;
  ok(juvenile.is_general_expungement === false, 'juvenile confidentiality must never be marked as a general expungement mechanism');
  const withoutNegatedExpungement = juvenile.effect_summary.replace(/not\s+expungement/gi, '');
  ok(/confidentiality/i.test(juvenile.effect_summary) && !/expunge/i.test(withoutNegatedExpungement), 'the effect_summary must describe confidentiality, and any mention of "expunge" must only appear as an explicit negation like "not expungement"');
});

await test('PARDON PETITION GUIDANCE DATE != LEGAL ENTITLEMENT DATE: the pardon candidate never claims a deterministic eligibility date', () => {
  const pardon = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-clemency-presidential-pardon').candidate_draft;
  ok(!/eligib/i.test(pardon.effect_summary || ''), 'the pardon effect_summary must not use eligibility-guarantee language');
  ok(pardon.staff_notes.includes('MAY_MEET_CURRENT_DOJ_PARDON_PETITION_GUIDANCE'), 'the candidate must explicitly carry the hedged member-output requirement, not a definitive date claim');
});

await test('HISTORICAL REPEALED RELIEF != CURRENT RELIEF', () => {
  const yca = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-historical-yca-setaside').candidate_draft;
  ok(/repealed|historical/i.test(yca.description) && /repealed|historical/i.test(yca.title), 'the historical pathway must be unmistakably labeled as repealed/historical in both title and description');
});

await test('UNKNOWN FEDERAL JURISDICTION -> MANUAL REVIEW: jurisdiction_subtype "unknown" is a valid, safe default, never rejected outright', () => {
  const r = validateCandidate({ ...READY, pathway_key: 'adversarial-unknown-subtype-ok', jurisdiction_subtype: 'unknown' });
  ok(r.status === 'VALID' || r.status === 'WARNING', 'unknown must be an accepted, honest value - not a validation failure, since it correctly signals manual review is needed downstream, not that the data is malformed');
});

await test('COURT/CIRCUIT-DEPENDENT QUESTION -> MANUAL REVIEW: the judicial-expungement-by-invalidity candidate defaults to no usable nationwide rule', () => {
  const judicial = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-judicial-expungement-invalidity').candidate_draft;
  ok(/circuit|district/i.test(judicial.applies_to), 'the candidate must name circuit/district dependency explicitly, never present a flat nationwide answer');
  ok(judicial.rights_not_restored.includes('No general nationwide'), 'must explicitly state no general rule is verified in either direction');
});

await test('INSUFFICIENT RESEARCH -> RULE NOT VERIFIED: the vacatur/invalid-conviction node stays an explicit non-rule, never a self-service pathway', () => {
  const vacatur = NORMALIZED.pathways.find((p) => p.candidate_draft?.pathway_key === 'us-fed-invalid-conviction-relief').candidate_draft;
  ok(vacatur.staff_notes.includes('self_service_eligibility=false'), 'must explicitly disable self-service eligibility for an unsupported general rule');
});

done();
