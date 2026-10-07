// Entrepreneurship track progress, device-local persistence (not server-synced yet), validated on load.
import type { TrackProgress } from './tracks.ts';
import { STARTUP_ACADEMY_TRACK } from './tracks.ts';

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
