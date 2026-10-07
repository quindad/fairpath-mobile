import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgress, serializeProgress } from '../src/core/entrepreneurship/progress-store.ts';

test('round-trips a valid progress record', () => {
  const p = { completedSteps: ['choose_idea', 'get_ein'] as ('choose_idea' | 'get_ein')[] };
  assert.deepEqual(parseProgress(serializeProgress(p)), { completedSteps: ['choose_idea', 'get_ein'] });
});

test('null, malformed and non-object input yields no progress', () => {
  assert.deepEqual(parseProgress(null), { completedSteps: [] });
  assert.deepEqual(parseProgress('{bad'), { completedSteps: [] });
  assert.deepEqual(parseProgress('[]'), { completedSteps: [] });
});

test('unknown step ids are dropped, valid ones kept', () => {
  const raw = JSON.stringify({ completedSteps: ['choose_idea', 'not_a_real_step'] });
  assert.deepEqual(parseProgress(raw), { completedSteps: ['choose_idea'] });
});
