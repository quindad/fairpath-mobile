// Record Relief document builders. Pure: confirmed case data + the verified rule evaluation -> DocumentSpec.
//
// Rules: nothing here is an official court form (the worksheet says so in a notice); no eligibility is stated as a
// determination ("potentially" everywhere); every rule shows its citation, version, effective and last-verified dates;
// fees/steps/documents are shown only as stored on the verified rule. Highly sensitive: on-demand, self only, never for
// employers or landlords. The case number, if the member entered one, is only ever printed in the body, never in a name.
import type { DocBlock, DocumentSpec } from '../spec.ts';
import { documentTypeInfo } from '../document-types.ts';

export type ReliefCaseForDoc = {
  id: string; jurisdiction_code: string; jurisdiction_name: string; label: string; court_name: string | null; case_number: string | null; offense_description: string | null;
  offense_class: string; disposition: string; is_juvenile: boolean; out_of_state_conviction: boolean; conviction_date: string | null; disposition_date: string | null;
  sentence_completion_date: string | null; supervision_completion_date: string | null; release_date: string | null; fines_paid: boolean | null; restitution_paid: boolean | null;
  other_convictions_count: number | null; pending_charges: boolean | null; filing_status: string; filed_on: string | null;
};
export type ReliefEvaluationForDoc = {
  outcome: string; remedy: string | null; eligibility_date: string | null; days_remaining: number | null; missing_inputs: string[]; reasons: { code: string; text: string }[];
  rule_stale: boolean; rule_changed: boolean; rule_key: string | null; rule_version: number | null;
  rule: null | {
    title: string; citation_text: string; source_url: string; effective_from: string; last_verified_at: string | null; rule_version: number;
    fees: Record<string, unknown>; filing: Record<string, unknown>; required_documents: { key: string; label: string }[]; steps: { key: string; title: string; body?: string }[]; data_origin: string;
  };
};
export type ReliefFormForDoc = { form_key: string; name: string; kind: string; revision: string | null; effective_date: string | null; official_source_url: string | null; last_verified_at: string | null; auto_fillable: boolean; data_origin: string };
export type ReliefDetailForDoc = {
  evaluations: ReliefEvaluationForDoc[]; forms: ReliefFormForDoc[]; pathways: { title: string; description: string; source_url: string; citation_text: string; last_verified_at: string | null; data_origin: string }[];
  checklist: { kind: string; key: string; done: boolean }[];
};

const DISCLAIMER = 'This document is legal information, not legal advice. FairPath is not a law firm. Record-relief rules are specific to each jurisdiction and change, and a court decides whether relief is granted.';
const OUTCOME_TEXT: Record<string, string> = {
  potentially_eligible_now: 'Potentially eligible now', waiting_period: 'Waiting period', potentially_ineligible: 'Potentially ineligible under this rule',
  insufficient_information: 'More information needed', manual_review: 'Manual review recommended', rule_unavailable: 'No verified rule available yet', federal_separate: 'Federal case (handled separately)',
};
const CLASS_TEXT: Record<string, string> = { misdemeanor: 'Misdemeanor', non_violent_felony: 'Non-violent felony', violent_felony: 'Violent felony', sex_offense: 'Sex offense', dui_dwi: 'DUI / DWI', traffic_infraction: 'Traffic infraction', other: 'Other' };
const DISP_TEXT: Record<string, string> = { conviction: 'Conviction', dismissal: 'Dismissed', acquittal: 'Acquitted', deferred_adjudication: 'Deferred', nolle_prosequi: 'Not prosecuted', arrest_no_charge: 'Arrest, no charge' };
const yn = (v: boolean | null) => (v === null ? 'Not provided' : v ? 'Yes' : 'No');
const dt = (v: string | null) => v ?? 'Not provided';
const today = (now: Date) => now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const test = (o: string | undefined) => (o === 'dev_fixture' ? ' [TEST DATA, not real law]' : '');

function base(type: string, subject: string, title: string, c: ReliefCaseForDoc, blocks: DocBlock[], inputs: unknown, now: Date): DocumentSpec {
  const info = documentTypeInfo(type)!;
  return {
    documentType: type, sourceModule: info.module, sourceRecordId: c.id, templateId: info.templateId, templateVersion: info.templateVersion, title, subject,
    audience: 'self', sensitivity: info.sensitivity, kind: info.kind, formats: info.formats, blocks, confirmedDataAt: now.toISOString(), inputs, footer: DISCLAIMER,
  };
}

