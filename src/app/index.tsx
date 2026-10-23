import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FairPathColors as C } from '@/constants/fairpath';
import { hasCompletedAppIntro } from '@/core/onboarding/app-intro-storage';
import { resolveNextRouteForSignedInUser } from '@/core/auth/post-auth-route';
import { supabase } from '@/lib/supabase';

/** Launch router: signed-in members → workspace; guests → product intro once, then Join. */
export default function LaunchRouter() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        if (data.user) {
          const next = await resolveNextRouteForSignedInUser();
          router.replace((next ?? '/home') as never);
          return;
        }
        const introDone = await hasCompletedAppIntro();
        if (!active) return;
        router.replace((introDone ? '/join' : '/intro') as never);
      } catch {
        if (active) router.replace('/intro' as never);
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (booting) return <View style={s.screen} />;
  return <View style={s.screen} />;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: C.black } });
