import test from 'node:test';
import assert from 'node:assert/strict';
import { blankBusinessPlan, updateSection } from '../src/core/entrepreneurship/business-plan.ts';
import {
  ACADEMY_BUDGET_STORAGE_KEY,
  ACADEMY_BUSINESS_PLAN_STORAGE_KEY,
  ACADEMY_IDEA_STORAGE_KEY,
  academyPlanPath,
  computeAcademyNextActions,
  emptyAcademyWorkspace,
  loadAcademyWorkspace,
  parseBusinessIdea,
  parseBusinessPlan,
  parseStartupBudget,
  planSectionForLesson,
  saveBusinessIdea,
  saveBusinessPlan,
  saveStartupBudget,
  serializeBusinessPlan,
  type KeyValueStore,
} from '../src/core/academy/workspace-store.ts';
import { emptyLessonExerciseProgress } from '../src/core/academy/lesson-progress-store.ts';

test('plan parse merges stored content onto blank template', () => {
  const raw = serializeBusinessPlan(updateSection(blankBusinessPlan(), 'summary', 'My shop'));
  const plan = parseBusinessPlan(raw);
  assert.equal(plan.find((s) => s.id === 'summary')!.content, 'My shop');
  assert.equal(plan.find((s) => s.id === 'customers')!.content, '');
});

test('plan parse rejects unknown section ids and bad JSON', () => {
  assert.deepEqual(parseBusinessPlan(null), blankBusinessPlan());
  assert.deepEqual(parseBusinessPlan('{'), blankBusinessPlan());
  const tampered = JSON.stringify([{ id: 'bogus', content: 'x' }]);
  assert.equal(parseBusinessPlan(tampered).every((s) => s.content === ''), true);
});

test('idea and budget round-trip through storage keys', async () => {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
  const plan = updateSection(blankBusinessPlan(), 'pricing', '$40/hr');
  const budget = {
    oneTimeCosts: [{ label: 'Tools', monthlyUsd: 200 }],
    monthlyCosts: [{ label: 'Phone', monthlyUsd: 50 }],
    expectedMonthlyRevenue: 800,
  };
  assert.equal(await saveBusinessIdea(store, 'Mobile detailing'), true);
  assert.equal(await saveBusinessPlan(store, plan), true);
  assert.equal(await saveStartupBudget(store, budget), true);
  assert.ok(data.has(ACADEMY_IDEA_STORAGE_KEY));
  assert.ok(data.has(ACADEMY_BUSINESS_PLAN_STORAGE_KEY));
  assert.ok(data.has(ACADEMY_BUDGET_STORAGE_KEY));
  const loaded = await loadAcademyWorkspace(store);
  assert.equal(loaded.idea, 'Mobile detailing');
  assert.equal(loaded.plan.find((s) => s.id === 'pricing')!.content, '$40/hr');
  assert.deepEqual(loaded.budget, budget);
});

test('loadAcademyWorkspace survives storage failures', async () => {
  const broken: KeyValueStore = {
    getItem: async () => {
      throw new Error('disk');
    },
    setItem: async () => {},
  };
  assert.deepEqual(await loadAcademyWorkspace(broken), emptyAcademyWorkspace());
});

test('academyPlanPath encodes section query', () => {
  assert.equal(academyPlanPath(), '/entrepreneurship/plan');
  assert.equal(academyPlanPath('summary'), '/entrepreneurship/plan?section=summary');
});

test('planSectionForLesson maps key steps', () => {
  assert.equal(planSectionForLesson('choose_idea'), 'summary');
  assert.equal(planSectionForLesson('price_products'), 'pricing');
  assert.equal(planSectionForLesson('get_ein'), null);
});

test('next actions prioritize idea then exercises then empty plan sections', () => {
  const workspace = emptyAcademyWorkspace();
  const progress = emptyLessonExerciseProgress();
  const actions = computeAcademyNextActions(progress, workspace, 50);
  assert.equal(actions[0].kind, 'idea');
  assert.ok(actions.some((a) => a.kind === 'exercise' && a.route.includes('choose_idea')));
  assert.ok(actions.some((a) => a.kind === 'plan_section' && a.id === 'plan-summary'));
  assert.ok(actions.some((a) => a.kind === 'budget'));
});

test('next actions omit idea when filled and omit budget when lines exist', () => {
  const workspace = {
    idea: 'Coffee cart',
    plan: blankBusinessPlan().map((s) => ({ ...s, content: 'done' })),
    budget: {
      oneTimeCosts: [{ label: 'Cart', monthlyUsd: 1000 }],
      monthlyCosts: [],
      expectedMonthlyRevenue: 0,
    },
  };
  const actions = computeAcademyNextActions(emptyLessonExerciseProgress(), workspace, 50);
  assert.equal(actions.some((a) => a.kind === 'idea'), false);
  assert.equal(actions.some((a) => a.kind === 'plan_section'), false);
  assert.equal(actions.some((a) => a.kind === 'budget'), false);
  assert.ok(actions.some((a) => a.kind === 'exercise'));
});

test('idea text is capped', () => {
  assert.equal(parseBusinessIdea('a'.repeat(5000)).length, 4000);
});
