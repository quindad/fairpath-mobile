import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseSummary, buildFilingChecklist, buildWorksheet, buildFormsGuide, type ReliefCaseForDoc, type ReliefDetailForDoc } from '../src/core/documents/builders/record-relief.ts';
const c = { id: 'synthetic', label: 'Synthetic case', jurisdiction_name: 'Ohio', jurisdiction_code: 'US-OH', out_of_state_conviction: true, filing_status: 'not_started' } as ReliefCaseForDoc;
const d = { evaluations: [{ outcome: 'potentially_eligible_now', missing_inputs: [], reasons: [], rule: { title: 'UNSAFE_PREVIOUS_RESULT', steps: [], required_documents: [], fees: {}, filing: {} } }], forms: [{ name: 'UNSAFE_PREVIOUS_FORM', kind: 'official_form' }], pathways: [], checklist: [] } as unknown as ReliefDetailForDoc;
for (const [name, build] of [['summary', () => buildCaseSummary(c, d)], ['checklist', () => buildFilingChecklist(c, d)], ['worksheet', () => buildWorksheet(c, d, { firstName: '', lastName: '' })], ['forms', () => buildFormsGuide(c, d)]] as const) {
  test(`conflicting jurisdiction ${name} withholds prior results and forms`, () => {
    const content = JSON.stringify(build().blocks);
    assert.match(content, /Correct the case jurisdiction/);
    assert.doesNotMatch(content, /UNSAFE_PREVIOUS/);
  });
}
