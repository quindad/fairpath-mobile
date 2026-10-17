import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Dev/prod separation (Step 0 Foundation item 5): read from env when
// present, so a different Supabase project can be targeted per
// environment via EAS/CI config without a code change. EXPO_PUBLIC_*
// vars are inlined at build time by Expo and are safe to ship to the
// client — this is the anon/publishable key, not a secret.
const PRODUCTION_PROJECT_REF = 'rqpczemdagoddhuwefxt';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const envKeyIsPlaceholder = !envKey || envKey.startsWith('<');

// Every build must name its target explicitly. This prevents a missing EAS
// environment variable from silently connecting a release to production.
if (!envUrl || envKeyIsPlaceholder) {
  throw new Error(
    'FairPath configuration error: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY must be set for this build.',
  );
}

const supabaseUrl = envUrl;
const supabasePublishableKey = envKey;

if (__DEV__) {
  const isProduction = supabaseUrl.includes(PRODUCTION_PROJECT_REF);
  // eslint-disable-next-line no-console
  (isProduction ? console.error : console.info)(
    isProduction
      ? '[supabase] !!! DEVELOPMENT BUILD IS POINTED AT THE PRODUCTION PROJECT (' + supabaseUrl + ') — writes here are REAL. !!!'
      : '[supabase] development build using ' + supabaseUrl,
  );
}

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
