import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEV_QA_MEMBER_A_EMAIL,
  DEV_QA_MEMBER_B_EMAIL,
  resolveCommunityE2eMembers,
} from '../scripts/lib/dev-qa-accounts.mjs';

test('documented DEV personas are fairpath.test fixtures', () => {
  assert.match(DEV_QA_MEMBER_A_EMAIL, /@fairpath\.test$/);
  assert.match(DEV_QA_MEMBER_B_EMAIL, /@fairpath\.test$/);
});

test('seed and account helpers do not embed passwords in source', () => {
  const accountsSrc = readFileSync('scripts/lib/dev-qa-accounts.mjs', 'utf8');
  const seedSrc = readFileSync('scripts/seed-dev-test-users.mjs', 'utf8');
  assert.doesNotMatch(accountsSrc, /FairPath-Dev-/);
  assert.doesNotMatch(seedSrc, /FairPath-Dev-/);
  const prevA = process.env.QA_DEV_FREE_PASSWORD;
  const prevB = process.env.QA_DEV_PLUS_PASSWORD;
  delete process.env.QA_DEV_FREE_PASSWORD;
  delete process.env.QA_DEV_PLUS_PASSWORD;
  delete process.env.QA_COMMUNITY_MEMBER_A_PASSWORD;
  delete process.env.QA_COMMUNITY_MEMBER_B_PASSWORD;
  const r = resolveCommunityE2eMembers();
  assert.equal(r.passA, null);
  assert.equal(r.passB, null);
  if (prevA) process.env.QA_DEV_FREE_PASSWORD = prevA;
  if (prevB) process.env.QA_DEV_PLUS_PASSWORD = prevB;
});
