import assert from 'node:assert/strict';
import test from 'node:test';
import { extractionToCasePayload, extractionToEngineInput, type CaseDocumentExtraction } from '../src/core/record-relief/ai-intake.ts';
import {
  additionalChargesFromSavePayload,
  caseToCaseBundle,
  caseToCaseBundleWithPayload,
  type ReliefCaseBundleRow,
} from '../src/core/record-relief/case-bundle.ts';
import { caseRowToEngineFacts } from '../src/core/record-relief/case-engine-facts.ts';
import { jurisdictionHasEngineSupport } from '../src/core/record-relief/engine-coverage.ts';
import { executeRecordRelief } from '../src/core/record-relief/engine-executor.ts';
import {
  evaluationFromLegacySaveRpc,
  evaluationPersistedBySharedEngine,
  partitionEvaluationsForDisplay,
  reliefErrorMessage,
} from '../src/core/record-relief/relief-format.ts';

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

test('multi-charge save payload extends engine bundle beyond primary row', () => {
  const payload = {
    engine_additional_charges: [
      { id: 'c2', offense_name: 'Possession', disposition: 'conviction', offense_class: 'misdemeanor', sentence_completion_date: '2021-06-01' },
    ],
  };
  const bundle = caseToCaseBundleWithPayload(baseCase(), payload);
  assert.equal(bundle.charges.length, 2);
  assert.equal(bundle.charges[1].offenseName, 'Possession');
  assert.deepEqual(additionalChargesFromSavePayload({ engine_additional_charges: 'not-array' }), []);
});

test('Ohio shared engine evaluates misdemeanor sealing from manual bundle + facts', () => {
  const bundle = caseToCaseBundle(baseCase());
  const facts = caseRowToEngineFacts(baseCase(), new Date('2026-10-23'));
  const out = executeRecordRelief(bundle, facts);
  assert.equal(out.ok, true);
  assert.ok(out.results.length >= 1);
  assert.equal(out.results[0].outcome, 'court_or_prosecutor_discretion');
});

test('Ohio engine fails closed when final degree is unknown (missing facts)', () => {
  const row = { ...baseCase(), offense_class: 'other' };
  const out = executeRecordRelief(caseToCaseBundle(row), caseRowToEngineFacts(row));
  assert.ok(out.results.some((r) => r.outcome === 'additional_facts_required'));
});

test('partitionEvaluationsForDisplay hides legacy rule_unavailable when engine jurisdiction', () => {
  assert.equal(jurisdictionHasEngineSupport('US-OH'), true);
  const legacy = {
    outcome: 'rule_unavailable' as const,
    eligibility_date: null,
    reasons: [{ code: 'no_verified_rules', text: 'No verified rules' }],
    inputs_used: { offense_class: 'misdemeanor' },
  };
  const part = partitionEvaluationsForDisplay([legacy], { engineSupported: true });
  assert.equal(part.treatAsUnchecked, true);
  assert.equal(part.primary.length, 0);
  assert.equal(evaluationFromLegacySaveRpc(legacy), true);
  assert.equal(evaluationPersistedBySharedEngine(legacy), false);
});

test('partitionEvaluationsForDisplay prefers shared-engine rows when mixed', () => {
  const legacy = {
    outcome: 'rule_unavailable' as const,
    eligibility_date: null,
    reasons: [{ code: 'no_verified_rules', text: 'x' }],
    inputs_used: {},
  };
  const engine = {
    outcome: 'court_or_prosecutor_discretion' as const,
    eligibility_date: null,
    inputs_used: { consumer: 'mobile', charge_count: 1 },
  };
  const part = partitionEvaluationsForDisplay([legacy, engine], { engineSupported: true });
  assert.deepEqual(part.primary, [engine]);
  assert.equal(part.supersededPlaceholders.length, 1);
});

test('scan extraction payload documents multi-charge persistence limit', () => {
  const fact = <T>(value: T) => ({ value, confidence: 'high' as const, needsConfirmation: false });
  const extraction: CaseDocumentExtraction = {
    schemaVersion: '1',
    jurisdictionCode: fact('US-OH'),
    county: fact('Franklin'),
    courtName: fact('Municipal Court'),
    caseNumber: fact('CR-1'),
    charges: [
      { offenseName: fact('Theft'), statute: fact(''), degree: fact('misdemeanor'), disposition: fact('conviction'), dispositionDate: fact(''), convictionDate: fact('2020-01-01'), sentenceCompletionDate: fact('2022-01-01'), supervisionCompletionDate: fact(''), releaseDate: fact(''), finesPaid: fact(true), restitutionPaid: fact(true) },
      { offenseName: fact('Drug possession'), statute: fact(''), degree: fact('misdemeanor'), disposition: fact('conviction'), dispositionDate: fact(''), convictionDate: fact('2019-01-01'), sentenceCompletionDate: fact('2021-01-01'), supervisionCompletionDate: fact(''), releaseDate: fact(''), finesPaid: fact(true), restitutionPaid: fact(true) },
    ],
    jurisdictionFacts: {},
    warnings: [],
  };
  const payload = extractionToCasePayload(extraction);
  assert.equal(payload.scan_charge_count, 2);
  assert.ok(Array.isArray(payload.engine_additional_charges));
  assert.equal((payload.engine_additional_charges as unknown[]).length, 1);
  const manual = extractionToEngineInput(extraction);
  assert.equal(manual.caseBundle.charges.length, 2);
  assert.equal(manual.caseBundle.charges[0].offenseName, 'Theft');
});

test('reliefErrorMessage surfaces evaluation failures to members', () => {
  assert.match(reliefErrorMessage(new Error('EVALUATION_FAILED')), /eligibility check/i);
  assert.match(reliefErrorMessage(new Error('evaluation_input_invalid')), /incomplete/i);
});
