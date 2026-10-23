/**
 * START-104: Academy cloud enrollment + workspace sync requires an approved migration (not applied in this repo batch).
 * Until then, all Academy progress is device-local with explicit UI copy — never implied as backed up to the server.
 */
export type AcademyCloudSyncState = 'device_local' | 'cloud_pending_migration';

export function academyCloudSyncState(): AcademyCloudSyncState {
  return 'device_local';
}

export function academyPersistenceStatusLine(state: AcademyCloudSyncState = academyCloudSyncState()): string {
  if (state === 'cloud_pending_migration') {
    return 'Cloud sync is being prepared. Your work is still saved on this device until DEV tables are approved.';
  }
  return 'Progress and workspace files stay on this device until academy cloud tables are approved and applied on DEV.';
}

/** No-op today; hook for post-migration sync without changing call sites. */
export async function trySyncAcademyProgressToCloud(_payload: { courseId: string; completedLessonIds: string[] }): Promise<{
  synced: false;
  reason: 'device_local_only';
}> {
  return { synced: false, reason: 'device_local_only' };
}
