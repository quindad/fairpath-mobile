// Device-local academy work products: business idea, plan sections, and startup budget.
import type { TrackStep } from '../entrepreneurship/tracks.ts';
import { STARTUP_ACADEMY_TRACK } from '../entrepreneurship/tracks.ts';
import {
  blankBusinessPlan,
  blankStartupBudget,
  emptyPlanSectionIds,
  isStartupBudgetEmpty,
  sanitizeUsd,
  type PlanSection,
  type StartupBudget,
} from '../entrepreneurship/business-plan.ts';
import { getLessonContentOrNull } from './lessons.ts';
import { checkedSetForStep, type LessonExerciseProgress } from './lesson-progress-store.ts';
import { ACADEMY_ROUTES } from './catalog.ts';

export const ACADEMY_IDEA_STORAGE_KEY = 'fairpath.academy.business_idea.v1';
export const ACADEMY_BUSINESS_PLAN_STORAGE_KEY = 'academy.business_plan.v1';
export const ACADEMY_BUDGET_STORAGE_KEY = 'fairpath.academy.startup_budget.v1';

const MAX_IDEA_CHARS = 4000;
const VALID_SECTION_IDS = new Set(blankBusinessPlan().map((s) => s.id));

export type AcademyWorkspace = {
  idea: string;
  plan: PlanSection[];
  budget: StartupBudget;
};

export type AcademyNextAction = {
  id: string;
  title: string;
  body: string;
  route: string;
  kind: 'idea' | 'plan_section' | 'budget' | 'exercise';
};

/** Lessons that map to a plan section for deep links from the lesson screen. */
export const LESSON_PLAN_SECTION: Partial<Record<TrackStep, string>> = {
  choose_idea: 'summary',
  validate_demand: 'customers',
  research_competitors: 'offer',
  choose_structure: 'operations',
  set_up_bookkeeping: 'operations',
  price_products: 'pricing',
  market_the_business: 'marketing',
  acquire_customers: 'customers',
  launch_and_operate: 'milestones',
};

export function planSectionForLesson(stepId: TrackStep): string | null {
  return LESSON_PLAN_SECTION[stepId] ?? null;
}

export function academyPlanPath(sectionId?: string): string {
  if (!sectionId) return ACADEMY_ROUTES.plan;
  return `${ACADEMY_ROUTES.plan}?section=${encodeURIComponent(sectionId)}`;
}

export function emptyAcademyWorkspace(): AcademyWorkspace {
  return { idea: '', plan: blankBusinessPlan(), budget: blankStartupBudget() };
}

export function parseBusinessIdea(raw: string | null): string {
  if (!raw) return '';
  if (typeof raw !== 'string') return '';
  return raw.slice(0, MAX_IDEA_CHARS);
}

export function serializeBusinessIdea(idea: string): string {
  return parseBusinessIdea(idea);
}

export function parseBusinessPlan(raw: string | null): PlanSection[] {
  const template = blankBusinessPlan();
  if (!raw) return template;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return template;
    const byId = new Map<string, string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const id = (item as { id?: unknown }).id;
      const content = (item as { content?: unknown }).content;
      if (typeof id !== 'string' || !VALID_SECTION_IDS.has(id)) continue;
      if (typeof content !== 'string') continue;
      byId.set(id, content.slice(0, 2000));
    }
    return template.map((s) => ({ ...s, content: byId.get(s.id) ?? '' }));
  } catch {
    return template;
  }
}

export function serializeBusinessPlan(plan: readonly PlanSection[]): string {
  return JSON.stringify(plan.map(({ id, title, prompt, content }) => ({ id, title, prompt, content })));
}

function sanitizeBudgetLine(value: unknown): { label: string; monthlyUsd: number } | null {
  if (!value || typeof value !== 'object') return null;
  const label = (value as { label?: unknown }).label;
  const monthlyUsd = (value as { monthlyUsd?: unknown }).monthlyUsd;
  if (typeof label !== 'string') return null;
  if (typeof monthlyUsd !== 'number' || !Number.isFinite(monthlyUsd)) return null;
  return { label: label.slice(0, 120), monthlyUsd: sanitizeUsd(monthlyUsd) };
}

