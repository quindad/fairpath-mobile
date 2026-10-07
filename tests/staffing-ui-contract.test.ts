import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ASSIGNMENT_TYPE_EXPLANATION, employerOfRecordNote, buildTimeline, buildNextAction, FORBIDDEN_UI_PROP_FIELDS,
} from '../src/core/staffing/ui-contract.ts';

test('every assignment type has a plain-language explanation', () => {
  for (const kind of ['temporary', 'contract', 'temp_to_hire'] as const) {
    assert.ok(ASSIGNMENT_TYPE_EXPLANATION[kind].length > 20, kind);
  }
});

test('employer-of-record note never claims the arrangement is finalized before it is', () => {
  const pending = employerOfRecordNote('Acme Co.', false);
  assert.equal(/finalizing/i.test(pending.note), true);
  const finalized = employerOfRecordNote('Acme Co.', true);
  assert.equal(/finalizing/i.test(finalized.note), false);
  assert.ok(finalized.note.includes('Acme Co.'));
});

test('timeline marks every prior step done, the current step current, and later steps upcoming', () => {
  const steps = buildTimeline('screening');
  assert.deepEqual(steps.map((s) => s.state), ['done', 'done', 'current', 'upcoming', 'upcoming']);
});

test('timeline for converted_to_direct_hire shows every normal step done plus a terminal step', () => {
  const steps = buildTimeline('converted_to_direct_hire');
  assert.equal(steps[steps.length - 1]!.label, 'Converted to direct hire');
  assert.ok(steps.slice(0, -1).every((s) => s.state === 'done'));
});

test('timeline for ended shows a terminal "Assignment ended" step', () => {
  const steps = buildTimeline('ended');
  assert.equal(steps[steps.length - 1]!.label, 'Assignment ended');
});

test('next action is urgent when onboarding is pending or a retention check-in is due, not otherwise', () => {
  assert.equal(buildNextAction('onboarding', 'complete', 'pending', null).urgent, true);
  assert.equal(buildNextAction('active', 'complete', 'complete', '2026-11-01').urgent, true);
  assert.equal(buildNextAction('active', 'complete', 'complete', null).urgent, false);
});

test('next action for a converted assignment never asks for any further action', () => {
  const next = buildNextAction('converted_to_direct_hire', 'complete', 'complete', null);
  assert.equal(next.urgent, false);
  assert.equal(/nothing needed/i.test(next.text), true);
});

// ---- Serialization guarantee: no staffing UI component prop type can carry an internal economics field ----

test('none of the staffing UI prop types declared in ui-contract.ts include a forbidden financial field', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/core/staffing/ui-contract.ts', import.meta.url)), 'utf8');
  const propTypeSection = src.split('FORBIDDEN_UI_PROP_FIELDS')[0]!; // everything before the guard list itself
  for (const field of FORBIDDEN_UI_PROP_FIELDS) {
    assert.equal(propTypeSection.includes(field), false, `${field} found in a UI prop type`);
  }
});

test('the rendering component file never imports staffing/economics', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/components/staffing/StaffingComponents.tsx', import.meta.url)), 'utf8');
  assert.equal(/staffing\/economics/.test(src), false);
});
