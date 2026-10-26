/**
 * Geocoding abstraction — default implementation uses expo-location (no API key on device).
 * Server-side providers can be added later for autocomplete/places without exposing keys in the client.
 */
export type GeocodeResult = {
  latitude: number;
  longitude: number;
  postalCode: string | null;
  city: string | null;
  region: string | null;
};

export type GeocodingProvider = {
  reverseGeocode: (latitude: number, longitude: number) => Promise<GeocodeResult | null>;
  geocodeAddress: (address: string) => Promise<GeocodeResult | null>;
};

let provider: GeocodingProvider | null = null;

export function setGeocodingProvider(next: GeocodingProvider | null) {
  provider = next;
}

export async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  if (!provider) return null;
  return provider.reverseGeocode(latitude, longitude);
}

export async function geocodeAddressString(address: string): Promise<GeocodeResult | null> {
  if (!provider) return null;
  return provider.geocodeAddress(address);
}
