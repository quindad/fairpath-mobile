import { DEFAULT_SEARCH_RADIUS_MILES } from './constants.ts';

export type SearchLocationSource = 'profile' | 'device' | 'manual' | 'none';

export type ResolvedSearchLocation = {
  zip: string | null;
  radiusMiles: number;
  source: SearchLocationSource;
};

const WORD_MILES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  twentyfive: 25,
  fifty: 50,
};

/** Parse "within 5 miles" / "10 mi" from a member question (Signal or search). */
export function parseRadiusMilesFromNaturalLanguage(text: string): number | null {
  const t = text.toLowerCase();
  const numeric = t.match(/\b(\d{1,3})\s*(?:mile|miles|mi)\b/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n)) return clampRadius(n);
  }
  const word = t.match(/\b(within|under|about)\s+(one|two|three|four|five|ten|fifteen|twenty|twenty-five|twentyfive|fifty)\s+(?:mile|miles|mi)\b/);
  if (word) {
    const key = word[2].replace('-', '') as keyof typeof WORD_MILES;
    if (WORD_MILES[key]) return clampRadius(WORD_MILES[key]);
  }
  return null;
}

export function clampRadius(miles: number): number {
  return Math.min(100, Math.max(1, Math.round(miles)));
}

export function isZip5(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{5}$/.test(value.trim());
}

export function chooseSearchZip(input: {
  profileZip?: string | null;
  deviceZip?: string | null;
  manualZip?: string | null;
}): { zip: string | null; source: SearchLocationSource } {
  if (isZip5(input.manualZip)) return { zip: input.manualZip.trim(), source: 'manual' };
  if (isZip5(input.profileZip)) return { zip: input.profileZip.trim(), source: 'profile' };
  if (isZip5(input.deviceZip)) return { zip: input.deviceZip.trim(), source: 'device' };
  return { zip: null, source: 'none' };
}

export function mergeSearchRadius(
  profileRadius: number | undefined,
  parsedFromQuery: number | null,
  fallback = DEFAULT_SEARCH_RADIUS_MILES,
): number {
  if (parsedFromQuery != null) return clampRadius(parsedFromQuery);
  if (profileRadius != null && Number.isFinite(profileRadius)) return clampRadius(profileRadius);
  return clampRadius(fallback);
}

export function resolveSearchLocation(input: {
  profileZip?: string | null;
  profileRadius?: number;
  deviceZip?: string | null;
  manualZip?: string | null;
  queryText?: string;
}): ResolvedSearchLocation {
  const picked = chooseSearchZip(input);
  const radiusMiles = mergeSearchRadius(
    input.profileRadius,
    input.queryText ? parseRadiusMilesFromNaturalLanguage(input.queryText) : null,
  );
  return { zip: picked.zip, radiusMiles, source: picked.source };
}
