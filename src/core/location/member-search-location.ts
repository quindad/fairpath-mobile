import { DEFAULT_SEARCH_RADIUS_MILES } from '@/core/location/constants.ts';
import { loadLocationSettings } from '@/core/profile/location-service';
import { currentUserOptional } from '@/core/supabase/current-user';
import {
  deviceSnapshotZip,
  readCachedDeviceLocation,
  type DeviceLocationSnapshot,
} from '@/core/location/device-location-service.ts';
import { resolveSearchLocation, type ResolvedSearchLocation } from '@/core/location/search-location.ts';

export type MemberSearchLocation = ResolvedSearchLocation & {
  coordinates: { latitude: number; longitude: number } | null;
  deviceSnapshot: DeviceLocationSnapshot | null;
};

/** Shared ZIP/radius for Jobs, Housing, Resources, and Signal read tools. Never throws for guests. */
export async function loadMemberSearchLocation(queryText?: string): Promise<MemberSearchLocation> {
  const deviceSnapshot = await readCachedDeviceLocation();
  const deviceZip = deviceSnapshotZip(deviceSnapshot);

  let profileZip: string | null = null;
  let profileRadius = DEFAULT_SEARCH_RADIUS_MILES;

  const user = await currentUserOptional();
  if (user) {
    try {
      const settings = await loadLocationSettings();
      profileZip = settings.zip_code;
      profileRadius = settings.search_radius_miles;
    } catch {
      // Profile location columns may be unavailable — fall back to device/manual only.
    }
  }

  const resolved = resolveSearchLocation({
    profileZip,
    profileRadius,
    deviceZip,
    queryText,
  });

  return {
    ...resolved,
    coordinates: deviceSnapshot
      ? { latitude: deviceSnapshot.latitude, longitude: deviceSnapshot.longitude }
      : null,
    deviceSnapshot,
  };
}
