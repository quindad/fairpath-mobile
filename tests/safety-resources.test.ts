import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMERGENCY_RESOURCES } from '../src/core/safety/resources.ts';
import { isPublicRoute } from '../src/core/auth/public-routes.ts';
import { pathwayById } from '../src/core/pathways/pathway-registry.ts';

test('only the two nationally known numbers are listed; nothing invented', () => {
  assert.deepEqual(EMERGENCY_RESOURCES.map((r) => r.number), ['911', '988']);
});

test('every resource states its availability', () => {
  for (const r of EMERGENCY_RESOURCES) assert.ok(r.availability.length > 0, r.id);
});

test('the safety screen is reachable without signing in', () => {
  assert.equal(isPublicRoute('/safety'), true);
});

test('Safety & Recovery pathway data is never shared externally', () => {
  assert.equal(pathwayById('safety_recovery')!.neverSharedExternally, true);
});
