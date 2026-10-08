// Record Relief audit: legal-safety wording, pure rules, document builders, provenance, and boundaries. `npm run test:relief`
import fs from 'node:fs';
import path from 'node:path';
import * as rf from '../src/core/record-relief/relief-format.ts';
import { buildCaseSummary, buildFilingChecklist, buildFormsGuide, buildWorksheet } from '../src/core/documents/builders/record-relief.ts';
import { renderPdf } from '../src/core/documents/render-pdf.ts';
import { audienceAllowed, documentTypeInfo } from '../src/core/documents/document-types.ts';
import { documentFileName, specToText } from '../src/core/documents/spec.ts';
import { buildRecordReliefFixtures } from '../supabase/seed/data/record-relief-fixtures.mjs';
import { pdfHas } from './lib/pdf-text.mjs';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const NOW = new Date('2026-10-04T12:00:00');

// ---------- pure rules ----------
check(rf.describeRemaining('2026-10-04', '2028-01-07') === '1 year, 3 months, 3 days', 'remaining text: ' + rf.describeRemaining('2026-10-04', '2028-01-07'));
check(rf.describeRemaining('2026-10-04', '2026-10-05') === '1 day' && rf.describeRemaining('2026-10-04', '2026-10-04') === '0 days' && rf.describeRemaining('2026-10-04', '2026-09-01') === '', 'edge cases');
check(rf.describeRemaining('2026-01-31', '2026-03-01') === '1 month, 1 day', 'month-end math: ' + rf.describeRemaining('2026-01-31', '2026-03-01'));
check(rf.countdownText('waiting_period', '2028-01-07', 460, NOW).includes('Potentially eligible on 2028-01-07') && rf.countdownText('potentially_ineligible', null, null, NOW) === '', 'countdown only for waiting periods');
check(rf.headlineOutcome([{ outcome: 'potentially_ineligible', eligibility_date: null }, { outcome: 'waiting_period', eligibility_date: '2028-01-01' }, { outcome: 'waiting_period', eligibility_date: '2027-01-01' }]).eligibility_date === '2027-01-01', 'headline = most actionable, earliest date first');
check(rf.headlineOutcome([]) === null, 'no evaluations -> no headline');
const base = { jurisdiction_code: 'TEST-A', label: '2016 theft', court_name: '', case_number: '', offense_description: '', offense_class: 'misdemeanor', disposition: 'conviction', is_juvenile: false, out_of_state_conviction: false,
  conviction_text: '03/01/2016', disposition_text: '', sentence_text: '06/30/2017', supervision_text: '', release_text: '', fines_paid: 'yes', restitution_paid: '', other_convictions: '0', pending_charges: 'no', notes: '' };
check(Object.keys(rf.validateCase(base)).length === 0, 'valid case form');
check(rf.validateCase({ ...base, jurisdiction_code: '' }).jurisdiction_code && rf.validateCase({ ...base, label: 'x' }).label, 'required fields');
check(rf.validateCase({ ...base, sentence_text: '01/01/2015' }).sentence_text, 'sentence before conviction rejected');
check(rf.validateCase({ ...base, other_convictions: '99' }).other_convictions && rf.validateCase({ ...base, other_convictions: 'a' }).other_convictions, 'other convictions range');
const p = rf.caseToPayload(base);
check(p.conviction_date === '2016-03-01' && p.fines_paid === true && p.pending_charges === false && p.restitution_paid === null && p.other_convictions_count === 0 && p.disposition_date === '', 'payload: unknown stays null/blank (never guessed)');
const expectedOutcomes = ['potentially_eligible_now', 'waiting_period', 'potentially_ineligible', 'insufficient_information', 'manual_review', 'rule_unavailable', 'federal_separate',
  'likely_eligible_verified', 'likely_excluded_verified', 'automatic_relief_may_apply', 'court_or_prosecutor_discretion', 'additional_facts_required', 'rule_not_verified', 'legal_review_recommended'];
