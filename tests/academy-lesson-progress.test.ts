import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTUP_ACADEMY_TRACK } from '../src/core/entrepreneurship/tracks.ts';
import {
  ACADEMY_LESSONS,
  getLessonContent,
  requiredExerciseIds,
  totalRequiredExercisesAcrossTrack,
} from '../src/core/academy/lessons.ts';
import {
  academyExerciseTrackPercent,
  canMarkLessonComplete,
  loadLessonExerciseProgress,
  parseLessonExerciseProgress,
  persistExerciseToggle,
  saveLessonExerciseProgress,
  setExerciseChecked,
  type KeyValueStore,
  type LessonExerciseProgress,
} from '../src/core/academy/lesson-progress-store.ts';

test('every track step has lesson content and required exercises', () => {
  assert.equal(ACADEMY_LESSONS.length, STARTUP_ACADEMY_TRACK.length);
  for (const step of STARTUP_ACADEMY_TRACK) {
    const content = getLessonContent(step.id);
    assert.ok(content.read.length > 20);
    assert.ok(content.reflectPrompt.length > 10);
    assert.ok(requiredExerciseIds(content).length >= 2);
  }
});

test('cannot mark lesson complete until required exercises are checked', () => {
  const stepId = 'choose_idea';
  const content = getLessonContent(stepId);
  const required = requiredExerciseIds(content);
  let progress: LessonExerciseProgress = { checkedByStep: {} };
  assert.equal(canMarkLessonComplete(progress, stepId), false);
  for (let i = 0; i < required.length - 1; i++) {
    progress = setExerciseChecked(progress, stepId, required[i], true);
    assert.equal(canMarkLessonComplete(progress, stepId), false);
  }
  progress = setExerciseChecked(progress, stepId, required[required.length - 1], true);
  assert.equal(canMarkLessonComplete(progress, stepId), true);
});

test('track percent reflects checked exercises not step completion alone', () => {
  const empty: LessonExerciseProgress = { checkedByStep: {} };
  assert.equal(academyExerciseTrackPercent(empty), 0);
  const total = totalRequiredExercisesAcrossTrack();
  assert.ok(total > 15);
  let progress = empty;
  let checked = 0;
  for (const lesson of ACADEMY_LESSONS) {
    for (const id of requiredExerciseIds(lesson)) {
      progress = setExerciseChecked(progress, lesson.stepId, id, true);
      checked += 1;
      assert.equal(academyExerciseTrackPercent(progress), Math.round((checked / total) * 100));
    }
  }
  assert.equal(academyExerciseTrackPercent(progress), 100);
});

test('parse drops invalid step ids and unknown exercise ids', () => {
  const raw = JSON.stringify({
    checkedByStep: {
      choose_idea: ['list_three', 'not_real'],
      bogus_step: ['x'],
      validate_demand: ['talked'],
    },
  });
  const parsed = parseLessonExerciseProgress(raw);
  assert.deepEqual(parsed.checkedByStep.choose_idea, ['list_three']);
  assert.deepEqual(parsed.checkedByStep.validate_demand, ['talked']);
  assert.equal(Object.hasOwn(parsed.checkedByStep, 'bogus_step'), false);
});

test('persistExerciseToggle keeps prior state when storage fails', async () => {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
  const before: LessonExerciseProgress = { checkedByStep: {} };
  const ok = await persistExerciseToggle(store, before, 'choose_idea', 'list_three', true);
  assert.equal(ok.saved, true);
  assert.deepEqual(ok.progress.checkedByStep.choose_idea, ['list_three']);
  assert.deepEqual(await loadLessonExerciseProgress(store), ok.progress);

  const broken: KeyValueStore = {
    getItem: async () => null,
    setItem: async () => {
      throw new Error('disk full');
    },
  };
  const fail = await persistExerciseToggle(broken, before, 'choose_idea', 'list_three', true);
  assert.equal(fail.saved, false);
  assert.deepEqual(fail.progress, before);
  assert.equal(await saveLessonExerciseProgress(broken, before), false);
});
