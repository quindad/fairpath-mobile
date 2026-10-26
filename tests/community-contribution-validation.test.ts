import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containsPrivateContributionText,
  validateRecordReliefSourcePayload,
  validateResourceAddPayload,
  validateResourceEditPayload,
} from '../src/core/community/contribution-validation.ts';
import { formatReactionAggregateLine } from '../src/core/community/reaction-aggregates.ts';

test('rejects private record identifiers in contribution text', () => {
  assert.equal(containsPrivateContributionText('my case number is 2020-CR-001'), true);
  assert.equal(containsPrivateContributionText('official form at https://courts.example.gov'), false);
});

test('resource add validation requires name and area', () => {
  assert.match(validateResourceAddPayload({ resource_name: 'Pantry', description: 'Food' }) ?? '', /service area/i);
  assert.equal(validateResourceAddPayload({ resource_name: 'Pantry', description: 'Food', service_area: 'Columbus' }), null);
});

test('resource edit validation requires change and source', () => {
  assert.match(validateResourceEditPayload({ proposed_change: 'hours wrong' }) ?? '', /source/i);
  assert.equal(
    validateResourceEditPayload({ proposed_change: 'hours wrong', source_url: 'https://example.gov' }),
    null,
  );
});

test('record relief contributions reject case uploads', () => {
  assert.match(
    validateRecordReliefSourcePayload({ jurisdiction_code: 'US-OH', official_form_url: 'https://courts.example.gov/form', upload_case_file: true }) ?? '',
    /personal court/i,
  );
});

test('sensitive resources suppress reaction counts in UI copy', () => {
  const line = formatReactionAggregateLine({ available: true, counts_suppressed: true, sensitive: true });
  assert.match(line, /hidden on sensitive/i);
});

test('aggregate line never includes member identities', () => {
  const line = formatReactionAggregateLine({
    available: true,
    counts: { helpful: 3, worked: 1 },
    total: 4,
  });
  assert.match(line, /helpful/);
  assert.doesNotMatch(line, /@|user/i);
});
