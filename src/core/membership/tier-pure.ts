// Pure tier logic, no imports, so it can run under plain Node for tests (matches every other core module's pattern).
// tier.ts (the app-facing module) wraps this with the actual Supabase call and a React hook.
import type { TierId } from './frozen-v1.ts';

export type TierInfo = { tier: TierId; source: 'tier_rpc' | 'plus_status_fallback' };

const VALID_TIERS: readonly TierId[] = ['free', 'plus', 'premium'];

/** Validates an untrusted RPC payload. Anything not exactly {tier: 'free'|'plus'|'premium', ...} is rejected. */
export function parseTierResponse(data: unknown): TierId | null {
  if (!data || typeof data !== 'object') return null;
  const tier = (data as Record<string, unknown>).tier;
  return typeof tier === 'string' && (VALID_TIERS as readonly string[]).includes(tier) ? (tier as TierId) : null;
}

/** The only place allowed to turn "has FairPath+" into a tier. Always 'plus', never 'premium'. */
export function mapPlusStatusToTier(active: boolean): TierId {
  return active ? 'plus' : 'free';
}
