import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCreditPresentation, setCreditMonitoringProvider } from '../src/core/credit-studio/credit-score-provider.ts';
import { computeCreditNextStep, computeCreditProgress } from '../src/core/credit-studio/workspace-summary.ts';

test('credit presentation never fabricates a score', () => {
  setCreditMonitoringProvider('fairpath_manual');
  const p = loadCreditPresentation({
    reports: 1,
    uploads: 0,
    accounts: 3,
    accountsToConfirm: 0,
    openIssues: 0,
    confirmedIssues: 0,
    activeDisputes: 0,
  });
  assert.equal(p.scoreDisplay, null);
  assert.match(p.detail, /never shows a score|No score is invented/i);
});

test('array provider placeholder stays offline', () => {
  setCreditMonitoringProvider('array');
  const p = loadCreditPresentation({
    reports: 0,
    uploads: 0,
    accounts: 0,
    accountsToConfirm: 0,
    openIssues: 0,
    confirmedIssues: 0,
    activeDisputes: 0,
  });
  assert.equal(p.scoreDisplay, null);
  assert.match(p.detail, /not activated/i);
  setCreditMonitoringProvider('fairpath_manual');
});

test('next step prioritizes upload then confirm then review', () => {
  assert.equal(computeCreditNextStep({ reports: 0, uploads: 0, toConfirm: 0, openIssues: 0, confirmedIssues: 0, disputes: 0, dueSoon: [] }).kind, 'upload');
  assert.equal(
    computeCreditNextStep({ reports: 1, uploads: 0, toConfirm: 2, openIssues: 5, confirmedIssues: 0, disputes: 0, dueSoon: [] }).kind,
    'accounts',
  );
  assert.equal(
    computeCreditNextStep({ reports: 1, uploads: 0, toConfirm: 0, openIssues: 1, confirmedIssues: 0, disputes: 0, dueSoon: [] }).kind,
    'review',
  );
});

test('progress steps reflect workspace state', () => {
  const steps = computeCreditProgress({
    reports: 1,
    uploads: 0,
    accounts: 4,
    toConfirm: 0,
    openIssues: 0,
    confirmedIssues: 1,
    activeDisputes: 0,
  });
  assert.deepEqual(
    steps.map((s) => s.done),
    [true, true, true, true],
  );
});
