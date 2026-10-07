// Provider adapter contract. Every source, official API or curated list, implements this interface. Adapters never write to
// the catalog directly: they return normalized candidates, and the ingestion service decides what to upsert, mark stale or withdraw.
// No adapter may scrape a site whose terms do not permit it. An adapter with no permitted access reports 'no_access'.

import type { CanonicalCourse, SourceKind } from './catalog-contract.ts';

export type ProviderTerms = {
  providerId: string;
  displayName: string;
  sourceKind: SourceKind;
  /** Written permission reference, or null when none exists. Null blocks live fetching. */
  permissionReference: string | null;
  allowsExternalLinking: boolean;
  allowsEmbeddedContent: boolean;
  attributionRequired: string;
  /** Minimum minutes between fetches. Hourly (60) only where terms permit. */
  minRefreshMinutes: number;
  maxRequestsPerHour: number;
  retentionDays: number;
};

export type AdapterStatus = 'ok' | 'no_access' | 'rate_limited' | 'error' | 'fixture';

export type FetchResult = {
  status: AdapterStatus;
  courses: CanonicalCourse[];
  nextCursor: string | null;
  errorCode: string | null; // sanitized: never includes a secret or response body
};

export interface ProviderAdapter {
  readonly terms: ProviderTerms;
  fetchPage(cursor: string | null): Promise<FetchResult>;
}

/** Decides whether an adapter may be called at all right now. Enforces terms before any network call. */
export function mayFetch(terms: ProviderTerms, lastFetchedAtMs: number | null, nowMs: number): { ok: true } | { ok: false; reason: 'no_permission' | 'too_soon' } {
  if (terms.permissionReference === null) return { ok: false, reason: 'no_permission' };
  if (lastFetchedAtMs !== null && nowMs - lastFetchedAtMs < terms.minRefreshMinutes * 60_000) {
    return { ok: false, reason: 'too_soon' };
  }
  return { ok: true };
}

/** Hourly refresh is available only where the provider's minimum allows it. */
export function nextAllowedFetchMs(terms: ProviderTerms, lastFetchedAtMs: number): number {
  return lastFetchedAtMs + terms.minRefreshMinutes * 60_000;
}