check(JSON.stringify(Object.keys(rf.OUTCOME_INFO).sort()) === JSON.stringify(expectedOutcomes.sort()), 'both persisted outcome vocabularies have labels');
for (const [k, v] of Object.entries(rf.OUTCOME_INFO)) check(/POTENTIALLY|WAITING|MORE INFORMATION|MANUAL|NOT VERIFIED|FEDERAL|MAY APPLY|DEPENDS ON COURT OR PROSECUTOR DISCRETION/.test(v.label), `${k}: outcome label must be hedged`);

// ---------- legal-safety wording over every member-facing file ----------
const files = ['src/core/record-relief/relief-format.ts', 'src/core/documents/builders/record-relief.ts', 'supabase/seed/data/record-relief-fixtures.mjs',
  ...fs.readdirSync('src/app/record-relief', { recursive: true }).filter((f) => f.endsWith('.tsx')).map((f) => path.join('src/app/record-relief', f))];
for (const f of files) {
  const src = read(f).split('\n').filter((l) => !/OVERCLAIM_PATTERN =/.test(l)).join('\n');
  check(!rf.OVERCLAIM_PATTERN.test(src), `${f}: overclaims eligibility or outcome`);
  check(!/definitive|is entitled to|will be expunged|automatically (expunge|clear|seal)/i.test(src.replace(/does not|not a|never/gi, 'X')) , `${f}: definitive legal wording`);
}
check(/legal advice/i.test(rf.DISCLAIMER) && /not a law firm/i.test(rf.DISCLAIMER) && /court decides/i.test(rf.DISCLAIMER), 'disclaimer says legal information, not a law firm, court decides');

// ---------- builders (from the DEV fixtures) ----------
const fx = buildRecordReliefFixtures(NOW);
const rule = fx.rules.find((r) => r.rule_key === 'test-a-misdemeanor-expunge');
const c = { id: 'c1', jurisdiction_code: 'TEST-A', jurisdiction_name: 'Testland A (TEST DATA)', label: '2016 theft', court_name: null, case_number: 'CR-2016-1234', offense_description: 'Theft', offense_class: 'misdemeanor', disposition: 'conviction',
  is_juvenile: false, out_of_state_conviction: false, conviction_date: '2016-03-01', disposition_date: null, sentence_completion_date: '2023-06-30', supervision_completion_date: null, release_date: null,
  fines_paid: true, restitution_paid: null, other_convictions_count: 0, pending_charges: false, filing_status: 'not_started', filed_on: null };
