import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDisplayKind, JOB_DISPLAY_KIND_LABEL, initialEmploymentTypeFilter, matchesEmploymentTypeFilter,
  JOB_CARD_FIXTURES,
} from '../src/core/staffing/jobs-integration.ts';

test('a real job with no listing_kind is unknown, never guessed as staffing', () => {
  assert.equal(resolveDisplayKind(null), 'unknown');
  assert.equal(resolveDisplayKind(undefined), 'unknown');
  assert.equal(resolveDisplayKind(''), 'unknown');
});

test('an unrecognized value is unknown, not silently treated as direct hire or staffing', () => {
  assert.equal(resolveDisplayKind('something_else'), 'unknown');
});

test('direct_hire and each staffing kind resolve exactly', () => {
  assert.equal(resolveDisplayKind('direct_hire'), 'direct_hire');
  assert.equal(resolveDisplayKind('staffing_temp'), 'staffing_temp');
  assert.equal(resolveDisplayKind('staffing_contract'), 'staffing_contract');
  assert.equal(resolveDisplayKind('staffing_temp_to_hire'), 'staffing_temp_to_hire');
});

test('unknown kind has no label, not a guessed one', () => {
  assert.equal(JOB_DISPLAY_KIND_LABEL.unknown, '');
});

test('every real kind has a non-empty label', () => {
  for (const k of ['direct_hire', 'staffing_temp', 'staffing_contract', 'staffing_temp_to_hire'] as const) {
    assert.ok(JOB_DISPLAY_KIND_LABEL[k].length > 0, k);
  }
});

test('the employment-type filter starts disabled and with no value chosen unless the backend supports it', () => {
  assert.deepEqual(initialEmploymentTypeFilter(false), { value: null, enabled: false });
  assert.deepEqual(initialEmploymentTypeFilter(true), { value: null, enabled: true });
});

test('a null filter value matches every kind', () => {
  for (const kind of ['direct_hire', 'staffing_temp', 'staffing_contract', 'staffing_temp_to_hire', 'unknown'] as const) {
    assert.equal(matchesEmploymentTypeFilter(kind, null), true);
  }
});

test('each filter value matches only its own kind', () => {
  assert.equal(matchesEmploymentTypeFilter('direct_hire', 'direct_hire'), true);
  assert.equal(matchesEmploymentTypeFilter('staffing_temp', 'direct_hire'), false);
  assert.equal(matchesEmploymentTypeFilter('staffing_temp', 'temporary'), true);
  assert.equal(matchesEmploymentTypeFilter('staffing_contract', 'temporary'), false);
  assert.equal(matchesEmploymentTypeFilter('staffing_temp_to_hire', 'temp_to_hire'), true);
});

test('an unknown-kind job never matches a specific filter value', () => {
  assert.equal(matchesEmploymentTypeFilter('unknown', 'direct_hire'), false);
  assert.equal(matchesEmploymentTypeFilter('unknown', 'temporary'), false);
});

test('fixtures demonstrate all four kinds plus one unknown-kind legacy record', () => {
  const kinds = JOB_CARD_FIXTURES.map((f) => resolveDisplayKind(f.listingKind));
  assert.ok(kinds.includes('direct_hire'));
  assert.ok(kinds.includes('staffing_temp'));
  assert.ok(kinds.includes('staffing_contract'));
  assert.ok(kinds.includes('staffing_temp_to_hire'));
  assert.ok(kinds.includes('unknown'));
});

test('every fixture is clearly labeled as a DEV fixture', () => {
  for (const f of JOB_CARD_FIXTURES) assert.ok(/DEV fixture/.test(f.title), f.id);
});
