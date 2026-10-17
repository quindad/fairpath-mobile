import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/core/profile/consent-service';
import { parseRecoveryRedirect } from '@/core/auth/password-recovery';

/** Native deep link for email verification is fairpathmobile://auth/callback -- only trust that exact shape. */
function isTrustedNativeAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'fairpathmobile:' && parsed.hostname === 'auth' && (parsed.pathname === '/callback' || parsed.pathname === 'callback');
  } catch {
    return false;
  }
}

const LIME = '#A8F32C';
const BLACK = '#090A09';
const MUTED = '#909690';
const ERROR = '#FF8A8A';

type VerificationState = 'loading' | 'success' | 'error';

export default function AuthCallbackScreen() {
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Verifying your FairPath account…');

  useEffect(() => {
    let active = true;

    async function checkDocumentConsent() {
      const { data: identity, error: identityError } = await supabase.auth.getUser();
      if (identityError || !identity.user) throw identityError ?? new Error('Account not available');
      const { data, error } = await supabase.from('profiles')
        .select('terms_accepted_at,terms_accepted_version,privacy_accepted_at,privacy_accepted_version')
        .eq('id', identity.user.id).maybeSingle();
      if (error) throw error;
      if (!data || !data.terms_accepted_at || !data.privacy_accepted_at ||
          data.terms_accepted_version !== CURRENT_TERMS_VERSION ||
          data.privacy_accepted_version !== CURRENT_PRIVACY_VERSION) {
        if (active) {
          setState('success');
          setMessage('Account verified. Please review and accept the current Terms and Privacy Policy.');
        }
        return false;
      }
      return true;
    }
    async function afterSessionEstablished() {
      if (!(await checkDocumentConsent())) { if (active) router.replace('/accept-terms' as never); return; }
      if (active) {
        setState('success');
        setMessage('Email verified. Your FairPath account is ready.');
      }
    }

    async function finishVerificationWeb() {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const authError = params.get('error');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      if (authError || errorCode) {
        if (!active) return;
        setState('error');
        setMessage(
          errorCode === 'otp_expired'
            ? 'This verification link is invalid or has expired. Return to FairPath and request a new verification email.'
            : errorDescription?.replace(/\+/g, ' ') ||
                'We could not verify this email. Return to FairPath and try again.'
        );
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!active) return;
        if (error) {
          setState('error');
          setMessage('We could not finish verification. Return to FairPath and try again.');
          return;
        }
        await afterSessionEstablished();
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setState('error');
        setMessage('We could not finish verification. Return to FairPath and try again.');
        return;
      }
      if (data.session) { await afterSessionEstablished(); return; }
      setState('error');
      setMessage('We could not confirm this verification link. Return to FairPath and try again.');
    }

    async function finishVerificationNative(url: string | null) {
      if (!url || !isTrustedNativeAuthCallback(url)) {
        // Not our deep link (e.g. the app's cold-start URL) -- fall back to any session that already exists.
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) { await afterSessionEstablished(); return; }
        return;
      }

      const parsed = parseRecoveryRedirect(url);
      if (parsed.error) {
        if (!active) return;
        setState('error');
        setMessage('This verification link is invalid or has expired. Return to FairPath and request a new verification email.');
        return;
      }

      const result = parsed.code
        ? await supabase.auth.exchangeCodeForSession(parsed.code)
        : parsed.accessToken && parsed.refreshToken
          ? await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken })
          : null;

      if (!active) return;
      if (!result) {
        setState('error');
        setMessage('We could not confirm this verification link. Return to FairPath and try again.');
        return;
      }
      if (result.error || !result.data.session) {
        setState('error');
        setMessage('We could not finish verification. Return to FairPath and try again.');
        return;
      }
      await afterSessionEstablished();
    }

    if (Platform.OS === 'web') {
      void finishVerificationWeb().catch(() => { if (active) { setState('error'); setMessage('Could not verify your current consent status. Please try again.'); } });
      return () => { active = false; };
    }

    void Linking.getInitialURL().then((url) => finishVerificationNative(url)).catch(() => { if (active) { setState('error'); setMessage('Could not verify your current consent status. Please try again.'); } });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void finishVerificationNative(url).catch(() => { if (active) { setState('error'); setMessage('Could not verify your current consent status. Please try again.'); } });
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const isError = state === 'error';
  const isSuccess = state === 'success';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={[styles.icon, isError && styles.errorIcon]}>
            <Text style={styles.iconText}>{isError ? '!' : isSuccess ? '✓' : '•'}</Text>
          </View>
          <Text style={styles.kicker}>FAIRPATH ACCOUNT</Text>
          <Text style={styles.title}>
            {isError ? 'Verification issue.' : isSuccess ? 'You’re verified.' : 'Verifying…'}
          </Text>
          <Text style={[styles.message, isError && styles.error]}>{message}</Text>
          <Text style={styles.note}>
            {isError
              ? 'Your account will not be treated as verified until FairPath receives a valid confirmation.'
              : isSuccess
                ? 'Your verification was confirmed successfully.'
                : 'Keep this page open while FairPath checks the verification result.'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  errorIcon: { backgroundColor: ERROR },
  iconText: { color: BLACK, fontSize: 30, fontWeight: '900' },
  kicker: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 14 },
  title: { color: '#F7F8F6', fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.8 },
  message: { color: MUTED, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 500 },
  error: { color: ERROR },
  note: { color: '#6F756F', fontSize: 12, lineHeight: 18, marginTop: 22, maxWidth: 500 },
});