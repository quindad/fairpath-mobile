import assert from 'node:assert/strict';
import test from 'node:test';
import { caseToCaseBundle, type ReliefCaseBundleRow } from '../src/core/record-relief/case-bundle.ts';
import { caseRowToEngineFacts } from '../src/core/record-relief/case-engine-facts.ts';

const baseCase = (): ReliefCaseBundleRow & { is_juvenile: boolean; pending_charges: boolean | null; other_convictions_count: number | null } => ({
  id: 'case-1',
  jurisdiction_code: 'US-OH',
  label: 'Test',
  court_name: null,
  offense_description: 'Theft',
  offense_class: 'misdemeanor',
  disposition: 'conviction',
  is_juvenile: false,
  conviction_date: '2020-01-01',
  disposition_date: null,
  sentence_completion_date: '2022-01-01',
  supervision_completion_date: null,
  release_date: null,
  fines_paid: true,
  restitution_paid: true,
  other_convictions_count: 2,
  pending_charges: false,
});

test('caseRowToEngineFacts maps member inputs and today', () => {
  const facts = caseRowToEngineFacts(
    { ...baseCase(), is_juvenile: true, pending_charges: true, other_convictions_count: 3, fines_paid: false, restitution_paid: true },
    new Date('2026-10-23T12:00:00Z'),
  );
  assert.equal(facts.today, '2026-10-23');
  assert.equal(facts.isJuvenile, true);
  assert.equal(facts.pendingProceeding, true);
  assert.equal(facts.pendingCharges, true);
  assert.equal(facts.otherFelonyConvictions, 3);
  assert.equal(facts.applicationFelonyCount, 3);
  assert.equal(facts.allFinesFeesRestitutionPaid, false);
});

test('caseRowToEngineFacts omits payment gate when either payment flag is unknown', () => {
  const facts = caseRowToEngineFacts({ ...baseCase(), fines_paid: null, restitution_paid: true });
  assert.equal(facts.allFinesFeesRestitutionPaid, undefined);
});

test('caseToCaseBundle maps offense_class to charge degree conservatively', () => {
  const degreeFor = (cls: string) => caseToCaseBundle({ ...baseCase(), offense_class: cls }).charges[0].degree;
  assert.equal(degreeFor('traffic_infraction'), 'infraction');
  assert.equal(degreeFor('misdemeanor'), 'misdemeanor');
  assert.equal(degreeFor('non_violent_felony'), 'felony');
  assert.equal(degreeFor('violent_felony'), 'felony');
  assert.equal(degreeFor('sex_offense'), 'felony');
  assert.equal(degreeFor('dui_dwi'), 'unknown');
  assert.equal(degreeFor('other'), 'unknown');
});
