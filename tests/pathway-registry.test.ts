import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATHWAYS, activePathwaysFor, canActivate, mayShareWith, pathwayById } from '../src/core/pathways/pathway-registry.ts';

test('six pathways with unique ids', () => {
  const ids = PATHWAYS.map((p) => p.id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
});

test('Reentry is the only live pathway at launch', () => {
  const live = PATHWAYS.filter((p) => p.status === 'live').map((p) => p.id);
  assert.deepEqual(live, ['reentry']);
});

test('planned pathways cannot be activated', () => {
  for (const p of PATHWAYS.filter((x) => x.status === 'planned')) assert.equal(canActivate(p), false, p.id);
});

test('no pathway shares location by default', () => {
  for (const p of PATHWAYS) assert.equal(p.defaultLocationSharing, false, p.id);
});

test('Safety & Recovery is never shared with any external audience', () => {
  const safety = pathwayById('safety_recovery')!;
  assert.equal(safety.neverSharedExternally, true);
  for (const a of ['employer', 'housing_provider', 'donor', 'partner_org', 'case_manager'] as const) {
    assert.equal(mayShareWith(safety, a), false, a);
  }
});

test('Giving is never shared with any external audience', () => {
  const giving = pathwayById('giving')!;
  for (const a of ['employer', 'housing_provider', 'donor', 'partner_org', 'case_manager'] as const) {
    assert.equal(mayShareWith(giving, a), false, a);
  }
});

test('no pathway shares criminal history with a donor', () => {
  for (const p of PATHWAYS) {
    if (p.sensitiveScopes.includes('criminal_history')) assert.equal(mayShareWith(p, 'donor'), false, p.id);
  }
});

test('no pathway ever shares data with a donor except none', () => {
  for (const p of PATHWAYS) assert.equal(mayShareWith(p, 'donor'), false, p.id);
});

test('activation requires explicit selection; browsing activates nothing', () => {
  assert.deepEqual(activePathwaysFor([]), []);
});

test('planned pathways are filtered out even when a stale record requests them', () => {
  const active = activePathwaysFor(['reentry', 'food', 'safety_recovery']).map((p) => p.id);
  assert.deepEqual(active, ['reentry']);
});

test('a member can hold reentry and veterans together', () => {
  const active = activePathwaysFor(['reentry', 'veterans']).map((p) => p.id).sort();
  assert.deepEqual(active, ['reentry', 'veterans']);
});

test('employers never receive Safety or Giving data', () => {
  for (const id of ['safety_recovery', 'giving'] as const) {
    assert.equal(mayShareWith(pathwayById(id)!, 'employer'), false, id);
  }
});
