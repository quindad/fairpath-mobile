import assert from 'node:assert/strict';
import test from 'node:test';
import { actionsFromSourceRefs, mergeResponseActions } from '../src/core/signal/signal-result-actions.ts';

test('actionsFromSourceRefs maps resource and job refs to routes', () => {
  const actions = actionsFromSourceRefs([
    { kind: 'summary', id: 'resource:11111111-1111-1111-1111-111111111111' },
    { kind: 'summary', id: 'job:22222222-2222-2222-2222-222222222222' },
  ]);
  assert.equal(actions.length, 2);
  assert.match(actions[0].route, /^\/resource\//);
  assert.match(actions[1].route, /^\/job\//);
});

test('mergeResponseActions dedupes routes', () => {
  const merged = mergeResponseActions(
    [{ label: 'Resources', route: '/resources' }],
    [{ label: 'Open resource', route: '/resource/abc', primary: true }, { label: 'Resources', route: '/resources' }],
  );
  assert.equal(merged.length, 2);
});
