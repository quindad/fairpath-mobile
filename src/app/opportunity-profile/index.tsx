import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { SECTION_ROUTES, nextProfileStep } from '@/core/profile/opportunity-forms';
import { loadCompletion, profileErrorMessage, type CompletionSection } from '@/core/profile/opportunity-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

export default function OpportunityProfileHub() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [sections, setSections] = useState<CompletionSection[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    loadCompletion()
      .then(setSections)
      .catch((e) => {
        if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/opportunity-profile')) as never);
        else setError(profileErrorMessage(e));
      });
  }, []);
  useFocusEffect(load);

  const done = sections?.filter((x) => x.is_complete).length ?? 0;
  const total = sections?.length ?? 8;
  const next = sections ? nextProfileStep(sections) : null;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="YOUR PROFILE" title="Opportunity Profile" backTo="/me" />
      <ScrollView contentContainerStyle={s.content}>
        {!sections && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={load} /></View> : null}

        {sections ? (
          <>
            <Panel tone="accent">
              <Text style={s.count}>{done} of {total} sections complete</Text>
              <View style={s.segments}>
                {sections.map((x) => <View key={x.section_key} style={[s.segment, x.is_complete && s.segmentOn]} />)}
              </View>
              {next ? (
                <>
                  <BodyText>Next step: <Text style={s.strong}>{next.label}</Text></BodyText>
                  <PrimaryButton label={`CONTINUE: ${next.label.toUpperCase()}`} onPress={() => router.push(next.route as never)} />
                </>
              ) : (
                <BodyText>Your profile is complete. You can export it or include it on an application.</BodyText>
              )}
            </Panel>

            <Panel>
              <BodyText muted>
                Employers never see your profile. If you choose, a copy of the parts you pick is attached to a job application when you apply. Your justice-related information is separate and is never part of this profile.
              </BodyText>
            </Panel>

            <View style={s.block}><SectionTitle>SECTIONS</SectionTitle></View>
            {sections.map((x) => (
              <ListRow
                key={x.section_key}
                title={x.label}
                body={x.detail}
                onPress={() => router.push((SECTION_ROUTES[x.section_key]?.route ?? '/opportunity-profile') as never)}
                trailing={<Text style={[s.badge, x.is_complete ? s.badgeDone : s.badgeTodo]}>{x.is_complete ? 'DONE' : 'ADD'}</Text>}
              />
            ))}
            <ListRow title="Certifications and licenses" body="Optional" onPress={() => router.push('/opportunity-profile/credentials' as never)} />

            <View style={s.block}><SectionTitle>USE YOUR PROFILE</SectionTitle></View>
            <SecondaryButton label="PREVIEW AND EXPORT (PDF OR WORD)" onPress={() => router.push('/documents/create?type=opportunity_profile' as never)} />
          </>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 36 },
  spinner: { marginTop: 32 },
  block: { marginTop: 22 },
  count: { color: t.text, fontFamily: F.black, fontSize: 20, letterSpacing: -0.3 },
  segments: { flexDirection: 'row' as const, gap: 4, marginVertical: 12 },
  segment: { flex: 1, height: 4, backgroundColor: t.border },
  segmentOn: { backgroundColor: t.accent },
  strong: { color: t.text, fontFamily: F.bold },
  badge: { fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  badgeDone: { color: t.accentText, borderColor: t.accentBorder },
  badgeTodo: { color: t.textMuted, borderColor: t.borderStrong },
});