export function parseStartupBudget(raw: string | null): StartupBudget {
  const empty = blankStartupBudget();
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
    const oneRaw = (parsed as { oneTimeCosts?: unknown }).oneTimeCosts;
    const monthlyRaw = (parsed as { monthlyCosts?: unknown }).monthlyCosts;
    const revenueRaw = (parsed as { expectedMonthlyRevenue?: unknown }).expectedMonthlyRevenue;
    const oneTimeCosts = Array.isArray(oneRaw)
      ? oneRaw.map(sanitizeBudgetLine).filter((l): l is NonNullable<typeof l> => l !== null).slice(0, 24)
      : [];
    const monthlyCosts = Array.isArray(monthlyRaw)
      ? monthlyRaw.map(sanitizeBudgetLine).filter((l): l is NonNullable<typeof l> => l !== null).slice(0, 24)
      : [];
    const expectedMonthlyRevenue =
      typeof revenueRaw === 'number' && Number.isFinite(revenueRaw) ? sanitizeUsd(revenueRaw) : 0;
    return { oneTimeCosts, monthlyCosts, expectedMonthlyRevenue };
  } catch {
    return empty;
  }
}

export function serializeStartupBudget(budget: StartupBudget): string {
  return JSON.stringify(budget);
}

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export async function loadAcademyWorkspace(store: KeyValueStore): Promise<AcademyWorkspace> {
  try {
    const [ideaRaw, planRaw, budgetRaw] = await Promise.all([
      store.getItem(ACADEMY_IDEA_STORAGE_KEY),
      store.getItem(ACADEMY_BUSINESS_PLAN_STORAGE_KEY),
      store.getItem(ACADEMY_BUDGET_STORAGE_KEY),
    ]);
    return {
      idea: parseBusinessIdea(ideaRaw),
      plan: parseBusinessPlan(planRaw),
      budget: parseStartupBudget(budgetRaw),
    };
  } catch {
    return emptyAcademyWorkspace();
  }
}

export async function saveBusinessIdea(store: KeyValueStore, idea: string): Promise<boolean> {
  try {
    await store.setItem(ACADEMY_IDEA_STORAGE_KEY, serializeBusinessIdea(idea));
    return true;
  } catch {
    return false;
  }
}

export async function saveBusinessPlan(store: KeyValueStore, plan: readonly PlanSection[]): Promise<boolean> {
  try {
    await store.setItem(ACADEMY_BUSINESS_PLAN_STORAGE_KEY, serializeBusinessPlan(plan));
    return true;
  } catch {
    return false;
  }
}

export async function saveStartupBudget(store: KeyValueStore, budget: StartupBudget): Promise<boolean> {
  try {
    await store.setItem(ACADEMY_BUDGET_STORAGE_KEY, serializeStartupBudget(budget));
    return true;
  } catch {
    return false;
  }
}

function firstIncompleteExercise(
  progress: LessonExerciseProgress,
  stepId: TrackStep,
): { exerciseId: string; label: string } | null {
  const content = getLessonContentOrNull(stepId);
  if (!content) return null;
  const checked = checkedSetForStep(progress, stepId);
  for (const ex of content.exercises) {
    if (ex.required === false) continue;
    if (!checked.has(ex.id)) return { exerciseId: ex.id, label: ex.label };
  }
  return null;
}

/** Suggested next steps from an empty idea, open exercises, empty plan sections, and an empty budget. */
export function computeAcademyNextActions(
  exerciseProgress: LessonExerciseProgress,
  workspace: AcademyWorkspace,
  limit = 6,
): AcademyNextAction[] {
  const actions: AcademyNextAction[] = [];

  if (!workspace.idea.trim()) {
    actions.push({
      id: 'idea',
      title: 'Write your business idea',
      body: 'A short description helps Signal and your plan stay grounded in your own words.',
      route: ACADEMY_ROUTES.home,
      kind: 'idea',
    });
  }

  for (const step of STARTUP_ACADEMY_TRACK) {
    const incomplete = firstIncompleteExercise(exerciseProgress, step.id);
    if (incomplete) {
      actions.push({
        id: `exercise-${step.id}-${incomplete.exerciseId}`,
        title: step.title,
        body: incomplete.label,
        route: `/entrepreneurship/lesson/${step.id}`,
        kind: 'exercise',
      });
    }
  }

  for (const sectionId of emptyPlanSectionIds(workspace.plan)) {
    const section = workspace.plan.find((s) => s.id === sectionId);
    if (!section) continue;
    actions.push({
      id: `plan-${sectionId}`,
      title: section.title,
      body: section.prompt,
      route: academyPlanPath(sectionId),
      kind: 'plan_section',
    });
  }

  if (isStartupBudgetEmpty(workspace.budget)) {
    actions.push({
      id: 'budget',
      title: 'Build your startup budget',
      body: 'Enter one-time costs, monthly costs, and revenue you expect — all numbers are yours, not FairPath estimates.',
      route: ACADEMY_ROUTES.budget,
      kind: 'budget',
    });
  }

  return actions.slice(0, Math.max(1, limit));
}
