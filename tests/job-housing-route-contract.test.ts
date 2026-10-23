import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isPublicRoute } from '../src/core/auth/public-routes.ts';
import { EXPLORE_READINESS, effectiveExploreStatus } from '../src/core/explore/explore-readiness.ts';

test('primary browse routes exist as Expo screens', () => {
  assert.equal(existsSync('src/app/find-jobs.tsx'), true);
  assert.equal(existsSync('src/app/find-housing.tsx'), true);
});

test('guest browse includes /find-jobs and /find-housing', () => {
  for (const path of ['/find-jobs', '/find-housing']) {
    assert.equal(isPublicRoute(path), true, path);
  }
});

test('jobs and housing services use list search RPCs', () => {
  const jobs = readFileSync('src/core/jobs/jobs-service.ts', 'utf8');
  const housing = readFileSync('src/core/housing/housing-service.ts', 'utf8');
  assert.match(jobs, /rpc\('search_jobs'/);
  assert.match(housing, /rpc\('search_housing'/);
});

test('explore-readiness marks jobs and housing live when wired', () => {
  assert.equal(EXPLORE_READINESS.jobs, 'live');
  assert.equal(EXPLORE_READINESS.housing, 'live');
  assert.equal(effectiveExploreStatus('jobs', 'planned'), 'live');
  assert.equal(effectiveExploreStatus('housing', 'planned'), 'live');
});

test('explore screen links jobs/housing and applies readiness overrides', () => {
  const explore = readFileSync('src/app/explore.tsx', 'utf8');
  assert.match(explore, /id: 'jobs'[\s\S]*route: '\/find-jobs'/);
  assert.match(explore, /id: 'housing'[\s\S]*route: '\/find-housing'/);
  assert.match(explore, /effectiveExploreStatus\(item\.id, item\.status\)/);
});