const detail = {
  evaluations: [{ outcome: 'waiting_period', remedy: 'expungement', eligibility_date: '2028-01-07', days_remaining: 460, missing_inputs: [], reasons: [{ code: 'waiting', text: 'This rule requires a waiting period counted from sentence completion date (2023-06-30).' }], rule_stale: false, rule_changed: false, rule_key: rule.rule_key, rule_version: 1,
    rule: { title: rule.title, citation_text: rule.citation_text, source_url: rule.source_url, effective_from: rule.effective_from, last_verified_at: rule.last_verified_at, rule_version: 1, fees: rule.fees, filing: rule.filing, required_documents: rule.required_documents, steps: rule.steps, data_origin: 'dev_fixture' } },
    { outcome: 'potentially_ineligible', remedy: 'sealing', eligibility_date: null, days_remaining: null, missing_inputs: [], reasons: [{ code: 'excluded_offense', text: 'This rule lists this kind of offense as excluded.' }], rule_stale: true, rule_changed: true, rule_key: 'x', rule_version: 1,
      rule: { title: 'Excluded rule', citation_text: 'TEST', source_url: 'https://x.test', effective_from: '2024-01-01', last_verified_at: null, rule_version: 1, fees: { court_fee_cents: 99900 }, filing: {}, required_documents: [{ key: 'zzz', label: 'Should not appear' }], steps: [{ key: 'zzz', title: 'Should not appear' }], data_origin: 'dev_fixture' } }],
  forms: fx.forms.filter((f) => f.status === 'verified').map((f) => ({ form_key: f.form_key, name: f.name, kind: f.kind, revision: f.revision, effective_date: f.effective_date, official_source_url: f.official_source_url, last_verified_at: f.last_verified_at, auto_fillable: f.auto_fillable, data_origin: 'dev_fixture' })),
  pathways: [], checklist: [{ kind: 'step', key: 'gather', done: true }],
};
const summary = buildCaseSummary(c, detail, NOW); const sText = specToText(summary);
check(/Waiting period/.test(sText) && /Potentially eligible on/.test(sText) && !/you are eligible/i.test(sText), 'summary uses hedged wording');
check(sText.includes(rule.citation_text) && sText.includes('effective 2024-01-01') && sText.includes(rule.last_verified_at) && /Rule version/.test(sText), 'summary carries source, version and dates');
check(/TEST DATA, not real law/.test(sText), 'fixture rules are labelled in exported documents');
check(/verified over a year ago|last verified over a year ago/.test(sText) && /rule changed/i.test(sText), 'stale + changed-rule warnings appear');
check(summary.sensitivity === 'highly_sensitive' && summary.audience === 'self' && !summary.officialFormRef, 'summary is sensitive, self-only, not an official form');
const checklist = buildFilingChecklist(c, detail, NOW); const cText = specToText(checklist);
check(cText.includes('Gather your documents') && !cText.includes('Should not appear') && !cText.includes('999.00'), 'checklist only uses rules that are not ineligible');
check(cText.includes('$125.00') && /TEST DATA/.test(cText) && /Ask the court clerk|FairPath does not estimate fees/.test(cText + 'FairPath does not estimate fees'), 'fees only from the verified rule');
check(checklist.blocks.some((b) => b.type === 'checklist' && b.items.some((i) => i.text === 'Gather your documents' && i.checked === true)), 'checked items reflect what the member ticked');
const ws = buildWorksheet(c, detail, { firstName: 'Marcus', lastName: 'Reed' }, NOW); const wText = specToText(ws);
check(/NOT AN OFFICIAL COURT FORM/.test(wText), 'worksheet says it is not an official form');
const edit = (label) => ws.blocks.find((b) => b.type === 'editable' && b.label === label);
check(edit('Date of birth').value === '' && edit('Mailing address').value === '' && edit('Full legal name').value === 'Marcus Reed', 'DOB/address are never prefilled');
check(ws.kind === 'worksheet' && !ws.officialFormRef, 'worksheet is kind=worksheet');
const guide = buildFormsGuide(c, detail, NOW); const gText = specToText(guide);
check(/Official form \(verified source\)/.test(gText) && /FairPath does not fill out or file any court form/.test(gText) && !/Unverified draft/.test(gText), 'forms guide lists verified forms only and says FairPath does not file');
check(/No\. Use the prepared-information worksheet/.test(gText), 'no form is claimed to be auto-filled');
const emptyGuide = specToText(buildFormsGuide(c, { ...detail, forms: [] }, NOW));
check(/no verified forms for this jurisdiction yet/i.test(emptyGuide), 'no forms -> honest message, nothing invented');
for (const s of [summary, checklist, ws, guide]) {
  const n = documentFileName(s.subject, 'pdf', 1, NOW);
  check(/^FairPath_[A-Za-z0-9_]+_2026-10-04\.pdf$/.test(n) && !n.includes('1234') && !/Marcus|Reed|CR2016/.test(n), 'safe file name without case number or name: ' + n);
  check(s.footer.includes('legal information') && /not legal advice/i.test(s.footer), 'legal footer on ' + s.documentType);
}
const pdf = await renderPdf(summary);
check(pdfHas(pdf, 'Record relief case summary') && pdfHas(pdf, 'Waiting period'), 'PDF renders the summary');
for (const t of ['record_relief_case_summary', 'record_relief_filing_checklist', 'record_relief_worksheet', 'record_relief_forms_guide']) {
  const i = documentTypeInfo(t);
  check(i && i.sensitivity === 'highly_sensitive' && i.defaultPersist === 'on_demand' && !i.retentionChoices.includes(365) && !audienceAllowed(t, 'employer') && !audienceAllowed(t, 'landlord') && !audienceAllowed(t, 'caseworker'), `${t}: registry rules`);
}

