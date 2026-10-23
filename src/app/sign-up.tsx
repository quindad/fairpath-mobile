import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { DevClientTestingHint } from '@/components/DevClientTestingHint';
import { FairBackButton } from '@/components/ProductChrome';
import { RegistrationLegalConsent } from '@/components/RegistrationLegalConsent';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { resolvePostAuthRoute } from '@/core/auth/post-auth-route';
import {
  clearRegistrationDraft,
  getRegistrationDraft,
  registrationDraftLegalReady,
  syncRegistrationDraftFromLegalSession,
} from '@/core/auth/registration-draft';
import { useRegistrationDraft } from '@/core/auth/use-registration-draft';
import { recordSignUpConsent } from '@/core/profile/consent-service';
const LIME = '#A8F32C';
const BLACK = '#090A09';
const CARD = '#151715';
const BORDER = '#303330';
const MUTED = '#909690';
const ERROR = '#FF8A8A';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : null;
  const signUpPath = useMemo(
    () => (returnTo ? `/sign-up?returnTo=${encodeURIComponent(returnTo)}` : '/sign-up'),
    [returnTo],
  );
  const { draft, patch } = useRegistrationDraft();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const flushDraft = useCallback(() => patch({ ...draft }), [draft, patch]);

  const legalReady = registrationDraftLegalReady(draft);

  function requireLegal() {
    syncRegistrationDraftFromLegalSession();
    if (!registrationDraftLegalReady(getRegistrationDraft())) {
      setErrorMessage('Read the Terms and Privacy Policy and agree to each before continuing.');
      return false;
    }
    setErrorMessage('');
    return true;
  }

  async function persistConsentAfterAccountCreated() {
    await recordSignUpConsent();
  }

  async function createAccount() {
    if (loading) return;
    syncRegistrationDraftFromLegalSession();
    const live = getRegistrationDraft();
    if (!registrationDraftLegalReady(live)) {
      setErrorMessage('Read the Terms and Privacy Policy and agree to each before creating your account.');
      return;
    }

    const cleanFirstName = live.firstName.trim();
    const cleanLastName = live.lastName.trim();
    const cleanEmail = live.email.trim().toLowerCase();

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !live.password) {
      setErrorMessage('Complete every field to create your FairPath account.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (live.password.length < 8) {
      setErrorMessage('Create a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const emailRedirectTo =
        Platform.OS === 'web' ? window.location.origin + '/auth/callback' : 'fairpathmobile://auth/callback';

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: live.password,
        options: {
          emailRedirectTo,
          data: {
            first_name: cleanFirstName,
            last_name: cleanLastName,
            account_type: 'member',
          },
        },
      });

      if (error) {
        const msg = error.message ?? '';
        setErrorMessage(
          /already registered|already exists/i.test(msg)
            ? 'That email already has a FairPath account. Sign in instead.'
            : msg || 'We could not create your account. Try again.',
        );
        return;
      }

      if (data.session) {
        try {
          await persistConsentAfterAccountCreated();
          clearRegistrationDraft();
        } catch {
          setErrorMessage('Account created, but we could not save your agreement. Finish registration on the next screen.');
          router.replace('/accept-terms' as never);
          return;
        }
        const dest = await resolvePostAuthRoute(returnTo);
        router.replace(dest as never);
        return;
      }

      clearRegistrationDraft();
      router.replace(('/check-email?email=' + encodeURIComponent(cleanEmail)) as never);
    } catch {
      setErrorMessage('We could not create your account right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <DevClientTestingHint />
        <FormScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FairBackButton
            onPress={() => router.replace((returnTo ? `/join?returnTo=${encodeURIComponent(returnTo)}` : '/join') as never)}
          />

          <Text style={styles.kicker}>CREATE ACCOUNT</Text>
          <Text style={styles.title}>Join with email</Text>
          <Text style={styles.subtitle}>Or use Apple or Google below. Legal agreement is required before we create your account.</Text>

          <View style={styles.socialBlock}>
            <SocialAuthButtons
              returnTo={returnTo}
              beforeStart={requireLegal}
              onSignedIn={async (r) => {
                if (!r.needsConsent) return;
                try {
                  await persistConsentAfterAccountCreated();
                  clearRegistrationDraft();
                  return { needsConsent: false };
                } catch {
                  setErrorMessage('Account connected, but we could not save your agreement. Use Complete registration on the next screen.');
                  return { needsConsent: true };
                }
              }}
            />
          </View>

          <Text style={styles.dividerLabel}>EMAIL SIGN UP</Text>

          <View style={styles.nameRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                value={draft.firstName}
                onChangeText={(v) => patch({ firstName: v })}
                placeholder="First name"
                placeholderTextColor="#666C66"
                autoCapitalize="words"
                autoComplete="given-name"
                style={styles.input}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Last name</Text>
              <TextInput
                value={draft.lastName}
                onChangeText={(v) => patch({ lastName: v })}
                placeholder="Last name"
                placeholderTextColor="#666C66"
                autoCapitalize="words"
                autoComplete="family-name"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={draft.email}
            onChangeText={(v) => patch({ email: v })}
            placeholder="you@email.com"
            placeholderTextColor="#666C66"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={draft.password}
            onChangeText={(v) => patch({ password: v })}
            placeholder="At least 8 characters"
            placeholderTextColor="#666C66"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            style={styles.input}
            onSubmitEditing={createAccount}
          />

          <Text style={styles.dividerLabel}>LEGAL AGREEMENT</Text>

          <RegistrationLegalConsent
            compact
            legalBackTo={signUpPath}
            agreedTerms={draft.agreedTerms}
            agreedPrivacy={draft.agreedPrivacy}
            onChangeAgreedTerms={(v) => patch({ agreedTerms: v })}
            onChangeAgreedPrivacy={(v) => patch({ agreedPrivacy: v })}
            onBeforeOpenDocument={flushDraft}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Creating account' : 'Create account'}
            style={[styles.primaryButton, (loading || !legalReady) && styles.primaryButtonDisabled]}
            onPress={createAccount}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Creating account…' : 'Create account'}</Text>
            <Text style={styles.arrow}>{loading ? '•' : '→'}</Text>
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginMuted}>Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={() => router.replace(returnTo ? ('/sign-in?returnTo=' + encodeURIComponent(returnTo)) as never : '/sign-in')}
            >
              <Text style={styles.loginLink}> Sign in</Text>
            </Pressable>
          </View>
        </FormScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: __DEV__ ? 88 : 36 },
  kicker: { color: LIME, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 16 },
  title: { color: '#F7F8F6', fontSize: 28, lineHeight: 32, fontWeight: '800', marginTop: 8 },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 4 },
  socialBlock: { marginTop: 4, marginBottom: 4 },
  dividerLabel: { color: LIME, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 12, marginBottom: 8 },
  nameRow: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  label: { color: '#D7DAD6', fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    color: '#F7F8F6',
    fontSize: 15,
    paddingHorizontal: 14,
  },
  errorText: { color: ERROR, fontSize: 12, lineHeight: 17, marginTop: 8 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: LIME,
    paddingHorizontal: 18,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: BLACK, fontSize: 16, fontWeight: '800' },
  arrow: { color: BLACK, fontSize: 22 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingBottom: 8 },
  loginMuted: { color: '#777D77', fontSize: 13 },
  loginLink: { color: LIME, fontSize: 13, fontWeight: '800' },
});
