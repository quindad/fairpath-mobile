import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTUP_ACADEMY_TRACK, trackPercent, nextStep, markStepComplete, PROGRAM_REFERENCES, type TrackProgress } from '../src/core/entrepreneurship/tracks.ts';
import { summarizeBudget, blankBusinessPlan, updateSection, PLAN_DISCLAIMER, type StartupBudget } from '../src/core/entrepreneurship/business-plan.ts';

test('track has 15 steps and starts at 0 percent', () => {
  assert.equal(STARTUP_ACADEMY_TRACK.length, 15);
  assert.equal(trackPercent({ completedSteps: [] }), 0);
});

test('next step is always the first incomplete step, in order', () => {
  let p: TrackProgress = { completedSteps: [] };
  assert.equal(nextStep(p)!.id, 'choose_idea');
  p = markStepComplete(p, 'choose_idea');
  assert.equal(nextStep(p)!.id, 'validate_demand');
});

test('completing every step reaches 100 percent with no next step', () => {
  let p: TrackProgress = { completedSteps: [] };
  for (const s of STARTUP_ACADEMY_TRACK) p = markStepComplete(p, s.id);
  assert.equal(trackPercent(p), 100);
  assert.equal(nextStep(p), null);
});

test('marking a step twice does not double count', () => {
  let p: TrackProgress = { completedSteps: [] };
  p = markStepComplete(p, 'get_ein');
  p = markStepComplete(p, 'get_ein');
  assert.equal(p.completedSteps.length, 1);
});

test('no program reference claims an official partnership', () => {
  for (const p of PROGRAM_REFERENCES) assert.equal(p.officialPartnership, false, p.id);
});

const BUDGET: StartupBudget = {
  oneTimeCosts: [{ label: 'Equipment', monthlyUsd: 1200 }],
  monthlyCosts: [{ label: 'Rent', monthlyUsd: 300 }, { label: 'Supplies', monthlyUsd: 100 }],
  expectedMonthlyRevenue: 600,
};

test('budget summary sums costs and computes net correctly', () => {
  const s = summarizeBudget(BUDGET);
  assert.equal(s.totalOneTimeUsd, 1200);
  assert.equal(s.totalMonthlyCostsUsd, 400);
  assert.equal(s.monthlyNetUsd, 200);
  assert.equal(s.monthsToCoverStartupCosts, 6);
});

test('negative net never produces a months-to-cover figure or a negative cost', () => {
  const losing: StartupBudget = { oneTimeCosts: [{ label: 'x', monthlyUsd: -50 }], monthlyCosts: [{ label: 'y', monthlyUsd: 500 }], expectedMonthlyRevenue: 100 };
  const s = summarizeBudget(losing);
  assert.equal(s.totalOneTimeUsd, 0);
  assert.equal(s.monthlyNetUsd, 0);
  assert.equal(s.monthsToCoverStartupCosts, null);
});

test('blank plan has no pre-filled content and carries the disclaimer separately', () => {
  const plan = blankBusinessPlan();
  assert.ok(plan.length > 0);
  for (const s of plan) assert.equal(s.content, '');
  assert.ok(PLAN_DISCLAIMER.includes('does not guarantee'));
});

test('editing a section only changes that section, capped at 2000 characters', () => {
  const plan = updateSection(blankBusinessPlan(), 'summary', 'x'.repeat(3000));
  assert.equal(plan.find((s) => s.id === 'summary')!.content.length, 2000);
  assert.equal(plan.find((s) => s.id === 'customers')!.content, '');
});
