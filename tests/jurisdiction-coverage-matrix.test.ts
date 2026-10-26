import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyJurisdictionCoverage,
  coverageMatrixSummary,
} from '../src/core/record-relief/jurisdiction-coverage-matrix.ts';
import { nationwideCompletenessIntegrity } from '../src/core/record-relief/nationwide-completeness.ts';

test('Ohio has implemented_source_supported engineering status', () => {
  const { status } = classifyJurisdictionCoverage('US-OH');
  assert.equal(status, 'implemented_source_supported');
});

test('unknown jurisdiction is no_reliable_source', () => {
  assert.equal(classifyJurisdictionCoverage('US-XX').status, 'no_reliable_source');
});

test('coverage matrix aligns with nationwide completeness records', () => {
  const integrity = nationwideCompletenessIntegrity();
  const summary = coverageMatrixSummary();
  assert.equal(summary.jurisdictionRecords, integrity.records);
  assert.ok(summary.byStatus.implemented_source_supported >= 1);
});
