import { supabase } from '@/lib/supabase';
import {
  ACADEMY_PROFILE_QUESTION,
  MEMBER_ACADEMY_PROGRESS_TABLE,
  loadAcademyDeviceSnapshot,
  missingSupabaseRelation,
  setLastAcademySyncAttempt,
  type AcademyCloudSyncChannel,
  type AcademyDeviceSnapshot,
  type AcademySyncAttempt,
} from './cloud-persistence.ts';
import type { KeyValueStore } from './progress-store.ts';

export async function detectAcademyCloudChannel(): Promise<AcademyCloudSyncChannel> {
  const { error: tableError } = await supabase.from(MEMBER_ACADEMY_PROGRESS_TABLE).select('user_id').limit(0);
  if (!missingSupabaseRelation(tableError)) return 'member_table';

  const { error: profileError } = await supabase.from('profile_answers').select('question_id').limit(0);
  if (!profileError) return 'profile_answers';

  return 'none';
}

async function upsertProfileAnswer(userId: string, questionId: string, answer: unknown): Promise<boolean> {
  const { error } = await supabase.from('profile_answers').upsert(
    { user_id: userId, question_id: questionId, answer: answer as Record<string, unknown> },
    { onConflict: 'user_id,question_id' },
  );
  return !error;
}

async function syncViaProfileAnswers(userId: string, snapshot: AcademyDeviceSnapshot): Promise<boolean> {
  const workspacePayload = {
    idea: snapshot.workspace.idea,
    plan: snapshot.workspace.plan,
    budget: snapshot.workspace.budget,
  };
  const results = await Promise.all([
    upsertProfileAnswer(userId, ACADEMY_PROFILE_QUESTION.enrollments, snapshot.enrollments),
    upsertProfileAnswer(userId, ACADEMY_PROFILE_QUESTION.workspace, workspacePayload),
    upsertProfileAnswer(userId, ACADEMY_PROFILE_QUESTION.startupTrack, snapshot.startupTrack),
    upsertProfileAnswer(userId, ACADEMY_PROFILE_QUESTION.lessonExercises, snapshot.lessonExercises),
  ]);
  return results.every(Boolean);
}

async function syncViaMemberTable(userId: string, snapshot: AcademyDeviceSnapshot): Promise<boolean> {
  const row = {
    user_id: userId,
    enrollments: snapshot.enrollments,
    workspace: snapshot.workspace,
    startup_track: snapshot.startupTrack,
    lesson_exercises: snapshot.lessonExercises,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from(MEMBER_ACADEMY_PROGRESS_TABLE).upsert(row, { onConflict: 'user_id' });
  return !error;
}

/** Best-effort backup after local saves. Failures leave device data intact and update honest UI status. */
export async function attemptAcademyCloudBackup(store: KeyValueStore): Promise<AcademySyncAttempt> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const attempt: AcademySyncAttempt = {
      state: 'signed_out',
      channel: 'none',
      syncedAt: null,
      errorCode: 'signed_out',
    };
    setLastAcademySyncAttempt(attempt);
    return attempt;
  }

  const channel = await detectAcademyCloudChannel();
  if (channel === 'none') {
    const attempt: AcademySyncAttempt = {
      state: 'device_local',
      channel: 'none',
      syncedAt: null,
      errorCode: 'backend_unavailable',
    };
    setLastAcademySyncAttempt(attempt);
    return attempt;
  }

  const snapshot = await loadAcademyDeviceSnapshot(store);
  let ok = false;
  if (channel === 'member_table') {
    ok = (await syncViaMemberTable(user.id, snapshot)) || (await syncViaProfileAnswers(user.id, snapshot));
  } else {
    ok = await syncViaProfileAnswers(user.id, snapshot);
  }

  const attempt: AcademySyncAttempt = {
    state: ok ? 'cloud_synced' : 'device_local',
    channel,
    syncedAt: ok ? new Date().toISOString() : null,
    errorCode: ok ? null : 'save_failed',
  };
  setLastAcademySyncAttempt(attempt);
  return attempt;
}

export async function trySyncAcademyProgressToCloud(
  store: KeyValueStore,
  _payload?: { courseId: string; completedLessonIds: string[] },
): Promise<{ synced: false; reason: 'device_local_only' } | { synced: true }> {
  const attempt = await attemptAcademyCloudBackup(store);
  if (attempt.state === 'cloud_synced') return { synced: true };
  return { synced: false, reason: 'device_local_only' };
}
