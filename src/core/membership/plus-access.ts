import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { NO_PLUS, hasFeature, type PlusFeature, type PlusStatus } from '@/core/membership/plus-status';

export * from '@/core/membership/plus-status';

/**
 * Central FairPath+ access service. Screens ask "does this member have FairPath+ / this feature?" here and never
 * calculate dates or inspect provider fields. The answer comes from the server (my_fairpath_plus_status), which
 * evaluates expiry itself. Signed-out or failed reads return NO_PLUS: the app fails closed for gating (the
 * server, not this file, is what actually protects paid capabilities).
 */
export async function loadPlusStatus(): Promise<PlusStatus> {
  const { data, error } = await supabase.rpc('my_fairpath_plus_status');
  if (error || !data) return NO_PLUS;
  return data as PlusStatus;
}

export async function memberHasFeature(feature: PlusFeature): Promise<boolean> {
  return hasFeature(await loadPlusStatus(), feature);
}

export function usePlusStatus(): { status: PlusStatus; loading: boolean; reload: () => void } {
  const [status, setStatus] = useState<PlusStatus>(NO_PLUS);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    loadPlusStatus().then((s) => { if (active) setStatus(s); }).catch(() => { if (active) setStatus(NO_PLUS); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [nonce]));
  return { status, loading, reload: () => setNonce((n) => n + 1) };
}