function caseFacts(c: ReliefCaseForDoc): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: 'Jurisdiction', value: c.jurisdiction_name }, { label: 'Case name', value: c.label },
  ];
  if (c.court_name) rows.push({ label: 'Court', value: c.court_name });
  if (c.case_number) rows.push({ label: 'Case number', value: c.case_number });
  if (c.offense_description) rows.push({ label: 'Offense', value: c.offense_description });
  rows.push({ label: 'Offense type', value: CLASS_TEXT[c.offense_class] ?? c.offense_class }, { label: 'Outcome of the case', value: DISP_TEXT[c.disposition] ?? c.disposition });
  rows.push({ label: 'Conviction date', value: dt(c.conviction_date) }, { label: 'Disposition date', value: dt(c.disposition_date) }, { label: 'Sentence completed', value: dt(c.sentence_completion_date) },
    { label: 'Supervision completed', value: dt(c.supervision_completion_date) }, { label: 'Release date', value: dt(c.release_date) }, { label: 'Fines paid', value: yn(c.fines_paid) },
    { label: 'Restitution paid', value: yn(c.restitution_paid) }, { label: 'Other convictions', value: c.other_convictions_count === null ? 'Not provided' : String(c.other_convictions_count) }, { label: 'Pending charges', value: yn(c.pending_charges) });
  return rows;
}

export function buildCaseSummary(c: ReliefCaseForDoc, d: ReliefDetailForDoc, now = new Date()): DocumentSpec {
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Record relief case summary', level: 1 },
    { type: 'paragraph', text: `Prepared ${today(now)}` },
    { type: 'notice', tone: 'warning', text: DISCLAIMER },
    { type: 'heading', text: 'Case information you confirmed', level: 2 },
    { type: 'keyvalue', items: caseFacts(c) },
    { type: 'heading', text: 'Eligibility review', level: 2 },
  ];
  if (!d.evaluations.length) blocks.push({ type: 'paragraph', text: 'This case has not been checked yet.' });
  for (const e of d.evaluations) {
    blocks.push({ type: 'heading', text: e.rule ? e.rule.title + test(e.rule.data_origin) : OUTCOME_TEXT[e.outcome] ?? e.outcome, level: 3 });
    const kv: { label: string; value: string }[] = [{ label: 'Result', value: OUTCOME_TEXT[e.outcome] ?? e.outcome }];
    if (e.eligibility_date) kv.push({ label: e.outcome === 'waiting_period' ? 'Potentially eligible on' : 'Date used', value: e.eligibility_date });
    if (e.missing_inputs.length) kv.push({ label: 'Not checked because missing', value: e.missing_inputs.map((m) => m.replace(/_/g, ' ')).join(', ') });
    if (e.rule) {
      kv.push({ label: 'Source', value: `${e.rule.citation_text} · ${e.rule.source_url}` }, { label: 'Rule version', value: `${e.rule.rule_version} (effective ${e.rule.effective_from})` }, { label: 'Last verified', value: e.rule.last_verified_at ?? 'Not verified' });
    }
    blocks.push({ type: 'keyvalue', items: kv });
    if (e.reasons.length) blocks.push({ type: 'bullets', items: e.reasons.map((r) => r.text) });
    if (e.rule_changed) blocks.push({ type: 'notice', tone: 'warning', text: 'The verified rule changed after this was checked. Re-check the case for the current version.' });
    if (e.rule_stale) blocks.push({ type: 'notice', tone: 'warning', text: 'This rule was last verified over a year ago. Confirm it is still current with the source.' });
  }
  if (d.pathways.length) {
    blocks.push({ type: 'heading', text: 'Federal pathways listed by FairPath', level: 2 }, { type: 'notice', tone: 'info', text: 'These are not state expungement. None of them is a general federal expungement.' });
    for (const p of d.pathways) blocks.push({ type: 'paragraph', text: `${p.title}${test(p.data_origin)}: ${p.description} Source: ${p.citation_text} (${p.source_url}). Last verified ${p.last_verified_at ?? 'unknown'}.` });
  }
  blocks.push({ type: 'heading', text: 'Filing status you entered', level: 2 }, { type: 'keyvalue', items: [{ label: 'Status', value: c.filing_status.replace(/_/g, ' ') }, { label: 'Filed on', value: dt(c.filed_on) }] });
  return base('record_relief_case_summary', 'Record Relief Case Summary', 'Record relief case summary', c, blocks,
    { c: [c.id, c.jurisdiction_code, c.offense_class, c.disposition, c.conviction_date, c.disposition_date, c.sentence_completion_date, c.supervision_completion_date, c.release_date, c.fines_paid, c.restitution_paid, c.other_convictions_count, c.pending_charges, c.filing_status],
      e: d.evaluations.map((e) => [e.outcome, e.rule_key, e.rule_version, e.eligibility_date]) }, now);
}

