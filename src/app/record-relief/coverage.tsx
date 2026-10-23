import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { BodyText, Panel, StatusLine, SecondaryButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadCoveredJurisdictions, loadEngineSupportedJurisdictionCodes, loadJurisdictions, type Jurisdiction } from '@/core/record-relief/relief-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

/**
 * Two honest layers: (1) engineering — can the shared 57-authority engine calculate here; (2) published DB —
 * is there a verified record_relief_rules row for filing copy. Neither is invented; they can diverge.
 */
export default function Coverage() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const engineSupported = useMemo(() => loadEngineSupportedJurisdictionCodes(), []);
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
  const engineCount = real.filter((j) => engineSupported.has(j.code)).length;

  const row = (j: Jurisdiction) => {
    const verified = covered.has(j.code);
    const engine = engineSupported.has(j.code);
    return (
      <View key={j.code} style={s.row}>
        <Text style={s.name}>{j.name}</Text>
        <View style={s.badges}>
          <InlineBadge tone={engine ? 'lime' : 'default'}>{engine ? 'ENGINE' : 'NO ENGINE'}</InlineBadge>
          <InlineBadge tone={verified ? 'lime' : 'default'}>{verified ? 'DB RULE' : 'NO DB RULE'}</InlineBadge>
        </View>
      </View>
    );
  };

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RECORD RELIEF" title="Coverage" backTo="/record-relief" alwaysBackTo />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Panel><BodyText muted>ENGINE means FairPath can run the shared eligibility calculator for that jurisdiction. DB RULE means a verified filing rule is loaded from our database for steps and citations. A place can have one, both, or neither — nothing here is guessed.</BodyText></Panel>
        {!jurisdictions && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}
        {jurisdictions ? (
          <>
            <Panel tone="accent"><BodyText strong>{engineCount} of {real.length} jurisdictions have engine checks.</BodyText><BodyText muted>{verifiedCount} of {real.length} have a verified database rule for filing details.</BodyText></Panel>
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
  badges: { flexDirection: 'row' as const, gap: 6, flexShrink: 0 },
});
