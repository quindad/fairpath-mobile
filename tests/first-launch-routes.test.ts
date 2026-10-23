import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPublicRoute } from '../src/core/auth/public-routes.ts';

test('guest browse and first-launch entry routes stay public', () => {
  for (const p of ['/intro', '/join', '/find-jobs', '/job/x', '/housing/x', '/resources', '/resource/x', '/legal/terms']) {
    assert.equal(isPublicRoute(p), true, p);
  }
  assert.equal(isPublicRoute('/fairpath-ai'), false);
  assert.equal(isPublicRoute('/home'), false);
  assert.equal(isPublicRoute('/member-tool-preferences'), false);
});

test('launch router sends guests through intro storage', () => {
  const index = readFileSync('src/app/index.tsx', 'utf8');
  assert.match(index, /hasCompletedAppIntro/);
  assert.match(index, /\/intro/);
  assert.match(index, /\/join/);
});
