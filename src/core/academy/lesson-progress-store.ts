// Device-local exercise checklists per academy lesson step. Not server-synced yet.
import type { TrackStep } from '../entrepreneurship/tracks.ts';
import {
  ACADEMY_LESSONS,
  getLessonContentOrNull,
  requiredExerciseIds,
  totalRequiredExercisesAcrossTrack,
  validExerciseId,
} from './lessons.ts';

export const ACADEMY_LESSON_EXERCISES_STORAGE_KEY = 'fairpath.academy.lesson-exercises.v1';

export type LessonExerciseProgress = {
  /** Checked exercise ids per track step. */
  checkedByStep: Partial<Record<TrackStep, string[]>>;
};

const VALID_STEPS = new Set(ACADEMY_LESSONS.map((l) => l.stepId));

const isString = (v: unknown): v is string => typeof v === 'string';

function sanitizeStepChecks(stepId: TrackStep, ids: unknown[]): string[] {
  const content = getLessonContentOrNull(stepId);
  if (!content) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!isString(id) || seen.has(id) || !validExerciseId(content, id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function emptyLessonExerciseProgress(): LessonExerciseProgress {
  return { checkedByStep: {} };
}

export function parseLessonExerciseProgress(raw: string | null): LessonExerciseProgress {
  if (!raw) return emptyLessonExerciseProgress();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyLessonExerciseProgress();
    const map = (parsed as { checkedByStep?: unknown }).checkedByStep;
    if (!map || typeof map !== 'object' || Array.isArray(map)) return emptyLessonExerciseProgress();
    const checkedByStep: LessonExerciseProgress['checkedByStep'] = {};
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      if (!VALID_STEPS.has(key as TrackStep) || !Array.isArray(value)) continue;
      const cleaned = sanitizeStepChecks(key as TrackStep, value);
      if (cleaned.length > 0) checkedByStep[key as TrackStep] = cleaned;
    }
    return { checkedByStep };
  } catch {
    return emptyLessonExerciseProgress();
  }
}

export function serializeLessonExerciseProgress(progress: LessonExerciseProgress): string {
  return JSON.stringify(progress);
}

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export async function loadLessonExerciseProgress(store: KeyValueStore): Promise<LessonExerciseProgress> {
  try {
    return parseLessonExerciseProgress(await store.getItem(ACADEMY_LESSON_EXERCISES_STORAGE_KEY));
  } catch {
    return emptyLessonExerciseProgress();
  }
}

export async function saveLessonExerciseProgress(store: KeyValueStore, progress: LessonExerciseProgress): Promise<boolean> {
  try {
    await store.setItem(ACADEMY_LESSON_EXERCISES_STORAGE_KEY, serializeLessonExerciseProgress(progress));
    return true;
  } catch {
    return false;
  }
}

export function checkedSetForStep(progress: LessonExerciseProgress, stepId: TrackStep): Set<string> {
  return new Set(progress.checkedByStep[stepId] ?? []);
}

export function isExerciseChecked(progress: LessonExerciseProgress, stepId: TrackStep, exerciseId: string): boolean {
  return checkedSetForStep(progress, stepId).has(exerciseId);
}

export function setExerciseChecked(
  progress: LessonExerciseProgress,
  stepId: TrackStep,
  exerciseId: string,
  checked: boolean,
): LessonExerciseProgress {
  const content = getLessonContentOrNull(stepId);
  if (!content || !validExerciseId(content, exerciseId)) return progress;
  const current = checkedSetForStep(progress, stepId);
  if (checked) current.add(exerciseId);
  else current.delete(exerciseId);
  const nextIds = [...current];
  const checkedByStep = { ...progress.checkedByStep };
  if (nextIds.length === 0) delete checkedByStep[stepId];
  else checkedByStep[stepId] = nextIds;
  return { checkedByStep };
}

/** Required exercises for this step must all be checked before the lesson can be marked complete. */
export function canMarkLessonComplete(progress: LessonExerciseProgress, stepId: TrackStep): boolean {
  const content = getLessonContentOrNull(stepId);
  if (!content) return false;
  const checked = checkedSetForStep(progress, stepId);
  return requiredExerciseIds(content).every((id) => checked.has(id));
}

export function countCheckedRequiredExercises(progress: LessonExerciseProgress): number {
  let count = 0;
  for (const lesson of ACADEMY_LESSONS) {
    const checked = checkedSetForStep(progress, lesson.stepId);
    for (const id of requiredExerciseIds(lesson)) {
      if (checked.has(id)) count += 1;
    }
  }
  return count;
}

/** Track-wide percent from required exercise checkboxes (0–100), not step-complete buttons alone. */
export function academyExerciseTrackPercent(progress: LessonExerciseProgress): number {
  const total = totalRequiredExercisesAcrossTrack();
  if (total === 0) return 0;
  return Math.round((countCheckedRequiredExercises(progress) / total) * 100);
}

/** Persists a toggle; returns previous progress if the write fails. */
export async function persistExerciseToggle(
  store: KeyValueStore,
  previous: LessonExerciseProgress,
  stepId: TrackStep,
  exerciseId: string,
  checked: boolean,
): Promise<{ progress: LessonExerciseProgress; saved: boolean }> {
  const attempted = setExerciseChecked(previous, stepId, exerciseId, checked);
  const saved = await saveLessonExerciseProgress(store, attempted);
  return { saved, progress: saved ? attempted : previous };
}
