import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateHousingApplicationForm,
  type HousingApplicationForm,
} from '../src/core/housing/housing-application-validation.ts';
import { HOUSING_FASTTRACK_MEMBER_ENABLED } from '../src/core/housing/housing-product.ts';

const valid: HousingApplicationForm = {
  first_name: 'Jordan',
  last_name: 'Lee',
  email: 'jordan@fairpath.test',
  phone: '(614) 555-0100',
  date_of_birth: '01/15/1990',
  current_address: '123 Main St, Columbus OH',
  monthly_income: '3200',
  employer: 'FairPath QA',
  employment_status: 'Employed',
  move_in_date: '12/01/2026',
  occupants: '2',
  pets: 'None',
  housing_history: 'Prior rental 2020–2024',
  references: 'Former landlord',
  additional_notes: '',
};

test('housing application validation accepts a complete standard form', () => {
  assert.deepEqual(validateHousingApplicationForm(valid), {});
});

test('housing application validation blocks empty required fields on step 1', () => {
  const errors = validateHousingApplicationForm({ ...valid, first_name: '', email: 'bad' });
  assert.ok(errors.first_name);
  assert.ok(errors.email);
});

test('employer not required when unemployed', () => {
  const errors = validateHousingApplicationForm({
    ...valid,
    employment_status: 'Unemployed',
    employer: '',
  });
  assert.equal(errors.employer, undefined);
});

test('FastTrack member UI is product-flagged off in this build', () => {
  assert.equal(HOUSING_FASTTRACK_MEMBER_ENABLED, false);
});
