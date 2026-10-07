import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, setConsent, setValue, consented, parseProfile, serializeProfile } from '../src/core/veterans/profile-store.ts';

const NOW = '2026-10-06T00:00:00Z';

test('values cannot be stored without consent for that exact field', () => {
  const p = emptyProfile(NOW);
  const after = setValue(p, 'pay_grade', 'E-5', NOW);
  assert.deepEqual(after.values, {});
});

test('granting consent then storing a value keeps it', () => {
  let p = setConsent(emptyProfile(NOW), 'pay_grade', true, NOW);
  p = setValue(p, 'pay_grade', 'E-5', NOW);
  assert.equal(p.values.pay_grade, 'E-5');
  assert.equal(consented(p, 'pay_grade'), true);
  assert.equal(consented(p, 'branch'), false);
});

test('revoking consent removes the stored value', () => {
  let p = setConsent(emptyProfile(NOW), 'pay_grade', true, NOW);
  p = setValue(p, 'pay_grade', 'E-5', NOW);
  p = setConsent(p, 'pay_grade', false, NOW);
  assert.equal(p.values.pay_grade, undefined);
});

test('stored values without matching consent are dropped on load', () => {
  const tampered = JSON.stringify({ branch: null, components: [], values: { pay_grade: 'E-5' }, consents: [], updatedAt: NOW });
  assert.deepEqual(parseProfile(tampered, NOW).values, {});
});

test('unknown fields and unknown branches are dropped on load', () => {
  const raw = JSON.stringify({
    branch: 'space_pirates',
    components: ['bogus', 'reserve'],
    values: { made_up: 'x' },
    consents: [{ field: 'made_up', granted: true }],
    updatedAt: NOW,
  });
  const p = parseProfile(raw, NOW);
  assert.equal(p.branch, null);
  assert.deepEqual(p.components, ['reserve']);
  assert.deepEqual(p.values, {});
  assert.deepEqual(p.consents, []);
});

test('round trip preserves a valid consented profile', () => {
  let p = setConsent(emptyProfile(NOW), 'occupational_specialty', true, NOW);
  p = setValue(p, 'occupational_specialty', '11B', NOW);
  p = { ...p, branch: 'army', components: ['active'] };
  assert.deepEqual(parseProfile(serializeProfile(p), NOW), p);
});

test('malformed JSON falls back to an empty profile', () => {
  assert.deepEqual(parseProfile('{bad', NOW), emptyProfile(NOW));
});

test('long values are capped at 200 characters', () => {
  let p = setConsent(emptyProfile(NOW), 'transition_goals', true, NOW);
  p = setValue(p, 'transition_goals', 'x'.repeat(500), NOW);
  assert.equal(p.values.transition_goals!.length, 200);
});
