import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('saveCase defaults skip_legacy_eval to true', () => {
  const src = readFileSync('src/core/record-relief/relief-service.ts', 'utf8');
  assert.match(src, /skip_legacy_eval:\s*payload\.skip_legacy_eval\s*\?\?\s*true/);
});

test('saveCaseAndAutoEvaluate uses Edge engine after persist', () => {
  const src = readFileSync('src/core/record-relief/relief-service.ts', 'utf8');
  assert.match(src, /saveCaseAndAutoEvaluate/);
  assert.match(src, /evaluateSharedCaseServer/);
});
