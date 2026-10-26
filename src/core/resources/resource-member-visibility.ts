/** Member-facing resource rows — hide DEV fixtures unless explicitly enabled for QA. */

export function memberFixtureVisibilityEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_SHOW_DEV_RESOURCE_FIXTURES !== 'true') {
    return false;
  }
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__ === true;
  }
  return process.env.NODE_ENV !== 'production';
}

export function isMemberVisibleResourceOrigin(dataOrigin: string | null | undefined): boolean {
  if (!dataOrigin || dataOrigin === 'production') return true;
  if (dataOrigin === 'dev_fixture') return memberFixtureVisibilityEnabled();
  return false;
}

export function filterResourcesForMember<T extends { data_origin: string }>(rows: T[]): T[] {
  return rows.filter((r) => isMemberVisibleResourceOrigin(r.data_origin));
}
