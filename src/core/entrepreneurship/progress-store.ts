// Entrepreneurship track progress, device-local persistence (not server-synced yet), validated on load.
// A step is completed only after the device write succeeds. A failed write keeps the last saved progress.
import { markStepComplete, STARTUP_ACADEMY_TRACK, type TrackProgress, type TrackStep } from './tracks.ts';

export const ENTREPRENEURSHIP_STORAGE_KEY = 'fairpath.entrepreneurship.progress.v1';

const VALID_STEPS = new Set(STARTUP_ACADEMY_TRACK.map((s) => s.id));

export function parseProgress(raw: string | null): TrackProgress {
  if (!raw) return { completedSteps: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { completedSteps?: unknown }).completedSteps)) {
      return { completedSteps: [] };
    }
    const steps = (parsed as { completedSteps: unknown[] }).completedSteps.filter(
      (s): s is TrackProgress['completedSteps'][number] => typeof s === 'string' && VALID_STEPS.has(s as never),
    );
    return { completedSteps: steps };
  } catch {
    return { completedSteps: [] };
  }
}

export function serializeProgress(progress: TrackProgress): string {
  return JSON.stringify(progress);
}

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export async function saveProgress(store: KeyValueStore, progress: TrackProgress): Promise<boolean> {
  try {
    await store.setItem(ENTREPRENEURSHIP_STORAGE_KEY, serializeProgress(progress));
    return true;
  } catch {
    return false;
  }
}

/** Shown progress stays on the last successful write. A failed write does not mark the step complete. */
export async function persistStepCompletion(
  store: KeyValueStore,
  previous: TrackProgress,
  step: TrackStep,
): Promise<{ progress: TrackProgress; saved: boolean }> {
  const attempted = markStepComplete(previous, step);
  const saved = await saveProgress(store, attempted);
  return { saved, progress: saved ? attempted : previous };
}
