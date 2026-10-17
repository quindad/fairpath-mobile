export type CoordinateLike = { latitude?: number | null; longitude?: number | null };

/** Rejects missing, non-finite and out-of-world coordinates before they reach a native or web map. */
export function hasValidCoordinates(value: CoordinateLike): boolean {
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  return value.latitude != null && value.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function mappableOnly<T extends CoordinateLike>(values: T[]): T[] {
  return values.filter(hasValidCoordinates);
}
