import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnrollments, serializeEnrollments, loadEnrollments, saveEnrollments, ACADEMY_STORAGE_KEY, type KeyValueStore } from '../src/core/academy/progress-store.ts';
import { NATIVE_FIXTURE_COURSE, scoreQuiz } from '../src/core/academy/native-fixtures.ts';

const GOOD = {
  'c1': {
    courseId: 'c1', enrolledAt: '2026-10-06T00:00:00Z', completedLessonIds: ['l1'],
    bookmarked: false, attempts: [{ courseId: 'c1', score: 2, maxScore: 3, attemptedAt: '2026-10-06T00:01:00Z' }], completedAt: null,
  },
};

test('round-trips a valid enrollment map', () => {
  assert.deepEqual(parseEnrollments(serializeEnrollments(GOOD)), GOOD);
});

test('null or empty storage yields an empty map', () => {
  assert.deepEqual(parseEnrollments(null), {});
  assert.deepEqual(parseEnrollments(''), {});
});

test('unreadable JSON yields an empty map and never throws', () => {
  assert.deepEqual(parseEnrollments('{not json'), {});
});

test('arrays and primitives are rejected', () => {
  assert.deepEqual(parseEnrollments('[]'), {});
  assert.deepEqual(parseEnrollments('"text"'), {});
});

test('records whose key does not match courseId are dropped', () => {
  const tampered = { other: GOOD.c1 };
  assert.deepEqual(parseEnrollments(JSON.stringify(tampered)), {});
});

test('attempts with score above max are dropped with their enrollment', () => {
  const bad = { c1: { ...GOOD.c1, attempts: [{ courseId: 'c1', score: 9, maxScore: 3, attemptedAt: 'x' }] } };
  assert.deepEqual(parseEnrollments(JSON.stringify(bad)), {});
});

test('a valid record survives next to an invalid one', () => {
  const mixed = { ...GOOD, bad: { courseId: 'bad', enrolledAt: 1 } };
  assert.deepEqual(Object.keys(parseEnrollments(JSON.stringify(mixed))), ['c1']);
});

test('non-string lesson ids and non-boolean bookmark are rejected', () => {
  const bad = { c1: { ...GOOD.c1, completedLessonIds: [1] } };
  assert.deepEqual(parseEnrollments(JSON.stringify(bad)), {});
  const bad2 = { c1: { ...GOOD.c1, bookmarked: 'yes' } };
  assert.deepEqual(parseEnrollments(JSON.stringify(bad2)), {});
});

test('load and save use the versioned key and report failures without throwing', async () => {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => { data.set(k, v); },
  };
  assert.equal(await saveEnrollments(store, GOOD), true);
  assert.ok(data.has(ACADEMY_STORAGE_KEY));
  assert.deepEqual(await loadEnrollments(store), GOOD);

  const broken: KeyValueStore = {
    getItem: async () => { throw new Error('disk gone'); },
    setItem: async () => { throw new Error('disk full'); },
  };
  assert.deepEqual(await loadEnrollments(broken), {});
  assert.equal(await saveEnrollments(broken, GOOD), false);
});

test('quiz scoring counts only correct answers and treats unanswered as wrong', () => {
  const q = NATIVE_FIXTURE_COURSE.quiz;
  assert.deepEqual(scoreQuiz(q, [0, 1, 0]), { correct: 3, total: 3 });
  assert.deepEqual(scoreQuiz(q, [0, null, null]), { correct: 1, total: 3 });
  assert.deepEqual(scoreQuiz(q, [1, 0, 1]), { correct: 0, total: 3 });
});

test('native fixture is labeled as a fixture and is FairPath-authored', () => {
  assert.equal(NATIVE_FIXTURE_COURSE.authoredBy, 'fairpath');
  assert.ok(NATIVE_FIXTURE_COURSE.title.includes('DEV fixture'));
});
