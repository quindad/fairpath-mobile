import { supabase } from '@/lib/supabase';
import { applyPostAuthReturnTo } from '@/core/auth/post-auth-return-to';
import { hasCurrentDocumentConsent } from '@/core/profile/consent-status';

export { applyPostAuthReturnTo } from '@/core/auth/post-auth-return-to';

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
  const consentOk = await hasCurrentDocumentConsent(identity.user.id, profile);
  if (!consentOk) return '/accept-terms';
  if (!profile?.onboarding_completed) return '/onboarding';
  return '/home';
}

/** After email/password or OAuth sign-in — honors returnTo only when terms + onboarding are complete. */
export async function resolvePostAuthRoute(returnTo?: string | null): Promise<string> {
  const next = await resolveNextRouteForSignedInUser();
  if (!next) return '/sign-in';
  return applyPostAuthReturnTo(next, returnTo);
}
