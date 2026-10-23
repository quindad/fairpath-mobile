import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  includedCompanionActions,
  signalWorksheetConsentLine,
  studyPlanForLesson,
} from '../src/core/academy/signal-worksheet.ts';
import { enrollmentFromStartupTrack, STARTUP_ACADEMY_COURSE } from '../src/core/academy/startup-course.ts';
import { academyPersistenceStatusLine, missingSupabaseRelation } from '../src/core/academy/cloud-persistence.ts';

test('academy persistence copy is honest for each sync state', () => {
  assert.match(academyPersistenceStatusLine('device_local'), /device/i);
  assert.match(academyPersistenceStatusLine('signed_out'), /Sign in/i);
  assert.match(academyPersistenceStatusLine('cloud_synced'), /backed up/i);
});

test('missingSupabaseRelation detects absent tables', () => {
  assert.equal(missingSupabaseRelation({ code: 'PGRST202', message: 'missing' }), true);
  assert.equal(missingSupabaseRelation({ message: 'relation "x" does not exist' }), true);
  assert.equal(missingSupabaseRelation(null), false);
});

test('Signal worksheet uses learning-companion study plan without paid actions', () => {
  const enrollment = enrollmentFromStartupTrack({ completedSteps: ['choose_idea'] }, '2026-10-06T00:00:00Z');
  const plan = studyPlanForLesson(STARTUP_ACADEMY_COURSE, enrollment, false);
  assert.ok(plan.steps.length > 0);
  assert.match(signalWorksheetConsentLine(), /no AI credits/i);
  assert.deepEqual(includedCompanionActions().map((a) => a.creditCost), [null]);
});

test('lesson screen embeds inline Signal worksheet (no fairpath-ai deep link)', () => {
  const src = fs.readFileSync('src/app/entrepreneurship/lesson/[stepId].tsx', 'utf8');
  assert.match(src, /AcademyLessonSignalWorksheet/);
  assert.doesNotMatch(src, /fairpath-ai\?q=/);
});
