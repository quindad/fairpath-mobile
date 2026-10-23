/**
 * START-104: Honest academy backup status (pure helpers + shared types).
 */
import {
  ACADEMY_LESSON_EXERCISES_STORAGE_KEY,
  type LessonExerciseProgress,
  parseLessonExerciseProgress,
} from './lesson-progress-store.ts';
import { loadEnrollments, type EnrollmentMap, type KeyValueStore } from './progress-store.ts';
import { loadAcademyWorkspace, type AcademyWorkspace } from './workspace-store.ts';
import { ENTREPRENEURSHIP_STORAGE_KEY, parseProgress, type TrackProgress } from '../entrepreneurship/progress-store.ts';
export const MEMBER_ACADEMY_PROGRESS_TABLE = 'member_academy_progress';

export const ACADEMY_PROFILE_QUESTION = {
  enrollments: 'academy.enrollments.v1',
  workspace: 'academy.workspace.v1',
  startupTrack: 'academy.startup_track.v1',
  lessonExercises: 'academy.lesson_exercises.v1',
} as const;

export type AcademyCloudSyncChannel = 'member_table' | 'profile_answers' | 'none';

export type AcademyCloudSyncState =
  | 'signed_out'
  | 'device_local'
  | 'cloud_pending_migration'
  | 'cloud_synced';

export type AcademySyncAttempt = {
  state: AcademyCloudSyncState;
  channel: AcademyCloudSyncChannel;
  syncedAt: string | null;
  errorCode: 'signed_out' | 'backend_unavailable' | 'save_failed' | null;
};

let lastAttempt: AcademySyncAttempt = {
  state: 'device_local',
  channel: 'none',
  syncedAt: null,
  errorCode: null,
};

export function setLastAcademySyncAttempt(attempt: AcademySyncAttempt): void {
  lastAttempt = attempt;
}

export function getLastAcademySyncAttempt(): AcademySyncAttempt {
  return lastAttempt;
}

export function academyCloudSyncState(): AcademyCloudSyncState {
  return lastAttempt.state;
}

export function missingSupabaseRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST202' ||
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

export function academyPersistenceStatusLine(state: AcademyCloudSyncState = academyCloudSyncState()): string {
  switch (state) {
    case 'signed_out':
      return 'Sign in to back up Academy progress to your FairPath account. Until then, everything stays on this device.';
    case 'cloud_synced':
      return 'Your latest Academy progress was backed up to FairPath. Exercises and drafts still load from this device first.';
    case 'cloud_pending_migration':
      return 'Cloud sync is being prepared. Your work is saved on this device until DEV academy tables are approved.';
    case 'device_local':
    default:
      return 'Progress and workspace files stay on this device until a backup succeeds (dedicated academy tables or profile answers).';
  }
}

export type AcademyDeviceSnapshot = {
  enrollments: EnrollmentMap;
  workspace: AcademyWorkspace;
  startupTrack: TrackProgress;
  lessonExercises: LessonExerciseProgress;
};

export async function loadAcademyDeviceSnapshot(store: KeyValueStore): Promise<AcademyDeviceSnapshot> {
  const [enrollments, workspace, trackRaw, exerciseRaw] = await Promise.all([
    loadEnrollments(store),
    loadAcademyWorkspace(store),
    store.getItem(ENTREPRENEURSHIP_STORAGE_KEY),
    store.getItem(ACADEMY_LESSON_EXERCISES_STORAGE_KEY),
  ]);
  return {
    enrollments,
    workspace,
    startupTrack: parseProgress(trackRaw),
    lessonExercises: parseLessonExerciseProgress(exerciseRaw),
  };
}
