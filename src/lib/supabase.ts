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
const PRODUCTION_PROJECT_REF = 'rqpczemdagoddhuwefxt';
const PRODUCTION_URL_FALLBACK = 'https://rqpczemdagoddhuwefxt.supabase.co';
const PRODUCTION_KEY_FALLBACK = 'sb_publishable_zPBzvXj7eVASZo20n3nIOg_4JBdeug_';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const envKeyIsPlaceholder = !envKey || envKey.startsWith('<');

// Environment safety: a development bundle must NEVER silently talk to the
// production project. Two separate Supabase projects exist —
// fairpath-mobile (production) and fairpath-mobile-dev — and local dev must
// select the dev one explicitly via .env.local.
if (__DEV__ && (!envUrl || envKeyIsPlaceholder)) {
  throw new Error(
    'FairPath dev safety stop: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Refusing to fall back to the PRODUCTION Supabase project in a development build. ' +
      'Copy .env.example to .env.local and fill in the fairpath-mobile-dev URL and anon key, then restart Expo with: expo start -c',
  );
}

// Release builds keep their existing behavior (production defaults) unless
// EAS/CI provides explicit values.
const supabaseUrl = envUrl || PRODUCTION_URL_FALLBACK;
const supabasePublishableKey = envKeyIsPlaceholder ? PRODUCTION_KEY_FALLBACK : (envKey as string);

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
