import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTierResponse, mapPlusStatusToTier } from '../src/core/membership/tier-pure.ts';

test('a well-formed tier payload is accepted', () => {
  assert.equal(parseTierResponse({ tier: 'premium' }), 'premium');
  assert.equal(parseTierResponse({ tier: 'plus' }), 'plus');
  assert.equal(parseTierResponse({ tier: 'free' }), 'free');
});

test('malformed or unexpected payloads are rejected, never guessed', () => {
  assert.equal(parseTierResponse(null), null);
  assert.equal(parseTierResponse(undefined), null);
  assert.equal(parseTierResponse('premium'), null);
  assert.equal(parseTierResponse({ tier: 'gold' }), null);
  assert.equal(parseTierResponse({}), null);
  assert.equal(parseTierResponse({ tier: 123 }), null);
});

test('an active plus-status member maps to plus, never premium', () => {
  assert.equal(mapPlusStatusToTier(true), 'plus');
  assert.equal(mapPlusStatusToTier(false), 'free');
});
