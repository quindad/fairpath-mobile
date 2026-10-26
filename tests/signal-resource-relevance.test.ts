import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isIrrelevantFinancialResource,
  nearMeRequiresZip,
  resourceSearchRpcParams,
  shouldKeepResourceResult,
} from '../src/core/signal/signal-resource-relevance.ts';

const IPHONE_QA_PROMPT = 'I need a job and transportation near me.';

test('iPhone QA prompt: transport search stays local and category-scoped', () => {
  const rpc = resourceSearchRpcParams(IPHONE_QA_PROMPT, '43215');
  assert.equal(rpc.category, 'transportation');
  assert.equal(rpc.includeNational, false);
  assert.match(rpc.query ?? '', /transportation|transit|ride/i);
});

test('iPhone QA prompt: near me without ZIP blocks silent nationwide resource search', () => {
  assert.equal(nearMeRequiresZip(IPHONE_QA_PROMPT, null), true);
  assert.equal(nearMeRequiresZip(IPHONE_QA_PROMPT, '43215'), false);
});

test('iPhone QA prompt: irrelevant financial fixtures are rejected for jobs + transport', () => {
  const financialTitles = [
    'Credit Builder Loan',
    'Free Financial Coaching',
    'Credit Counseling Intake',
    'Free Checking Account',
  ];
  for (const title of financialTitles) {
    assert.equal(isIrrelevantFinancialResource(title, ['credit', 'money']), true);
    assert.equal(shouldKeepResourceResult(title, ['credit', 'money'], IPHONE_QA_PROMPT), false);
  }
});

test('iPhone QA prompt: transportation and job-access resources are kept', () => {
  assert.equal(
    shouldKeepResourceResult('Columbus Job Ride Program', ['transportation', 'jobs'], IPHONE_QA_PROMPT),
    true,
  );
  assert.equal(
    shouldKeepResourceResult('Reduced-Fare Transit Pass (Cleveland)', ['transportation'], IPHONE_QA_PROMPT),
    true,
  );
});
