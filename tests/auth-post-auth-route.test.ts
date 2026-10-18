import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPostAuthReturnTo } from '../src/core/auth/post-auth-return-to.ts';

test('returnTo is ignored until terms and onboarding are complete', () => {
  assert.equal(applyPostAuthReturnTo('/accept-terms', '/job/abc'), '/accept-terms');
  assert.equal(applyPostAuthReturnTo('/onboarding', '/home'), '/onboarding');
});

test('returnTo is honored for ready members', () => {
  assert.equal(applyPostAuthReturnTo('/home', '/job/abc'), '/job/abc');
  assert.equal(applyPostAuthReturnTo('/home', null), '/home');
  assert.equal(applyPostAuthReturnTo('/home', 'https://evil.example'), '/home');
});
