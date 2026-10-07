import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordDisclosure, activeGrants, requestDeletion, advanceDeletion, enforceFixedSettings, DEFAULT_SETTINGS, EXPORT_CATEGORIES } from '../src/core/privacy/privacy-center.ts';

test('every disclosure is recorded with an id and timestamp', () => {
  const log = recordDisclosure([], { documentOrDataId: 'doc1', audience: 'employer', action: 'granted', atIso: '2026-10-07T00:00:00Z' });
  assert.equal(log.length, 1);
  assert.equal(log[0]!.id, 'disc-1');
});

test('a revoked grant is no longer active', () => {
  let log = recordDisclosure([], { documentOrDataId: 'doc1', audience: 'employer', action: 'granted', atIso: 'a' });
  log = recordDisclosure(log, { documentOrDataId: 'doc1', audience: 'employer', action: 'revoked', atIso: 'b' });
  assert.deepEqual(activeGrants(log), []);
});

test('grants are per document and per audience', () => {
  let log = recordDisclosure([], { documentOrDataId: 'doc1', audience: 'employer', action: 'granted', atIso: 'a' });
  log = recordDisclosure(log, { documentOrDataId: 'doc1', audience: 'housing_provider', action: 'granted', atIso: 'b' });
  log = recordDisclosure(log, { documentOrDataId: 'doc1', audience: 'employer', action: 'revoked', atIso: 'c' });
  assert.deepEqual(activeGrants(log), [{ documentOrDataId: 'doc1', audience: 'housing_provider' }]);
});

test('access events are history only and never create a grant', () => {
  const log = recordDisclosure([], { documentOrDataId: 'doc1', audience: 'employer', action: 'accessed', atIso: 'a' });
  assert.deepEqual(activeGrants(log), []);
  assert.equal(log.length, 1);
});

test('location sharing and safety partner visibility cannot be enabled', () => {
  const tampered = enforceFixedSettings({ ...DEFAULT_SETTINGS, locationSharing: 'off', safetyPathwayPartnerVisibility: 'none' });
  assert.equal(tampered.locationSharing, 'off');
  assert.equal(tampered.safetyPathwayPartnerVisibility, 'none');
});

test('deletion request starts requested and is not duplicated while open', () => {
  const first = requestDeletion(null, 'd1', 'a');
  assert.equal(first.state, 'requested');
  assert.equal(requestDeletion(first, 'd2', 'b').id, 'd1');
});

test('deletion advances only forward through its states', () => {
  let r = requestDeletion(null, 'd1', 'a');
  r = advanceDeletion(r, 'in_review', null);
  assert.equal(r.state, 'in_review');
  assert.equal(advanceDeletion(r, 'requested' as never, null).state, 'in_review');
});

test('legal retention requires a stated reason', () => {
  const r = advanceDeletion(advanceDeletion(requestDeletion(null, 'd1', 'a'), 'in_review', null), 'legally_retained', '');
  assert.equal(r.state, 'in_review');
  const kept = advanceDeletion(r, 'legally_retained', 'Kept for required records');
  assert.equal(kept.state, 'legally_retained');
  assert.equal(kept.retentionReason, 'Kept for required records');
});

test('completed or retained requests are final', () => {
  const done = advanceDeletion(advanceDeletion(requestDeletion(null, 'd1', 'a'), 'in_review', null), 'completed', null);
  assert.equal(advanceDeletion(done, 'in_review', null).state, 'completed');
  assert.equal(requestDeletion(done, 'd2', 'b').id, 'd2', 'a finished request may be followed by a new one');
});

test('export never includes internal partner or donor records', () => {
  for (const c of EXPORT_CATEGORIES) assert.equal(/donor|partner_internal|staff|admin/.test(c), false, c);
});
