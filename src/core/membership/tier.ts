// Client-side tier resolution. Prefers the server's my_fairpath_tier() RPC (proposed in
// docs/proposed-migrations/20261020100000_three_tier_entitlements_and_ai_credits_DRAFT.sql, not yet applied).
// Until that migration ships, the RPC does not exist, and this module MUST NOT invent 'premium' from nothing —
// it falls back to the existing boolean my_fairpath_plus_status() and treats an active member as 'plus', the
// honest ceiling that status can prove. Pure logic lives in tier-pure.ts so it is testable under plain Node.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadPlusStatus } from './plus-access';
import { parseTierResponse, mapPlusStatusToTier, type TierInfo } from './tier-pure';
import type { TierId } from './frozen-v1';

export { parseTierResponse, mapPlusStatusToTier, type TierInfo } from './tier-pure';

export async function loadTier(): Promise<TierInfo> {
  const { data, error } = await supabase.rpc('my_fairpath_tier');
  if (!error) {
    const parsed = parseTierResponse(data);
    if (parsed) return { tier: parsed, source: 'tier_rpc' };
  }
  const status = await loadPlusStatus();
  return { tier: mapPlusStatusToTier(status.active), source: 'plus_status_fallback' };
}

export function useTier(): { tier: TierId; loading: boolean; source: TierInfo['source'] | null } {
  const [tier, setTier] = useState<TierId>('free');
  const [source, setSource] = useState<TierInfo['source'] | null>(null);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      loadTier()
        .then((info) => { if (active) { setTier(info.tier); setSource(info.source); } })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );
  return { tier, loading, source };
}
