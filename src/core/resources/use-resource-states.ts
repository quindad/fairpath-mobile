import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSignedIn,
  loadResourceStates,
  resourceActionMessage,
  saveResource,
  unsaveResource,
  type ResourceMemberState,
} from '@/core/resources/resources-service';
import { notify } from '@/core/ui/notify';

/**
 * Saved / progress flags for the resources currently on screen. Guests get an empty map and are sent to sign in
 * (with a return path) when they try to save; members get optimistic saves that roll back on failure.
 */
export function useResourceMemberState(returnTo: string) {
  const [states, setStates] = useState<Record<string, ResourceMemberState>>({});
  const signedIn = useRef<boolean | null>(null);

  const ensureSignedIn = useCallback(async () => {
    if (signedIn.current === null) signedIn.current = await isSignedIn();
    return signedIn.current;
  }, []);

  useEffect(() => {
    void ensureSignedIn();
  }, [ensureSignedIn]);

  const refresh = useCallback(async (ids: string[]) => {
    if (!ids.length || !(await ensureSignedIn())) return;
    try {
      const next = await loadResourceStates(ids);
      setStates((cur) => ({ ...cur, ...next }));
    } catch {
      // Saved flags are a convenience; search itself never depends on them.
    }
  }, [ensureSignedIn]);

  const toggleSave = useCallback(async (id: string) => {
    if (!(await ensureSignedIn())) {
      router.push(('/sign-in?returnTo=' + encodeURIComponent(returnTo)) as never);
      return;
    }
    const was = states[id]?.is_saved ?? false;
    setStates((cur) => ({ ...cur, [id]: { progress: cur[id]?.progress ?? null, is_saved: !was } }));
    try {
      if (was) await unsaveResource(id);
      else await saveResource(id);
    } catch (e) {
      setStates((cur) => ({ ...cur, [id]: { progress: cur[id]?.progress ?? null, is_saved: was } }));
      notify('Could not update saved resources', resourceActionMessage(e));
    }
  }, [ensureSignedIn, returnTo, states]);

  return { states, refresh, toggleSave };
}
