import { supabase } from '@/lib/supabase';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/core/profile/consent-service';

/**
 * Where a signed-in user should land right now: mid-onboarding users (closed the app after verifying email but
 * before accepting terms or finishing onboarding) must be sent back to finish, not dropped straight into /home.
 * Returns null if there is no signed-in user.
 */
export async function resolveNextRouteForSignedInUser(): Promise<string | null> {
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) return null;
  const { data: profile } = await supabase.from('profiles')
    .select('terms_accepted_at,terms_accepted_version,privacy_accepted_at,privacy_accepted_version,onboarding_completed')
    .eq('id', identity.user.id).maybeSingle();
  const consentOk = Boolean(
    profile?.terms_accepted_at && profile?.privacy_accepted_at &&
    profile.terms_accepted_version === CURRENT_TERMS_VERSION && profile.privacy_accepted_version === CURRENT_PRIVACY_VERSION
  );
  if (!consentOk) return '/accept-terms';
  if (!profile?.onboarding_completed) return '/onboarding';
  return '/home';
}
