import { supabase } from '@/lib/supabase';

/**
 * Server-backed feature flags (supabase/migrations/20260924_0001_feature_flags.sql).
 *
 * Fetched once per app session and cached in memory — flags gate whether a
 * module is visible, not per-render behavior, so a session-lifetime cache
 * is the right tradeoff over a live read on every check.
 *
 * Deliberately NOT wired into any screen yet. Foundation ships the
 * infrastructure only; deciding what to gate (e.g. Marketplace's nav
 * exposure) is a product/UI decision left to whichever pass owns that
 * screen, so this change carries zero behavior risk.
 */

export type FeatureFlagKey =
  | 'marketplace_enabled'
  | 'fairpath_ai_enabled'
  | 'credit_builder_enabled'
  | 'record_relief_enabled'
  | (string & {});

type FlagRow = { key: string; enabled: boolean; rollout_percent: number };

let cache: Record<string, FlagRow> | null = null;
let inflight: Promise<Record<string, FlagRow>> | null = null;

async function fetchFlags(): Promise<Record<string, FlagRow>> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key,enabled,rollout_percent');
  if (error) throw error;
  const byKey: Record<string, FlagRow> = {};
  for (const row of (data ?? []) as FlagRow[]) byKey[row.key] = row;
  return byKey;
}

/** Loads (and caches) all flags. Call once near app start; safe to call more than once. */
export async function loadFeatureFlags(): Promise<Record<string, FlagRow>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetchFlags()
      .then((flags) => {
        cache = flags;
        return flags;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Synchronous check against whatever is currently cached. Returns
 * `fallback` (default false) if flags haven't loaded yet — callers that
 * need a guaranteed-fresh read should `await loadFeatureFlags()` first.
 */
export function isFeatureEnabled(key: FeatureFlagKey, fallback = false): boolean {
  return cache?.[key]?.enabled ?? fallback;
}

/** Clears the in-memory cache (e.g. after sign-out) so the next check re-fetches. */
export function resetFeatureFlagCache() {
  cache = null;
  inflight = null;
}
