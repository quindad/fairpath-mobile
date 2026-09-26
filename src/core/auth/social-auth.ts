import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { parseAuthRedirect } from '@/core/auth/auth-redirect';

/**
 * Social sign-in (Apple, Google) through Supabase Auth.
 *
 * Identity model (unchanged): auth.users.id IS the FairPath account. public.profiles.id is that same id
 * (primary key + the handle_new_user trigger), so a provider sign-in can only ever resolve to exactly one
 * profile row. This file never creates a profile, never sends a user id, and never merges accounts. If the
 * provider email matches an existing account, whether the identities link is decided by Supabase's own
 * (verified-email) linking rules configured in the dashboard, not by client code.
 *
 * Nothing here fakes a session: success means Supabase issued one.
 */
WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'apple' | 'google';
export type SocialAuthResult =
  | { status: 'success'; needsConsent: boolean; onboardingCompleted: boolean }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const NETWORK_MESSAGE = 'We could not sign you in right now. Check your connection and try again.';

/** Loads the profile the database trigger created for this auth user. Never creates one client-side. */
async function resolveProfile(names?: { first?: string | null; last?: string | null }): Promise<SocialAuthResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Sign-in did not produce a session. Please try again.' };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('onboarding_completed,terms_accepted_at,first_name,last_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !profile) {
    return { status: 'error', message: 'You are signed in, but FairPath could not load your profile. Please try again.' };
  }

  // Apple only returns a name on the FIRST authorization, and users may hide it. Fill blanks only; never overwrite.
  if (names && (names.first || names.last) && !profile.first_name && !profile.last_name) {
    await supabase.from('profiles').update({ first_name: names.first ?? null, last_name: names.last ?? null }).eq('id', user.id);
  }

  return {
    status: 'success',
    needsConsent: !profile.terms_accepted_at,
    onboardingCompleted: Boolean(profile.onboarding_completed),
  };
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const Apple = await import('expo-apple-authentication');
    return await Apple.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Native Sign in with Apple -> Supabase signInWithIdToken (nonce-bound). */
export async function signInWithApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios') return { status: 'error', message: 'Sign in with Apple is available on iPhone and iPad.' };
  try {
    const Apple = await import('expo-apple-authentication');
    const Crypto = await import('expo-crypto');
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { status: 'error', message: 'Apple did not return an identity token. Please try again.' };

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error) return { status: 'error', message: friendlyProviderError(error.message, 'Apple') };

    return await resolveProfile({ first: credential.fullName?.givenName, last: credential.fullName?.familyName });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return { status: 'cancelled' };
    return { status: 'error', message: NETWORK_MESSAGE };
  }
}

/** Supabase OAuth in the system browser (expo-web-browser) with a deep-link return. */
export async function signInWithGoogle(): Promise<SocialAuthResult> {
  try {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data?.url) return { status: 'error', message: 'Google sign-in is not available right now.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { status: 'cancelled' };

    const parsed = parseAuthRedirect(result.url);
    if (parsed.error) return { status: 'error', message: friendlyProviderError(parsed.error, 'Google') };
    if (!parsed.accessToken || !parsed.refreshToken) return { status: 'error', message: 'Google did not complete sign-in. Please try again.' };

    const { error: sessionError } = await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
    if (sessionError) return { status: 'error', message: friendlyProviderError(sessionError.message, 'Google') };
    return await resolveProfile();
  } catch {
    return { status: 'error', message: NETWORK_MESSAGE };
  }
}

function friendlyProviderError(message: string, provider: string) {
  if (/provider is not enabled|unsupported provider/i.test(message)) return `${provider} sign-in has not been enabled for this FairPath environment yet.`;
  if (/nonce|audience|id token/i.test(message)) return `${provider} sign-in could not be verified. Please try again.`;
  return message || NETWORK_MESSAGE;
}

/** Where to go after a successful social sign-in. */
export function routeAfterSocialSignIn(result: Extract<SocialAuthResult, { status: 'success' }>, returnTo: string | null): string {
  if (result.needsConsent) return '/accept-terms' + (returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : '');
  if (!result.onboardingCompleted) return '/onboarding';
  return returnTo ?? '/find-jobs';
}
