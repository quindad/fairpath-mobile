import {
  STARTUP_ACADEMY_TRACK,
  type TrackStep,
  type TrackStepInfo,
} from '../entrepreneurship/tracks.ts';

/** Academy lifecycle stages — used for onboarding and “start here” ordering (START-101). */
export const ACADEMY_STAGES = ['exploring', 'validating', 'launching', 'operating'] as const;
export type AcademyStage = (typeof ACADEMY_STAGES)[number];

export const ACADEMY_STAGE_LABELS: Record<AcademyStage, string> = {
  exploring: 'Exploring an idea',
  validating: 'Validating before you spend',
  launching: 'Getting ready to launch',
  operating: 'Running the business',
};

/** Canonical Expo Router paths for Startup Academy (F-1). */
export const ACADEMY_ROUTES = {
  home: '/entrepreneurship',
  plan: '/entrepreneurship/plan',
  budget: '/entrepreneurship/budget',
} as const;

export function academyLessonPath(stepId: TrackStep): `/entrepreneurship/lesson/${TrackStep}` {
  return `/entrepreneurship/lesson/${stepId}`;
}

/** Shown on academy home, exports, and work-product screens — no funding or success guarantees. */
export const ACADEMY_HONESTY_BANNER =
  'Nothing here promises funding, a grant, SBA approval, or a successful business. Your progress and drafts stay on this device until cloud sync is available.';

export type AcademyLessonModule = TrackStepInfo & {
  stage: AcademyStage;
  order: number;
};

const STEP_STAGE: Record<TrackStep, AcademyStage> = {
  choose_idea: 'exploring',
  validate_demand: 'exploring',
  research_competitors: 'exploring',
  choose_structure: 'validating',
  form_llc: 'validating',
  get_ein: 'validating',
  permits_and_licenses: 'validating',
  open_business_banking: 'launching',
  set_up_bookkeeping: 'launching',
  build_business_credit: 'launching',
  research_funding: 'launching',
  price_products: 'launching',
  market_the_business: 'operating',
  acquire_customers: 'operating',
  launch_and_operate: 'operating',
};

/** Recommended module order — wraps STARTUP_ACADEMY_TRACK with stage metadata. */
export const ACADEMY_LESSON_MODULES: readonly AcademyLessonModule[] = STARTUP_ACADEMY_TRACK.map(
  (step, index) => ({
    ...step,
    stage: STEP_STAGE[step.id],
    order: index + 1,
  }),
);

const MODULE_BY_ID = new Map(ACADEMY_LESSON_MODULES.map((m) => [m.id, m]));

export function getAcademyLesson(stepId: string): AcademyLessonModule | null {
  return MODULE_BY_ID.get(stepId as TrackStep) ?? null;
}

export function isTrackStepId(value: string): value is TrackStep {
  return MODULE_BY_ID.has(value as TrackStep);
}

/** Module ids in recommended order for a given stage (and prior stages). */
export function recommendedModuleIdsForStage(stage: AcademyStage): TrackStep[] {
  const stageIndex = ACADEMY_STAGES.indexOf(stage);
  return ACADEMY_LESSON_MODULES.filter((m) => ACADEMY_STAGES.indexOf(m.stage) <= stageIndex).map((m) => m.id);
}
