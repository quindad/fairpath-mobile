// DEV-ONLY Record Relief fixtures: fictional jurisdictions ("TEST-A".."TEST-D"), rules, forms and federal pathways.
//
// These are NOT real law. Every row is marked data_origin = 'dev_fixture' / fixture_set / source_authority 'test_fixture',
// uses reserved .test URLs and "TEST" citations, and the database refuses them unless app_config.environment = 'dev'.
// They exist to exercise the rules engine (waiting periods, exclusions, missing inputs, manual review, stale and
// versioned rules, the federal branch, official-form provenance). Production legal data must come from a verified source.
export const RR_FIXTURE_SET = 'record-relief-v1';

// PostgREST bulk upserts send the UNION of every row's keys and fill any key a row omitted with an explicit NULL (column
// defaults are not applied), which violates NOT NULL columns such as requires_restitution_paid. So every fixture row is
// normalized to carry EVERY column of its table, using the same defaults the migration declares.
export const RULE_DEFAULTS = {
  summary: null, applies_dispositions: [], applies_offense_classes: [], excluded_offense_classes: [], waiting_years: 0, waiting_months: 0, waiting_days: 0,
  waiting_anchor: 'latest_completion', requires_fines_paid: false, requires_restitution_paid: false, requires_no_pending_charges: false, max_other_convictions: null,
  manual_review_flags: [], fees: {}, filing: {}, required_documents: [], steps: [], form_keys: [], effective_to: null, last_verified_at: null, status: 'draft',
};
export const FORM_DEFAULTS = { revision: null, effective_date: null, official_source_url: null, last_verified_at: null, remedies: [], auto_fillable: false, field_map: null, status: 'draft' };
export const PATHWAY_DEFAULTS = { pathway_version: 1, is_general_expungement: false, applies_to: null, last_verified_at: null, status: 'draft' };
export const JURISDICTION_DEFAULTS = { sort_order: 100 };
const complete = (defaults, rows) => rows.map((r) => ({ ...defaults, ...r }));

const daysAgo =(now, n) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);

