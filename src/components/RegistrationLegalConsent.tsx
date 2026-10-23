import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import { registrationDraftLegalReady, syncRegistrationDraftFromLegalSession } from '@/core/auth/registration-draft';
import { hasAgreedLegalDocument, hasOpenedLegalDocument } from '@/core/legal/legal-review-session';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/core/profile/consent-service';

type Props = {
  legalBackTo: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
  onChangeAgreedTerms: (next: boolean) => void;
  onChangeAgreedPrivacy: (next: boolean) => void;
  /** Persist sign-up fields before pushing legal routes (avoids remount data loss). */
  onBeforeOpenDocument?: () => void;
  compact?: boolean;
};

export function RegistrationLegalConsent({
  legalBackTo,
  agreedTerms,
  agreedPrivacy,
  onChangeAgreedTerms,
  onChangeAgreedPrivacy,
  onBeforeOpenDocument,
  compact,
}: Props) {
  useFocusEffect(
    useCallback(() => {
      syncRegistrationDraftFromLegalSession();
      if (hasAgreedLegalDocument('terms')) onChangeAgreedTerms(true);
      if (hasAgreedLegalDocument('privacy')) onChangeAgreedPrivacy(true);
    }, [onChangeAgreedTerms, onChangeAgreedPrivacy]),
  );

  const termsReviewed = hasOpenedLegalDocument('terms') || hasAgreedLegalDocument('terms');
  const privacyReviewed = hasOpenedLegalDocument('privacy') || hasAgreedLegalDocument('privacy');
  const canAgreeTerms = termsReviewed;
  const canAgreePrivacy = privacyReviewed;

  const open = (path: string) => {
    onBeforeOpenDocument?.();
    router.push(path as never);
  };

  return (
    <View style={s.wrap}>
      <Text style={[s.intro, compact && s.introCompact]}>
        Read each document and agree on its screen, or use the checkboxes here. Version {CURRENT_TERMS_VERSION} / {CURRENT_PRIVACY_VERSION}.
      </Text>
      <View style={s.linkRow}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Read FairPath Terms of Service"
          onPress={() => open(`/legal/terms?register=1&backTo=${encodeURIComponent(legalBackTo)}`)}
          style={s.docLinkHalf}
        >
          <Text style={s.docLinkText}>Terms</Text>
          <Text style={s.docLinkHint}>{agreedTerms ? 'Agreed' : termsReviewed ? 'Reviewed' : 'Read & agree'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Read FairPath Privacy Policy"
          onPress={() => open(`/legal/privacy?register=1&backTo=${encodeURIComponent(legalBackTo)}`)}
          style={s.docLinkHalf}
        >
          <Text style={s.docLinkText}>Privacy</Text>
          <Text style={s.docLinkHint}>{agreedPrivacy ? 'Agreed' : privacyReviewed ? 'Reviewed' : 'Read & agree'}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Agree to FairPath Terms of Service"
        accessibilityState={{ checked: agreedTerms, disabled: !canAgreeTerms }}
        style={[s.row, !canAgreeTerms && s.rowDisabled]}
        onPress={() => {
          if (canAgreeTerms) onChangeAgreedTerms(!agreedTerms);
        }}
      >
        <View style={[s.box, agreedTerms && s.boxOn, !canAgreeTerms && s.boxOff]}>{agreedTerms ? <Text style={s.mark}>✓</Text> : null}</View>
        <Text style={[s.rowText, compact && s.rowTextCompact, !canAgreeTerms && s.rowTextMuted]}>
          I agree to Terms ({CURRENT_TERMS_VERSION})
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Agree to FairPath Privacy Policy"
        accessibilityState={{ checked: agreedPrivacy, disabled: !canAgreePrivacy }}
        style={[s.row, !canAgreePrivacy && s.rowDisabled]}
        onPress={() => {
          if (canAgreePrivacy) onChangeAgreedPrivacy(!agreedPrivacy);
        }}
      >
        <View style={[s.box, agreedPrivacy && s.boxOn, !canAgreePrivacy && s.boxOff]}>{agreedPrivacy ? <Text style={s.mark}>✓</Text> : null}</View>
        <Text style={[s.rowText, compact && s.rowTextCompact, !canAgreePrivacy && s.rowTextMuted]}>
          I agree to Privacy ({CURRENT_PRIVACY_VERSION})
        </Text>
      </Pressable>
    </View>
  );
}

/** @deprecated Prefer registrationDraftLegalReady(draft) from registration-draft.ts */
export function registrationLegalReady(
  _termsReviewed: boolean,
  _privacyReviewed: boolean,
  agreedTerms: boolean,
  agreedPrivacy: boolean,
) {
  return registrationDraftLegalReady({ firstName: '', lastName: '', email: '', password: '', agreedTerms, agreedPrivacy });
}

const s = StyleSheet.create({
  wrap: { marginTop: 4 },
  intro: { color: C.mutedStrong, fontSize: 11, lineHeight: 16, marginBottom: 6 },
  linkRow: { flexDirection: 'row', gap: 8 },
  docLinkHalf: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: C.borderStrong },
  docLinkText: { color: C.lime, fontFamily: F.extraBold, fontSize: 12 },
  docLinkHint: { color: C.mutedStrong, fontSize: 10, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 4 },
  rowDisabled: { opacity: 0.55 },
  box: { width: 20, height: 20, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.lime, borderColor: C.lime },
  boxOff: { borderColor: '#3A4038' },
  mark: { color: C.black, fontFamily: F.extraBold, fontSize: 11 },
  rowText: { color: C.white, fontSize: 11, flex: 1, lineHeight: 16 },
  rowTextMuted: { color: C.mutedStrong },
  introCompact: { color: '#6F756F', fontSize: 10, lineHeight: 15 },
  rowTextCompact: { color: '#D7DAD6', fontSize: 10, lineHeight: 15 },
});
