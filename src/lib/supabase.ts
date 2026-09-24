import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Dev/prod separation (Step 0 Foundation item 5): read from env when
// present, so a different Supabase project can be targeted per
// environment via EAS/CI config without a code change. Falls back to
// the existing project's values so local dev and this repo's current
// tests keep working unchanged if no .env is present. EXPO_PUBLIC_*
// vars are inlined at build time by Expo and are safe to ship to the
// client — this is the anon/publishable key, not a secret.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://rqpczemdagoddhuwefxt.supabase.co';
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_zPBzvXj7eVASZo20n3nIOg_4JBdeug_';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
