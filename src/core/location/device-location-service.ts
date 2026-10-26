import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ensureExpoGeocodingProvider, createExpoGeocodingProvider } from '@/core/location/expo-geocoding-provider.ts';
import { reverseGeocodeCoordinates } from '@/core/location/geocoding-provider.ts';
import { isZip5 } from '@/core/location/search-location.ts';

const SNAPSHOT_KEY = '@fairpath/device_location_snapshot_v1';
const POSITION_TIMEOUT_MS = 12_000;

export type LocationPermissionState = 'undetermined' | 'granted' | 'denied' | 'unavailable';

export type DeviceLocationSnapshot = {
  latitude: number;
  longitude: number;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  capturedAt: string;
  accuracyMeters: number | null;
};

export type DeviceLocationResult =
  | { status: 'ok'; snapshot: DeviceLocationSnapshot }
  | { status: 'denied'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'timeout'; message: string }
  | { status: 'error'; message: string };

function webGeolocationSupported(): boolean {
  return Platform.OS === 'web' && typeof globalThis !== 'undefined' && 'geolocation' in globalThis.navigator;
}

async function loadExpoLocation() {
  return import('expo-location');
}

export async function readCachedDeviceLocation(): Promise<DeviceLocationSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeviceLocationSnapshot;
  } catch {
    return null;
  }
}

async function writeCachedDeviceLocation(snapshot: DeviceLocationSnapshot): Promise<void> {
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function getForegroundLocationPermission(): Promise<LocationPermissionState> {
  if (Platform.OS === 'web') {
    return webGeolocationSupported() ? 'undetermined' : 'unavailable';
  }
  try {
    const Location = await loadExpoLocation();
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) return 'granted';
    if (!perm.canAskAgain) return 'denied';
    return 'undetermined';
  } catch {
    return 'unavailable';
  }
}

export async function requestForegroundLocationPermission(): Promise<LocationPermissionState> {
  if (Platform.OS === 'web') {
    return webGeolocationSupported() ? 'undetermined' : 'unavailable';
  }
  try {
    const Location = await loadExpoLocation();
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.granted) return 'granted';
    if (!perm.canAskAgain) return 'denied';
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

async function readPositionWeb(): Promise<{ latitude: number; longitude: number; accuracy: number | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), POSITION_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        });
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: POSITION_TIMEOUT_MS },
    );
  });
}

async function readPositionNative(): Promise<{ latitude: number; longitude: number; accuracy: number | null }> {
  const Location = await loadExpoLocation();
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

/**
 * Foreground-only device fix. Never required for app access. Caches last successful snapshot locally.
 */
export async function refreshDeviceLocation(options?: { requestPermission?: boolean }): Promise<DeviceLocationResult> {
  try {
    if (Platform.OS === 'web') {
      if (!webGeolocationSupported()) {
        return { status: 'unavailable', message: 'Location is not available in this browser.' };
      }
    } else {
      let perm = await getForegroundLocationPermission();
      if (perm !== 'granted' && options?.requestPermission) {
        perm = await requestForegroundLocationPermission();
      }
      if (perm === 'denied') {
        return { status: 'denied', message: 'Location permission was denied. You can enter a ZIP code instead.' };
      }
      if (perm === 'unavailable') {
        return { status: 'unavailable', message: 'Location services are unavailable on this device.' };
      }
      if (perm !== 'granted') {
        return { status: 'denied', message: 'Allow location when prompted, or search by ZIP.' };
      }
    }

    await ensureExpoGeocodingProvider();

    const coords =
      Platform.OS === 'web'
        ? await readPositionWeb().catch((e) => {
            if (String(e?.message ?? e).includes('TIMEOUT')) throw new Error('TIMEOUT');
            throw e;
          })
        : await Promise.race([
            readPositionNative(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), POSITION_TIMEOUT_MS)),
          ]);

    const geo =
      (await reverseGeocodeCoordinates(coords.latitude, coords.longitude)) ??
      (await createExpoGeocodingProvider(() => import('expo-location')).reverseGeocode(coords.latitude, coords.longitude));

    const snapshot: DeviceLocationSnapshot = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      postalCode: geo?.postalCode && isZip5(geo.postalCode) ? geo.postalCode : null,
      city: geo?.city ?? null,
      region: geo?.region ?? null,
      capturedAt: new Date().toISOString(),
      accuracyMeters: coords.accuracy,
    };
    await writeCachedDeviceLocation(snapshot);
    return { status: 'ok', snapshot };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('TIMEOUT')) {
      return { status: 'timeout', message: 'Location took too long. Try again or enter a ZIP.' };
    }
    return { status: 'error', message: 'Could not read your location. Try ZIP search instead.' };
  }
}

export function deviceSnapshotZip(snapshot: DeviceLocationSnapshot | null | undefined): string | null {
  if (!snapshot?.postalCode || !isZip5(snapshot.postalCode)) return null;
  return snapshot.postalCode;
}
