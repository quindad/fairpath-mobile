import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { STARTUP_ACADEMY_TRACK } from '../src/core/entrepreneurship/tracks.ts';
import {
  ACADEMY_HONESTY_BANNER,
  ACADEMY_LESSON_MODULES,
  ACADEMY_ROUTES,
  ACADEMY_STAGES,
  academyLessonPath,
  getAcademyLesson,
  isTrackStepId,
  recommendedModuleIdsForStage,
} from '../src/core/academy/catalog.ts';

test('ACADEMY_ROUTES match nested entrepreneurship paths', () => {
  assert.equal(ACADEMY_ROUTES.home, '/entrepreneurship');
  assert.equal(ACADEMY_ROUTES.plan, '/entrepreneurship/plan');
  assert.equal(ACADEMY_ROUTES.budget, '/entrepreneurship/budget');
});

test('catalog wraps every STARTUP_ACADEMY_TRACK step with stage metadata', () => {
  assert.equal(ACADEMY_LESSON_MODULES.length, STARTUP_ACADEMY_TRACK.length);
  assert.equal(ACADEMY_LESSON_MODULES.length, 15);
  for (let i = 0; i < STARTUP_ACADEMY_TRACK.length; i++) {
    const track = STARTUP_ACADEMY_TRACK[i];
    const mod = ACADEMY_LESSON_MODULES[i];
    assert.equal(mod.id, track.id);
    assert.equal(mod.title, track.title);
    assert.equal(mod.description, track.description);
    assert.equal(mod.order, i + 1);
    assert.ok(ACADEMY_STAGES.includes(mod.stage));
  }
});

test('academyLessonPath and getAcademyLesson resolve track steps', () => {
  assert.equal(academyLessonPath('choose_idea'), '/entrepreneurship/lesson/choose_idea');
  assert.ok(isTrackStepId('get_ein'));
  assert.equal(isTrackStepId('not_a_step'), false);
  assert.equal(getAcademyLesson('launch_and_operate')?.title, 'Launch and operate');
  assert.equal(getAcademyLesson('bogus'), null);
});

test('recommendedModuleIdsForStage includes earlier stages', () => {
  const exploring = recommendedModuleIdsForStage('exploring');
  assert.deepEqual(exploring, ['choose_idea', 'validate_demand', 'research_competitors']);
  const operating = recommendedModuleIdsForStage('operating');
  assert.equal(operating.length, 15);
  assert.equal(operating[operating.length - 1], 'launch_and_operate');
});

test('honesty banner rejects funding promises', () => {
  assert.match(ACADEMY_HONESTY_BANNER, /does not promise|Nothing here promises/i);
  assert.match(ACADEMY_HONESTY_BANNER, /device/i);
});

test('F-1 route files exist under src/app/entrepreneurship', () => {
  for (const rel of [
    'src/app/entrepreneurship/index.tsx',
    'src/app/entrepreneurship/plan.tsx',
    'src/app/entrepreneurship/budget.tsx',
    'src/app/entrepreneurship/lesson/[stepId].tsx',
  ]) {
    assert.ok(existsSync(rel), rel);
  }
  assert.equal(existsSync('src/app/entrepreneurship.tsx'), false);
});
