import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { FairBackButton } from '@/components/ProductChrome';
import { RegistrationLegalConsent } from '@/components/RegistrationLegalConsent';
import { registrationDraftLegalReady } from '@/core/auth/registration-draft';
import { hasAgreedLegalDocument } from '@/core/legal/legal-review-session';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { cancelRegistrationAndExit } from '@/core/auth/cancel-registration';
import { resolvePostAuthRoute } from '@/core/auth/post-auth-route';
import { acceptTermsScreenCopy, registrationConsentContext, type RegistrationConsentContext } from '@/core/auth/registration-flow';
import { recordSignUpConsent } from '@/core/profile/consent-service';
import { supabase } from '@/lib/supabase';

/**
 * Authenticated members who still owe current Terms + Privacy (social sign-in without sign-up form, email
 * verification, consent save retry, or legal version renewal). Not shown when consent is already current.
 */
export default function AcceptTerms() {
  const params = useLocalSearchParams<{ returnTo?: string; flow?: string }>();
  const returnTo = typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : null;
  const acceptPath = returnTo ? `/accept-terms?returnTo=${encodeURIComponent(returnTo)}` : '/accept-terms';
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [context, setContext] = useState<RegistrationConsentContext>(
    params.flow === 'renewal' ? 'renewal' : 'registration',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('terms_accepted_at,privacy_accepted_at')
        .eq('id', data.user.id)
        .maybeSingle();
      if (active) setContext(registrationConsentContext(profile));
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (hasAgreedLegalDocument('terms')) setAgreedTerms(true);
      if (hasAgreedLegalDocument('privacy')) setAgreedPrivacy(true);
    }, []),
  );

  const copy = acceptTermsScreenCopy(context);
  const ready = registrationDraftLegalReady({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    agreedTerms,
    agreedPrivacy,
  });

  async function accept() {
    if (!ready || saving) return;
    setSaving(true);
    setError('');
    try {
      await recordSignUpConsent();
      const dest = await resolvePostAuthRoute(returnTo);
      router.replace(dest as never);
    } catch {
      setError('We could not save your agreement. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe}>
        <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
          <FairBackButton label={copy.cancelLabel} onPress={() => void cancelRegistrationAndExit()} />
          <Text style={s.kicker}>{copy.kicker}</Text>
          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.body}>{copy.body}</Text>
          <RegistrationLegalConsent
            legalBackTo={acceptPath}
            agreedTerms={agreedTerms}
            agreedPrivacy={agreedPrivacy}
            onChangeAgreedTerms={setAgreedTerms}
            onChangeAgreedPrivacy={setAgreedPrivacy}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={[s.primary, !ready && s.primaryOff]} disabled={!ready || saving} onPress={() => void accept()}>
            <Text style={[s.primaryText, !ready && s.primaryTextOff]}>{saving ? 'Saving…' : copy.primary}</Text>
            <Text style={[s.primaryText, !ready && s.primaryTextOff]}>→</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={s.secondary} onPress={() => void cancelRegistrationAndExit()}>
            <Text style={s.secondaryText}>{copy.cancelLabel}</Text>
          </Pressable>
          <Text style={s.cancelHint}>{copy.cancelHint}</Text>
        </FormScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  safe: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { padding: L.mobileGutter, paddingTop: 12, paddingBottom: 40 },
  kicker: { color: C.lime, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.6, marginTop: 24 },
  title: { color: C.white, fontFamily: F.black, fontSize: 32, lineHeight: 34, marginTop: 10 },
  body: { color: C.mutedStrong, fontSize: 14, lineHeight: 21, marginTop: 14 },
  error: { color: '#FF8A8A', fontSize: 12, marginTop: 10 },
  primary: { height: 52, backgroundColor: C.lime, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  primaryOff: { backgroundColor: '#1A2114', borderWidth: 1, borderColor: '#2C3823' },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.6 },
  primaryTextOff: { color: C.mutedStrong },
  secondary: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: C.mutedStrong, fontFamily: F.bold, fontSize: 12 },
  cancelHint: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
});
