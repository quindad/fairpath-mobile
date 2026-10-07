import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEMO_LABEL, DEMO_ASSIGNMENTS, DEMO_ASSIGNMENT_IN_REVIEW, DEMO_MEMBERS } from '../src/core/staffing/demo-fixtures.ts';
import { toMemberView } from '../src/core/staffing/member-view.ts';

test('the demo scenario has three placements and is unmistakably labeled', () => {
  assert.equal(DEMO_ASSIGNMENTS.length, 3);
  assert.ok(/DEV DEMO/.test(DEMO_LABEL));
});

test('the scenario includes one extension and one direct-hire conversion', () => {
  const extended = DEMO_ASSIGNMENTS.find((a) => a.expectedDurationWeeks === 20);
  const converted = DEMO_ASSIGNMENTS.find((a) => a.status === 'converted_to_direct_hire');
  assert.ok(extended);
  assert.ok(converted);
});

test('one assignment has a retention checkpoint due, matching the demo requirement', () => {
  assert.ok(DEMO_ASSIGNMENTS.some((a) => a.retentionCheckpointDueAt !== null));
});

test('demo members include an ordinary, a Veterans and a Reentry pathway member, with no record details exposed', () => {
  assert.equal(DEMO_MEMBERS.length, 3);
  const text = JSON.stringify(DEMO_MEMBERS);
  assert.ok(/Veterans pathway/.test(text));
  assert.ok(/Reentry pathway/.test(text));
  assert.equal(/felony|conviction|offense/i.test(text), false, 'no conviction detail is attached to a demo member');
});

test('every demo assignment passes cleanly through the member-safe view with no internal fields', () => {
  for (const a of [...DEMO_ASSIGNMENTS, DEMO_ASSIGNMENT_IN_REVIEW]) {
    const view = toMemberView(a);
    assert.equal('billRateHourly' in view, false);
    assert.equal('internalNotes' in view, false);
  }
});

test('the in-review fixture demonstrates screening in progress with onboarding not started', () => {
  assert.equal(DEMO_ASSIGNMENT_IN_REVIEW.screeningStatus, 'in_progress');
  assert.equal(DEMO_ASSIGNMENT_IN_REVIEW.onboardingStatus, 'not_started');
});

test('demo fixtures are never referenced from the evidence layer or any impact/statistics module', () => {
  const evidenceSrc = readFileSync(fileURLToPath(new URL('../src/core/staffing/evidence.ts', import.meta.url)), 'utf8');
  assert.equal(/demo-fixtures/.test(evidenceSrc), false);
});
