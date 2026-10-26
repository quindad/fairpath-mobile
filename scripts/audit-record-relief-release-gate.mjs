// Record Relief release gate — quality signals, not registry count alone.
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8');

const relief = read('src/core/record-relief/relief-service.ts');
const coverage = read('src/app/record-relief/coverage.tsx');
const matrix = read('src/core/record-relief/jurisdiction-coverage-matrix.ts');

check(/skip_legacy_eval:\s*payload\.skip_legacy_eval\s*\?\?\s*true/.test(relief), 'saveCase must default skip_legacy_eval true until DEF-RR-001 applies.');
check(/evaluateSharedCaseServer/.test(relief), 'Edge-first reevaluate path must exist.');
check(/classifyJurisdictionCoverage/.test(coverage), 'Coverage screen must show honest jurisdiction matrix status.');
check(/COVERAGE_STATUS_COPY/.test(coverage), 'Coverage screen must explain engineering vs legal review.');
check(/implemented_source_supported/.test(matrix), 'Jurisdiction matrix must distinguish implemented vs missing sources.');
check(!/57 authorities complete|all 50 states verified by attorneys/i.test(relief + coverage + matrix), 'Must not claim false legal completeness.');

const { nationwideCompletenessIntegrity } = await import('../src/core/record-relief/nationwide-completeness.ts');
const { coverageMatrixSummary } = await import('../src/core/record-relief/jurisdiction-coverage-matrix.ts');
const integrity = nationwideCompletenessIntegrity();
check(integrity.missing.length === 0, `Completeness records missing jurisdictions: ${integrity.missing.join(', ')}`);
check(integrity.duplicates.length === 0, `Duplicate completeness records: ${integrity.duplicates.join(', ')}`);
const summary = coverageMatrixSummary();
check(summary.jurisdictionRecords === integrity.records, 'Matrix summary must match completeness record count.');

if (failures.length) {
  console.error('Record Relief release gate failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(
  `Record Relief release gate passed: ${summary.byStatus.implemented_source_supported} implemented_source_supported of ${summary.jurisdictionRecords} engineering records; legacy eval guarded in client.`,
);
