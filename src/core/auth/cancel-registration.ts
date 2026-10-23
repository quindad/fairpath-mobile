import { router } from 'expo-router';
import { resetLegalReviewSession } from '@/core/legal/legal-review-session';
import { supabase } from '@/lib/supabase';

/** Leaves the member signed out on this device; does not delete the auth account. */
export async function cancelRegistrationAndExit() {
  resetLegalReviewSession();
  await supabase.auth.signOut();
  router.replace('/' as never);
}
