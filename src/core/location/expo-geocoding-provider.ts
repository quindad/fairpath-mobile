import type { GeocodeResult, GeocodingProvider } from '@/core/location/geocoding-provider.ts';

function mapRow(row: {
  latitude?: number;
  longitude?: number;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
}, coordinates?: { latitude: number; longitude: number }): GeocodeResult | null {
  const latitude = row.latitude ?? coordinates?.latitude;
  const longitude = row.longitude ?? coordinates?.longitude;
  if (latitude == null || longitude == null) return null;
  return {
    latitude,
    longitude,
    postalCode: row.postalCode ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
  };
}

export function createExpoGeocodingProvider(loadLocation: () => Promise<typeof import('expo-location')>): GeocodingProvider {
  return {
    async reverseGeocode(latitude, longitude) {
      const Location = await loadLocation();
      const rows = await Location.reverseGeocodeAsync({ latitude, longitude });
      return rows[0] ? mapRow(rows[0], { latitude, longitude }) : null;
    },
    async geocodeAddress(address) {
      const Location = await loadLocation();
      const rows = await Location.geocodeAsync(address);
      return rows[0] ? mapRow(rows[0]) : null;
    },
  };
}

/** Registers expo-location geocoding when the native module is available. */
export async function ensureExpoGeocodingProvider(): Promise<void> {
  const { setGeocodingProvider } = await import('@/core/location/geocoding-provider.ts');
  setGeocodingProvider(
    createExpoGeocodingProvider(() => import('expo-location')),
  );
}
