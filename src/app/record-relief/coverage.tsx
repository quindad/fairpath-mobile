import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { BodyText, Panel, StatusLine, SecondaryButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadCoveredJurisdictions, loadJurisdictions, type Jurisdiction } from '@/core/record-relief/relief-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

/**
 * Honest, explicit coverage status per jurisdiction. FairPath structurally supports every US state, DC, the
 * territories and a federal branch — but a jurisdiction only shows VERIFIED once a real, source-backed rule exists
 * for it. There is no "in between" state exposed to members today: a rule is either verified and visible, or it
 * isn't in the database at all, so everything else is NOT YET AVAILABLE. Nothing here is invented.
 */
export default function Coverage() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[] | null>(null);
  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { const [j, c] = await Promise.all([loadJurisdictions(), loadCoveredJurisdictions()]); setJurisdictions(j); setCovered(c); }
    catch { setError('We could not load coverage. Check your connection and try again.'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const real = (jurisdictions ?? []).filter((j) => j.kind !== 'test');
  const federal = real.filter((j) => j.kind === 'federal');
  const states = real.filter((j) => j.kind !== 'federal').sort((a, b) => a.name.localeCompare(b.name));
  const verifiedCount = real.filter((j) => covered.has(j.code)).length;

  const row = (j: Jurisdiction) => {
    const verified = covered.has(j.code);
    return (
      <View key={j.code} style={s.row}>
        <Text style={s.name}>{j.name}</Text>
        <InlineBadge tone={verified ? 'lime' : 'default'}>{verified ? 'VERIFIED' : 'NOT YET AVAILABLE'}</InlineBadge>
      </View>
    );
  };

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RECORD RELIEF" title="Coverage" backTo="/record-relief" alwaysBackTo />
      <ScrollView contentContainerStyle={s.content}>
        <Panel><BodyText muted>FairPath is built to eventually cover every state, DC, the territories and federal relief — but it only shows a result where a real rule has been verified from an official source. Nothing here is guessed.</BodyText></Panel>
        {!jurisdictions && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}
        {jurisdictions ? (
          <>
            <Panel tone="accent"><BodyText strong>{verifiedCount} of {real.length} jurisdictions have a verified rule loaded.</BodyText></Panel>
            <Text style={s.section}>FEDERAL</Text>
            <Panel>{federal.map(row)}</Panel>
            <Text style={s.section}>STATES, DC &amp; TERRITORIES</Text>
            <Panel>{states.map(row)}</Panel>
          </>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 40, paddingTop: 8 },
  spinner: { marginTop: 28 },
  section: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.borderStrong },
  name: { color: t.text, fontFamily: F.semiBold, fontSize: 13, flex: 1, paddingRight: 10 },
});
