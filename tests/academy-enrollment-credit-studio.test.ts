import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enroll, completeLesson, progressPercent, scoreAttempt, passed, certificateEligible, complete,
  type NativeCourse, type Enrollment,
} from '../src/core/academy/enrollment.ts';
import { utilization, utilizationBand, paydownToTarget } from '../src/core/credit-studio/utilization.ts';

const NOW = '2026-10-06T12:00:00Z';

const COURSE: NativeCourse = {
  id: 'native-1',
  title: 'FairPath native fixture course',
  authoredBy: 'fairpath',
  assessmentPassPercent: 80,
  lessons: [
    { id: 'l1', title: 'Lesson 1', required: true },
    { id: 'l2', title: 'Lesson 2', required: true },
    { id: 'l3', title: 'Optional reading', required: false },
  ],
};

const EXTERNAL: NativeCourse = { ...COURSE, id: 'ext-1', authoredBy: 'external' };

function start(c: NativeCourse): Enrollment {
  return enroll(c, NOW, null);
}

test('enrolling twice returns the same enrollment', () => {
  const first = start(COURSE);
  assert.equal(enroll(COURSE, '2026-11-01T00:00:00Z', first), first);
});

test('completing a lesson is idempotent and ignores unknown lessons', () => {
  let e = start(COURSE);
  e = completeLesson(COURSE, e, 'l1');
  e = completeLesson(COURSE, e, 'l1');
  e = completeLesson(COURSE, e, 'not-a-lesson');
  assert.deepEqual(e.completedLessonIds, ['l1']);
});

test('progress counts only required lessons', () => {
  let e = start(COURSE);
  e = completeLesson(COURSE, e, 'l1');
  assert.equal(progressPercent(COURSE, e), 50);
  e = completeLesson(COURSE, e, 'l3');
  assert.equal(progressPercent(COURSE, e), 50);
  e = completeLesson(COURSE, e, 'l2');
  assert.equal(progressPercent(COURSE, e), 100);
});

test('invalid scores are rejected', () => {
  assert.equal(scoreAttempt(COURSE, 11, 10, NOW), null);
  assert.equal(scoreAttempt(COURSE, -1, 10, NOW), null);
  assert.equal(scoreAttempt(COURSE, 5, 0, NOW), null);
});

test('pass threshold is applied to percentage', () => {
  const pass = scoreAttempt(COURSE, 8, 10, NOW)!;
  const fail = scoreAttempt(COURSE, 7, 10, NOW)!;
  assert.equal(passed(COURSE, pass), true);
  assert.equal(passed(COURSE, fail), false);
});

test('certificate requires all required lessons and a passed assessment', () => {
  let e = start(COURSE);
  assert.deepEqual(certificateEligible(COURSE, e), { eligible: false, reason: 'lessons_incomplete' });
  e = completeLesson(COURSE, e, 'l1');
  e = completeLesson(COURSE, e, 'l2');
  assert.deepEqual(certificateEligible(COURSE, e), { eligible: false, reason: 'assessment_not_passed' });
  e = { ...e, attempts: [scoreAttempt(COURSE, 5, 10, NOW)!] };
  assert.deepEqual(certificateEligible(COURSE, e), { eligible: false, reason: 'assessment_not_passed' });
  e = { ...e, attempts: [...e.attempts, scoreAttempt(COURSE, 9, 10, NOW)!] };
  assert.deepEqual(certificateEligible(COURSE, e), { eligible: true });
});

test('external-provider courses never receive a FairPath certificate', () => {
  let e = start(EXTERNAL);
  e = completeLesson(EXTERNAL, e, 'l1');
  e = completeLesson(EXTERNAL, e, 'l2');
  e = { ...e, attempts: [scoreAttempt(EXTERNAL, 10, 10, NOW)!] };
  assert.deepEqual(certificateEligible(EXTERNAL, e), { eligible: false, reason: 'external_course' });
  assert.equal(complete(EXTERNAL, e, NOW).completedAt, null);
});

test('completion timestamp is set only when eligible and never backdated or overwritten', () => {
  let e = start(COURSE);
  e = completeLesson(COURSE, e, 'l1');
  e = completeLesson(COURSE, e, 'l2');
  e = { ...e, attempts: [scoreAttempt(COURSE, 10, 10, NOW)!] };
  const done = complete(COURSE, e, NOW);
  assert.equal(done.completedAt, NOW);
  assert.equal(complete(COURSE, done, '2030-01-01T00:00:00Z').completedAt, NOW);
});

// ---- Credit Studio utilization: descriptive only, never a score ----

test('no accounts shows no utilization', () => {
  assert.deepEqual(utilization([]), { status: 'no_accounts' });
});

test('accounts without a limit cannot produce a percentage', () => {
  assert.deepEqual(utilization([{ name: 'A', balanceUsd: 100, limitUsd: 0 }]), { status: 'missing_limits', accounts: ['A'] });
});

test('overall utilization is total balance over total limit', () => {
  const r = utilization([
    { name: 'A', balanceUsd: 300, limitUsd: 1000 },
    { name: 'B', balanceUsd: 200, limitUsd: 1000 },
  ]);
  assert.equal(r.status, 'ok');
  if (r.status === 'ok') {
    assert.equal(r.overallPercent, 25);
    assert.deepEqual(r.perAccount, [{ name: 'A', percent: 30 }, { name: 'B', percent: 20 }]);
  }
});

test('negative balances are treated as zero', () => {
  const r = utilization([{ name: 'A', balanceUsd: -50, limitUsd: 500 }]);
  if (r.status === 'ok') assert.equal(r.overallPercent, 0);
});

test('bands are descriptive thresholds', () => {
  assert.equal(utilizationBand(10), 'low');
  assert.equal(utilizationBand(45), 'moderate');
  assert.equal(utilizationBand(80), 'high');
});

test('paydown suggestion is hypothetical arithmetic and never negative', () => {
  assert.equal(paydownToTarget(900, 1000, 30), 600);
  assert.equal(paydownToTarget(100, 1000, 30), 0);
  assert.equal(paydownToTarget(100, 0, 30), 0);
});
