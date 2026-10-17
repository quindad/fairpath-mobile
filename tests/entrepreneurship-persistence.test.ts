import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markStepComplete, trackPercent, type TrackStep } from '../src/core/entrepreneurship/tracks.ts';
import {
  ENTREPRENEURSHIP_STORAGE_KEY,
  parseProgress,
  persistStepCompletion,
  serializeProgress,
  type KeyValueStore,
} from '../src/core/entrepreneurship/progress-store.ts';

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

test('a failed device write does not show the step as completed', async () => {
  const previous = { completedSteps: ['choose_idea'] as TrackStep[] };
  const step: TrackStep = 'validate_demand';
  const broken: KeyValueStore = {
    getItem: async () => { throw new Error('disk gone'); },
    setItem: async () => { throw new Error('disk full'); },
  };

  const result = await persistStepCompletion(broken, previous, step);

  assert.equal(result.saved, false);
  assert.deepEqual(result.progress, previous);
  assert.equal(result.progress.completedSteps.includes(step), false);
  assert.equal(trackPercent(result.progress), trackPercent(previous));
});

test('a successful write is the progress the hub shows', async () => {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
  };
  const previous = { completedSteps: [] as TrackStep[] };
  const step: TrackStep = 'choose_idea';

  const result = await persistStepCompletion(store, previous, step);

  assert.equal(result.saved, true);
  assert.deepEqual(result.progress, markStepComplete(previous, step));
  assert.deepEqual(parseProgress(data.get(ENTREPRENEURSHIP_STORAGE_KEY) ?? null), result.progress);
});