export function buildFilingChecklist(c: ReliefCaseForDoc, d: ReliefDetailForDoc, now = new Date()): DocumentSpec {
  const done = new Set(d.checklist.filter((x) => x.done).map((x) => x.kind + ':' + x.key));
  const steps = new Map<string, { key: string; title: string; body?: string }>();
  const docs = new Map<string, { key: string; label: string }>();
  for (const e of d.evaluations) {
    if (e.outcome === 'potentially_ineligible' || e.outcome === 'rule_unavailable' || !e.rule) continue;
    for (const s of e.rule.steps) steps.set(s.key, s);
    for (const r of e.rule.required_documents) docs.set(r.key, r);
  }
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Filing checklist', level: 1 },
    { type: 'paragraph', text: `${c.label} · ${c.jurisdiction_name} · Prepared ${today(now)}` },
    { type: 'notice', tone: 'warning', text: DISCLAIMER },
    { type: 'heading', text: 'Steps', level: 2 },
    steps.size ? { type: 'checklist', items: [...steps.values()].map((s) => ({ text: s.title, note: s.body, checked: done.has('step:' + s.key) })) } : { type: 'paragraph', text: 'No verified steps are available for this case yet.' },
    { type: 'heading', text: 'Documents to gather', level: 2 },
    docs.size ? { type: 'checklist', items: [...docs.values()].map((r) => ({ text: r.label, checked: done.has('document:' + r.key) })) } : { type: 'paragraph', text: 'No verified document list is available for this case yet. The court clerk can tell you what to bring.' },
  ];
  const fees = d.evaluations.filter((e) => e.rule && e.outcome !== 'potentially_ineligible');
  blocks.push({ type: 'heading', text: 'Fees and where to file', level: 2 });
  if (!fees.length) blocks.push({ type: 'paragraph', text: 'No verified fee or filing information is available. Ask the court clerk. FairPath does not estimate fees.' });
  for (const e of fees) {
    const f = e.rule!.fees as { court_fee_cents?: number; fee_waiver_available?: boolean; note?: string };
    const fl = e.rule!.filing as { court_type?: string; where_text?: string; instructions_text?: string };
    const kv: { label: string; value: string }[] = [];
    kv.push({ label: 'Court fee (from the verified rule)', value: typeof f.court_fee_cents === 'number' ? `$${(f.court_fee_cents / 100).toFixed(2)}${test(e.rule!.data_origin)}` : 'Not listed. Ask the clerk.' });
    kv.push({ label: 'Fee waiver', value: f.fee_waiver_available === true ? 'Available (see the fee waiver form)' : f.fee_waiver_available === false ? 'Not listed as available' : 'Not listed' });
    if (fl.where_text) kv.push({ label: 'Where to file', value: fl.where_text });
    if (fl.instructions_text) kv.push({ label: 'Instructions', value: fl.instructions_text });
    kv.push({ label: 'From rule', value: `${e.rule!.title} v${e.rule!.rule_version}` });
    blocks.push({ type: 'keyvalue', items: kv });
  }
  return base('record_relief_filing_checklist', 'Filing Checklist', 'Filing checklist', c, blocks,
    { c: c.id, s: [...steps.keys()], d: [...docs.keys()], done: [...done].sort(), f: fees.map((e) => [e.rule_key, e.rule_version]) }, now);
}

