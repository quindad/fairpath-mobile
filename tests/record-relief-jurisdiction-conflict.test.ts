import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCase, type CaseForm } from '../src/core/record-relief/relief-format.ts';

const form: CaseForm = {
  jurisdiction_code: 'US-OH', label: 'Synthetic case', court_name: '', case_number: '',
  offense_description: '', offense_class: 'misdemeanor', disposition: 'conviction',
  is_juvenile: false, out_of_state_conviction: false, conviction_text: '', disposition_text: '',
  sentence_text: '', supervision_text: '', release_text: '', fines_paid: '', restitution_paid: '',
  other_convictions: '', pending_charges: '', notes: '',
};
test('a case cannot be saved under a jurisdiction the member says is wrong', () => {
  const errors = validateCase({ ...form, out_of_state_conviction: true });
  assert.match(errors.jurisdiction_code, /where.*case.*heard/i);
});
test('a corrected court jurisdiction can be saved without a cross-state assumption', () => {
  assert.equal(validateCase({ ...form, jurisdiction_code: 'US-MI' }).jurisdiction_code, undefined);
});
