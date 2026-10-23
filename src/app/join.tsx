import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { FairPathLogo } from '@/components/FairPathLogo';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { memberGateMessage, type MemberGateReason } from '@/core/auth/member-access';
import { clearRegistrationDraft } from '@/core/auth/registration-draft';
import { useEffect } from 'react';

export default function JoinFairPathScreen() {
  const params = useLocalSearchParams<{ returnTo?: string; reason?: string }>();
  const returnTo = typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : null;
  const reasonParam = typeof params.reason === 'string' ? params.reason : '';
  const gateMessage =
    reasonParam === 'apply' || reasonParam === 'save' || reasonParam === 'message' || reasonParam === 'member_feature'
      ? memberGateMessage(reasonParam)
      : null;

  useEffect(() => {
    clearRegistrationDraft();
  }, []);

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe}>
        <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
          <FairPathLogo width={220} style={s.logo} />
          <Text style={s.tag}>OPPORTUNITY HAS A PATH</Text>
          <Text style={s.title}>Join FairPath</Text>
          <Text style={s.body}>Create a free member account to apply, save, and use your personal workspace—or keep browsing as a guest.</Text>
          {gateMessage ? (
            <View style={s.banner}>
              <Text style={s.bannerTitle}>Sign in or create an account to continue</Text>
              <Text style={s.bannerBody}>{gateMessage}</Text>
            </View>
          ) : null}

          <SocialAuthButtons returnTo={returnTo} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign up with email"
            style={s.email}
            onPress={() => router.push((returnTo ? `/sign-up?returnTo=${encodeURIComponent(returnTo)}` : '/sign-up') as never)}
          >
            <Text style={s.emailText}>Sign up with email</Text>
            <Text style={s.emailArrow}>→</Text>
          </Pressable>

          <View style={s.signInRow}>
            <Text style={s.signInMuted}>Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={() => router.push((returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : '/sign-in') as never)}
            >
              <Text style={s.signInLink}> Sign in</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse without an account"
            style={s.guest}
            onPress={() => router.replace((returnTo && isGuestBrowsePath(returnTo) ? returnTo : '/find-jobs') as never)}
          >
            <Text style={s.guestText}>Browse without an account</Text>
            <Text style={s.guestArrow}>→</Text>
          </Pressable>

          <Pressable accessibilityRole="link" onPress={() => router.push('/intro?replay=1' as never)}>
            <Text style={s.replay}>See how FairPath works</Text>
          </Pressable>
        </FormScrollView>
      </SafeAreaView>
    </View>
  );
}

function isGuestBrowsePath(path: string) {
  return (
    path.startsWith('/job/') ||
    path.startsWith('/housing/') ||
    path.startsWith('/resource/') ||
    path === '/find-jobs' ||
    path === '/find-housing' ||
    path === '/resources'
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  safe: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { paddingHorizontal: L.mobileGutter, paddingTop: 24, paddingBottom: 40, alignItems: 'stretch' },
  logo: { alignSelf: 'center' },
  tag: { color: C.mutedStrong, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 2.2, textAlign: 'center', marginTop: 8 },
  title: { color: C.white, fontFamily: F.black, fontSize: 38, lineHeight: 40, textAlign: 'center', marginTop: 16 },
  body: { color: C.mutedStrong, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, marginBottom: 8 },
  banner: { borderWidth: 1, borderColor: C.borderStrong, borderLeftWidth: 3, borderLeftColor: C.lime, padding: 14, marginTop: 12, marginBottom: 8 },
  bannerTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 13 },
  bannerBody: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, marginTop: 6 },
  email: {
    height: 52,
    marginTop: 18,
    borderWidth: 1,
    borderColor: C.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  emailText: { color: C.white, fontFamily: F.extraBold, fontSize: 13 },
  emailArrow: { color: C.lime, fontSize: 18 },
  signInRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  signInMuted: { color: C.muted, fontSize: 13 },
  signInLink: { color: C.lime, fontFamily: F.extraBold, fontSize: 13 },
  guest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, paddingVertical: 8 },
  guestText: { color: C.lime, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.6 },
  guestArrow: { color: C.lime, fontSize: 18 },
  replay: { color: C.mutedStrong, fontSize: 12, textAlign: 'center', marginTop: 20, textDecorationLine: 'underline' },
});