export function buildRecordReliefFixtures(now = new Date()) {
  const fx = { data_origin: 'dev_fixture', fixture_set: RR_FIXTURE_SET };
  const jurisdictions = [
    { code: 'TEST-A', name: 'Testland A (TEST DATA)', kind: 'test', sort_order: 900 },
    { code: 'TEST-B', name: 'Testland B (TEST DATA)', kind: 'test', sort_order: 901 },
    { code: 'TEST-C', name: 'Testland C - stale rule (TEST DATA)', kind: 'test', sort_order: 902 },
    { code: 'TEST-D', name: 'Testland D - no rules yet (TEST DATA)', kind: 'test', sort_order: 903 },
  ].map((j) => ({ ...j, ...fx }));

  const base = { rule_version: 1, source_authority: 'test_fixture', status: 'verified', effective_from: '2024-01-01', last_verified_at: daysAgo(now, 30), ...fx };
  const rules = [
    { ...base, rule_key: 'test-a-misdemeanor-expunge', jurisdiction_code: 'TEST-A', remedy: 'expungement', title: 'Misdemeanor expungement (TEST)', summary: 'TEST rule: misdemeanor convictions after a 3-year wait.',
      applies_dispositions: ['conviction'], applies_offense_classes: ['misdemeanor', 'traffic_infraction'], excluded_offense_classes: ['dui_dwi'],
      waiting_years: 3, waiting_anchor: 'sentence_completion_date', requires_fines_paid: true, requires_no_pending_charges: true,
      fees: { court_fee_cents: 12500, fee_waiver_available: true, note: 'TEST fee, not real.' }, filing: { court_type: 'TEST County Court', where_text: 'TEST clerk of court', instructions_text: 'File the petition with the clerk. (TEST)' },
      required_documents: [{ key: 'id', label: 'Government ID' }, { key: 'case_papers', label: 'Copy of your case paperwork' }, { key: 'payment_proof', label: 'Proof fines are paid' }],
      steps: [{ key: 'gather', title: 'Gather your documents' }, { key: 'complete_form', title: 'Complete the petition' }, { key: 'file', title: 'File with the clerk' }, { key: 'hearing', title: 'Attend the hearing if one is set' }],
      form_keys: ['test-a-petition', 'test-a-fee-waiver'], source_url: 'https://law.example.test/a/misdemeanor', citation_text: 'TEST-A Code 1.1 (not real law)' },
    { ...base, rule_key: 'test-a-felony-seal', jurisdiction_code: 'TEST-A', remedy: 'sealing', title: 'Non-violent felony sealing (TEST)', summary: 'TEST rule: non-violent felonies after 7 years, at most one other conviction.',
      applies_dispositions: ['conviction'], applies_offense_classes: ['non_violent_felony'], excluded_offense_classes: ['violent_felony', 'sex_offense'],
      waiting_years: 7, waiting_anchor: 'latest_completion', requires_fines_paid: true, requires_restitution_paid: true, requires_no_pending_charges: true, max_other_convictions: 1,
      fees: { court_fee_cents: 20000, fee_waiver_available: true }, required_documents: [{ key: 'id', label: 'Government ID' }, { key: 'restitution_proof', label: 'Proof restitution is paid' }],
      steps: [{ key: 'gather', title: 'Gather your documents' }, { key: 'file', title: 'File the motion' }], form_keys: ['test-a-petition'], source_url: 'https://law.example.test/a/felony', citation_text: 'TEST-A Code 1.2 (not real law)' },
    { ...base, rule_key: 'test-a-dismissal-seal', jurisdiction_code: 'TEST-A', remedy: 'sealing', title: 'Dismissed or acquitted charges (TEST)', summary: 'TEST rule: sealing after a dismissal or acquittal, no waiting period.',
      applies_dispositions: ['dismissal', 'acquittal', 'nolle_prosequi'], waiting_anchor: 'disposition_date', fees: { court_fee_cents: 0, fee_waiver_available: false },
      required_documents: [{ key: 'disposition', label: 'Proof of the dismissal' }], steps: [{ key: 'file', title: 'File the request' }], form_keys: ['test-a-petition'],
      source_url: 'https://law.example.test/a/dismissal', citation_text: 'TEST-A Code 1.3 (not real law)' },
    { ...base, rule_key: 'test-b-set-aside', jurisdiction_code: 'TEST-B', remedy: 'set_aside', title: 'Conviction set-aside (TEST)', summary: 'TEST rule: 5 years after the latest completion date, no other convictions.',
      applies_dispositions: ['conviction'], applies_offense_classes: ['misdemeanor', 'non_violent_felony'], excluded_offense_classes: ['violent_felony', 'sex_offense'],
      waiting_years: 5, waiting_anchor: 'latest_completion', max_other_convictions: 0, requires_no_pending_charges: true, manual_review_flags: ['out_of_state_conviction', 'juvenile'],
      fees: { court_fee_cents: 8000, fee_waiver_available: true }, required_documents: [{ key: 'id', label: 'Government ID' }],
      steps: [{ key: 'file', title: 'File the application' }], form_keys: [], source_url: 'https://law.example.test/b/set-aside', citation_text: 'TEST-B Code 9.4 (not real law)' },
    { ...base, rule_key: 'test-c-stale', jurisdiction_code: 'TEST-C', remedy: 'expungement', title: 'Misdemeanor expungement, old verification (TEST)', summary: 'TEST rule that has not been verified in over a year.',
      applies_dispositions: ['conviction'], applies_offense_classes: ['misdemeanor'], waiting_years: 2, waiting_anchor: 'sentence_completion_date', last_verified_at: daysAgo(now, 420),
      source_url: 'https://law.example.test/c/misdemeanor', citation_text: 'TEST-C Code 3.3 (not real law)', required_documents: [], steps: [] },
  ];

  const forms = [
    { form_key: 'test-a-petition', jurisdiction_code: 'TEST-A', name: 'Petition for Expungement (TEST FORM)', kind: 'official_form', revision: 'TEST-2026-01', effective_date: '2026-01-01',
      official_source_url: 'https://forms.example.test/a/petition.pdf', last_verified_at: daysAgo(now, 30), remedies: ['expungement', 'sealing'], scope: 'statewide', auto_fillable: false, status: 'verified', ...fx },
    { form_key: 'test-a-fee-waiver', jurisdiction_code: 'TEST-A', name: 'Fee Waiver Request (TEST FORM)', kind: 'fee_waiver_form', revision: 'TEST-2025-06', effective_date: '2025-06-01',
      official_source_url: 'https://forms.example.test/a/fee-waiver.pdf', last_verified_at: daysAgo(now, 30), remedies: ['expungement'], scope: 'statewide', auto_fillable: false, status: 'verified', ...fx },
    { form_key: 'test-a-instructions', jurisdiction_code: 'TEST-A', name: 'Filing Instructions (TEST)', kind: 'instructions', revision: null, effective_date: null,
      official_source_url: 'https://forms.example.test/a/instructions.html', last_verified_at: daysAgo(now, 30), remedies: ['expungement', 'sealing'], scope: 'statewide', auto_fillable: false, status: 'verified', ...fx },
    { form_key: 'test-a-draft-form', jurisdiction_code: 'TEST-A', name: 'Unverified draft form (TEST)', kind: 'official_form', revision: null, effective_date: null,
      official_source_url: null, last_verified_at: null, remedies: ['expungement'], scope: 'statewide', auto_fillable: false, status: 'draft', ...fx },
  ];

  const pathways = [
    { pathway_key: 'test-fed-pardon', pathway_version: 1, title: 'Presidential pardon (TEST)', description: 'TEST entry: a discretionary executive process. It does not erase a conviction. Not real guidance.', is_general_expungement: false,
      applies_to: 'Federal convictions', source_authority: 'test_fixture', source_url: 'https://law.example.test/fed/pardon', citation_text: 'TEST-FED 1 (not real law)', effective_from: '2024-01-01', last_verified_at: daysAgo(now, 30), status: 'verified', ...fx },
    { pathway_key: 'test-fed-youth-set-aside', pathway_version: 1, title: 'Youth offender set-aside (TEST)', description: 'TEST entry: narrow relief for certain offenses committed as a youth. Not real guidance.', is_general_expungement: false,
      applies_to: 'Certain federal youth offenses', source_authority: 'test_fixture', source_url: 'https://law.example.test/fed/youth', citation_text: 'TEST-FED 2 (not real law)', effective_from: '2024-01-01', last_verified_at: daysAgo(now, 30), status: 'verified', ...fx },
    { pathway_key: 'test-fed-draft', pathway_version: 1, title: 'Unverified draft pathway (TEST)', description: 'Draft that must never be shown.', is_general_expungement: false,
      applies_to: null, source_authority: 'test_fixture', source_url: 'https://law.example.test/fed/draft', citation_text: 'TEST-FED 3', effective_from: '2024-01-01', last_verified_at: null, status: 'draft', ...fx },
  ];
  return {
    jurisdictions: complete(JURISDICTION_DEFAULTS, jurisdictions),
    rules: complete(RULE_DEFAULTS, rules),
    forms: complete(FORM_DEFAULTS, forms),
    pathways: complete(PATHWAY_DEFAULTS, pathways),
  };
}