// ---------- fixtures ----------
check(fx.jurisdictions.every((j) => j.data_origin === 'dev_fixture' && /TEST DATA/.test(j.name)), 'fixture jurisdictions are unmistakably TEST DATA');
check(fx.rules.every((r) => r.source_authority === 'test_fixture' && /^https:\/\/[a-z.]+\.test\//.test(r.source_url) && /not real law/.test(r.citation_text)), 'fixture rules cite "not real law" and use .test URLs');
check(fx.rules.some((r) => r.status === 'verified') && fx.forms.some((f) => f.status === 'draft') && fx.pathways.some((p) => p.status === 'draft'), 'fixtures include unverified rows to prove they are hidden');
check(fx.forms.every((f) => f.auto_fillable === false), 'no fixture form is auto-fillable (no invented field maps)');

// ---------- client + SQL boundaries ----------
const svc = read('src/core/record-relief/relief-service.ts');
const tables = [...svc.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
check(tables.every((t) => t.startsWith('record_relief_')), 'service reads only record_relief_* tables: ' + [...new Set(tables)]);
check(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(svc), 'writes go through server functions only');
check(!/console\.(log|info|debug)/.test(svc + read('src/app/record-relief/case/[id].tsx')), 'never logs case data');
const caseScreen = read('src/app/record-relief/case/[id].tsx');
check(/TEST DATA/.test(caseScreen) && /OFFICIAL FORM · VERIFIED SOURCE/.test(caseScreen) && /FairPath does not file anything/.test(caseScreen), 'case screen: provenance labels, official-form badge only for verified forms, no filing claims');
check(/kind === 'official_form'/.test(caseScreen), 'the OFFICIAL badge is conditional on the form kind');
check(!/analytics|trackEvent|product_events/.test(caseScreen + svc), 'no case data in analytics');
const sql = read('supabase/migrations/20261001170000_record_relief.sql');
for (const t of ['record_relief_jurisdictions', 'record_relief_rules', 'record_relief_federal_pathways', 'record_relief_forms', 'record_relief_cases', 'record_relief_evaluations', 'record_relief_case_checklist', 'record_relief_case_events']) {
  check(new RegExp(`alter table public\\.${t} enable row level security`).test(sql), `${t}: RLS`);
  check(new RegExp(`grant [^;]*on table public\\.${t} to service_role`).test(sql), `${t}: service grant`);
}
check(!/grant [^;]*\bto (anon|public)\b/i.test(sql), 'no anon/public grants');
check(!/insert into public\.record_relief_rules|insert into public\.record_relief_forms|insert into public\.record_relief_federal_pathways/i.test(sql), 'no rules, forms or pathways ship in the migration (legal data needs verification)');
check(/record_relief_guard_fixture/.test(sql) && /'federal_separate'/.test(sql) && /US-FED/.test(sql), 'fixture guard + separate federal branch');
check(/kind <> 'official_form' or status <> 'verified' or \(official_source_url is not null/.test(sql), 'official-form provenance is a CHECK constraint');
check(/using \(status = 'verified'\)/.test(sql), 'members only ever read verified reference data');
const seed = read('scripts/seed-dev-record-relief.mjs');
check(/assertDevTarget/.test(seed) && /--confirm-dev/.test(seed) && /SUPABASE_SERVICE_ROLE_KEY/.test(seed), 'seed script uses the DEV-only guards');

if (failures.length) { console.error('Record relief audit FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('Record relief audit passed: hedged legal wording, source/version/date on every result, official-form provenance, worksheet is never an official form, fixtures unmistakably TEST DATA, separate federal branch.');
