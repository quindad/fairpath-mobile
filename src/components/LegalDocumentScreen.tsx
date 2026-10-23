import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { BodyText, Panel, StatusLine } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { agreeRegistrationDocument } from '@/core/auth/registration-draft';
import { hasAgreedLegalDocument, markLegalDocumentOpened, type MemberLegalSlug } from '@/core/legal/legal-review-session';
import { getMemberLegalDocument } from '@/core/legal/member-legal-documents';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/core/profile/consent-service';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type Params = { backTo?: string; register?: string };

function safeBackTo(raw: string | string[] | undefined, fallback: string) {
  const v = typeof raw === 'string' ? raw : '';
  return v.startsWith('/') ? v : fallback;
}

export function LegalDocumentScreen({ slug, defaultBackTo }: { slug: MemberLegalSlug; defaultBackTo: string }) {
  const params = useLocalSearchParams<Params>();
  const backTo = safeBackTo(params.backTo, defaultBackTo);
  const registrationMode = params.register === '1';
  const doc = getMemberLegalDocument(slug);
  const s = useThemedStyles(styles);
  const version = slug === 'terms' ? CURRENT_TERMS_VERSION : CURRENT_PRIVACY_VERSION;
  const [reviewed, setReviewed] = useState(false);
  const [alreadyAgreed, setAlreadyAgreed] = useState(false);

  useEffect(() => {
    markLegalDocumentOpened(slug);
    setAlreadyAgreed(hasAgreedLegalDocument(slug));
  }, [slug]);

  function agreeAndReturn() {
    if (!reviewed) return;
    agreeRegistrationDocument(slug);
    if (router.canGoBack()) router.back();
    else router.replace(backTo as never);
  }

  return (
    <ScreenFrame showNav={false}>
      <PageHeader
        eyebrow="LEGAL"
        title={doc.title}
        alwaysBackTo={!registrationMode}
        backTo={backTo}
        onBack={registrationMode ? () => (router.canGoBack() ? router.back() : router.replace(backTo as never)) : true}
      />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <StatusLine tone="warning">{doc.reviewNotice}</StatusLine>
        <BodyText muted>
          Version {doc.version} · Member app · Synced from public site principles · Not counsel-approved final text
        </BodyText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${doc.title} on fairpathfwd.com`}
          onPress={() => void Linking.openURL(doc.canonicalUrl)}
        >
          <Text style={s.webLink}>View on fairpathfwd.com</Text>
        </Pressable>
        {doc.sections.map((section) => (
          <Panel key={section.heading}>
            <Text style={s.heading}>{section.heading}</Text>
            <BodyText>{section.body}</BodyText>
          </Panel>
        ))}

        {registrationMode ? (
          <View style={s.regBox}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: reviewed }}
              accessibilityLabel="I have read this document"
              style={s.reviewRow}
              onPress={() => setReviewed((v) => !v)}
            >
              <View style={[s.check, reviewed && s.checkOn]}>{reviewed ? <Text style={s.checkMark}>✓</Text> : null}</View>
              <Text style={s.reviewText}>I have read this {doc.title} (version {version}).</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Agree to ${doc.title}`}
              style={[s.agreeBtn, (!reviewed || alreadyAgreed) && s.agreeBtnOff]}
              disabled={!reviewed || alreadyAgreed}
              onPress={agreeAndReturn}
            >
              <Text style={[s.agreeText, (!reviewed || alreadyAgreed) && s.agreeTextOff]}>
                {alreadyAgreed ? 'Already selected on registration' : `I agree to this ${slug === 'terms' ? 'Terms of Service' : 'Privacy Policy'}`}
              </Text>
            </Pressable>
            <Text style={s.agreeHint}>Opening this screen alone is not consent. Use the agree button after reading.</Text>
          </View>
        ) : (
          <View style={s.footer}>
            <Pressable accessibilityRole="button" accessibilityLabel="Return" onPress={() => router.replace(backTo as never)}>
              <Text style={s.backCta}>Back</Text>
            </Pressable>
          </View>
        )}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  heading: { color: t.text, fontFamily: F.extraBold, fontSize: 15, marginBottom: 6 },
  webLink: { color: t.accentText, fontFamily: F.bold, fontSize: 13, marginTop: 10, marginBottom: 8, textDecorationLine: 'underline' as const },
  footer: { marginTop: 28, alignItems: 'center' as const },
  backCta: { color: t.accentText, fontFamily: F.extraBold, fontSize: 13, letterSpacing: 0.4 },
  regBox: { marginTop: 24, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 18 },
  reviewRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  check: { width: 22, height: 22, borderWidth: 1, borderColor: t.border, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 2 },
  checkOn: { backgroundColor: t.accentText, borderColor: t.accentText },
  checkMark: { color: t.background, fontFamily: F.extraBold, fontSize: 12 },
  reviewText: { color: t.text, fontSize: 13, flex: 1, lineHeight: 19 },
  agreeBtn: { marginTop: 16, minHeight: 50, backgroundColor: t.accentText, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 14 },
  agreeBtnOff: { opacity: 0.45 },
  agreeText: { color: t.background, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.4, textAlign: 'center' as const },
  agreeTextOff: { color: t.textSecondary },
  agreeHint: { color: t.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 10, textAlign: 'center' as const },
});