export function buildWorksheet(c: ReliefCaseForDoc, d: ReliefDetailForDoc, member: { firstName: string; lastName: string }, now = new Date()): DocumentSpec {
  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const officialForms = d.forms.filter((f) => f.kind === 'official_form');
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Prepared-information worksheet', level: 1 },
    { type: 'notice', tone: 'warning', text: 'THIS IS NOT AN OFFICIAL COURT FORM. FairPath prepared it from information you confirmed, to help you complete the official form yourself. Copy each answer carefully and check it against the official form and its instructions.' },
    { type: 'paragraph', text: `Case: ${c.label} · ${c.jurisdiction_name} · Prepared ${today(now)}` },
    { type: 'heading', text: 'About you (complete these yourself)', level: 2 },
    { type: 'editable', label: 'Full legal name', value: fullName, hint: 'As it appears on your court records.' },
    { type: 'editable', label: 'Date of birth', value: '', hint: 'FairPath does not fill this in for you.' },
    { type: 'editable', label: 'Mailing address', value: '', hint: 'FairPath does not fill this in for you.' },
    { type: 'editable', label: 'Phone', value: '' },
    { type: 'heading', text: 'Your case (from what you confirmed)', level: 2 },
    { type: 'keyvalue', items: caseFacts(c) },
    { type: 'heading', text: 'Extra notes to bring', level: 2 },
    { type: 'editable', label: 'Anything else the form asks for', value: '', hint: 'Use this space for details from your paperwork.' },
    { type: 'heading', text: 'Official forms this worksheet relates to', level: 2 },
    officialForms.length
      ? { type: 'bullets', items: officialForms.map((f) => `${f.name}${f.revision ? ' (revision ' + f.revision + ')' : ''}${test(f.data_origin)}${f.official_source_url ? ' - get it at ' + f.official_source_url : ''}`) }
      : { type: 'paragraph', text: 'FairPath has no verified official form to point you to for this case yet. The court clerk can tell you which form to use.' },
  ];
  return base('record_relief_worksheet', 'Prepared Information Worksheet', 'Prepared-information worksheet', c, blocks,
    { c: [c.id, c.offense_class, c.disposition, c.conviction_date, c.disposition_date, c.sentence_completion_date, c.fines_paid, c.pending_charges], f: officialForms.map((f) => [f.form_key, f.revision]) }, now);
}

export function buildFormsGuide(c: ReliefCaseForDoc, d: ReliefDetailForDoc, now = new Date()): DocumentSpec {
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Forms and filing guide', level: 1 },
    { type: 'paragraph', text: `${c.label} · ${c.jurisdiction_name} · Prepared ${today(now)}` },
    { type: 'notice', tone: 'warning', text: 'FairPath does not fill out or file any court form for you. Only forms with a verified official source are listed as official. Always use the current version from the source.' },
  ];
  if (!d.forms.length) blocks.push({ type: 'paragraph', text: 'FairPath has no verified forms for this jurisdiction yet. Ask the court clerk or a legal aid organization which forms apply.' });
  for (const f of d.forms) {
    blocks.push({ type: 'heading', text: `${f.name}${test(f.data_origin)}`, level: 3 });
    blocks.push({ type: 'keyvalue', items: [
      { label: 'Type', value: f.kind === 'official_form' ? 'Official form (verified source)' : f.kind === 'fee_waiver_form' ? 'Fee waiver form (verified source)' : 'Instructions' },
      { label: 'Revision', value: f.revision ?? 'Not listed' }, { label: 'Effective', value: f.effective_date ?? 'Not listed' }, { label: 'Last verified', value: f.last_verified_at ?? 'Not verified' },
      { label: 'Official source', value: f.official_source_url ?? 'Not listed' }, { label: 'Filled in by FairPath', value: f.auto_fillable ? 'Yes, from confirmed information you approve' : 'No. Use the prepared-information worksheet to help you complete it.' },
    ] });
  }
  return base('record_relief_forms_guide', 'Forms And Filing Guide', 'Forms and filing guide', c, blocks, { c: c.id, f: d.forms.map((f) => [f.form_key, f.revision, f.last_verified_at]) }, now);
}
