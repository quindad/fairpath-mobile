import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyPlan, COMPANION_ACTIONS, chargeableNow } from '../src/core/academy/learning-companion.ts';
import { enroll, completeLesson, type NativeCourse } from '../src/core/academy/enrollment.ts';

const COURSE: NativeCourse = {
  id: 'c',
  title: 'Fixture',
  authoredBy: 'fairpath',
  assessmentPassPercent: 80,
  lessons: [
    { id: 'a', title: 'A', required: true },
    { id: 'b', title: 'B', required: true },
    { id: 'x', title: 'Optional', required: false },
  ],
};

const NOW = '2026-10-06T00:00:00Z';

test('new enrollment lists every required lesson and no optional ones', () => {
  const plan = buildStudyPlan(COURSE, enroll(COURSE, NOW, null), false);
  assert.deepEqual(plan.steps.map((s) => s.id), ['lesson-a', 'lesson-b']);
  assert.equal(plan.percentComplete, 0);
});

test('finished lessons drop out of the plan in order', () => {
  let e = enroll(COURSE, NOW, null);
  e = completeLesson(COURSE, e, 'a');
  assert.deepEqual(buildStudyPlan(COURSE, e, false).steps.map((s) => s.id), ['lesson-b']);
});

test('after all lessons, the plan asks for the assessment until it is passed', () => {
  let e = enroll(COURSE, NOW, null);
  e = completeLesson(COURSE, e, 'a');
  e = completeLesson(COURSE, e, 'b');
  assert.deepEqual(buildStudyPlan(COURSE, e, false).steps.map((s) => s.kind), ['assessment']);
  assert.deepEqual(buildStudyPlan(COURSE, e, true).steps.map((s) => s.kind), ['review']);
});

test('plan never invents steps for an empty course', () => {
  const empty: NativeCourse = { ...COURSE, lessons: [] };
  const plan = buildStudyPlan(empty, enroll(empty, NOW, null), false);
  assert.deepEqual(plan.steps.map((s) => s.kind), ['assessment']);
  assert.equal(plan.percentComplete, 0);
});

test('only the included companion action can be charged, and its cost is from the frozen schedule', () => {
  const charged = COMPANION_ACTIONS.filter(chargeableNow);
  assert.deepEqual(charged.map((a) => a.id), []);
  for (const a of COMPANION_ACTIONS) {
    if (a.status === 'pending_approval') assert.equal(a.creditCost, null, a.id);
  }
});

test('no companion action invents a credit cost', () => {
  for (const a of COMPANION_ACTIONS) assert.equal(a.creditCost, null, a.id);
});
