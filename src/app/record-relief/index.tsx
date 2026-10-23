import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame, ScreenScroll, SectionTitle } from '@/components/ProductChrome';
import { BodyText, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { DISCLAIMER, OUTCOME_INFO, countdownText, headlineOutcome, partitionEvaluationsForDisplay } from '@/core/record-relief/relief-format';
import { jurisdictionHasEngineSupport } from '@/core/record-relief/engine-coverage';
import { loadCases, loadCoveredJurisdictions, loadCurrentEvaluations, loadJurisdictions, type Jurisdiction, type ReliefCase } from '@/core/record-relief/relief-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { JusticeToolsGate } from '@/components/JusticeToolsGate';

export default function RecordReliefHome() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [cases, setCases] = useState<ReliefCase[] | null>(null);
  const [evals, setEvals] = useState<Awaited<ReturnType<typeof loadCurrentEvaluations>>>({});
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [c, e, j, cov] = await Promise.all([loadCases(), loadCurrentEvaluations(), loadJurisdictions(), loadCoveredJurisdictions()]);
      setCases(c); setEvals(e); setJurisdictions(j); setCovered(cov);
    } catch (err) {
      if (err instanceof Error && err.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/record-relief')) as never);
      else { setCases(null); setError('We could not load your cases. Check your connection and try again.'); }
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const nameOf = useMemo(() => Object.fromEntries(jurisdictions.map((j) => [j.code, j.name])), [jurisdictions]);
  const coveredNames = jurisdictions.filter((j) => covered.has(j.code) && j.kind !== 'test').map((j) => j.name);
  const testCovered = jurisdictions.filter((j) => covered.has(j.code) && j.kind === 'test').length;

  return (
    <JusticeToolsGate eyebrow="FREE FAIRPATH TOOL" title="Record Relief" backTo="/home">
    <ScreenFrame>
      <PageHeader eyebrow="FREE FAIRPATH TOOL" title="Record Relief" backTo="/home" />
      <ScreenScroll contentContainerStyle={s.content}>
        <Panel tone="warning"><BodyText>{DISCLAIMER}</BodyText></Panel>
        {!cases && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}

        {cases ? (
          <>
            <PrimaryButton label="SCAN MY CASE WITH SIGNAL" onPress={() => router.push('/record-relief/scan-packet' as never)} />
            <ListRow title="Find my court record" body="Look up where a case was filed" onPress={() => router.push('/record-relief/court-finder' as never)} />
            <ListRow title="Enter case manually" body="Add charges and dates yourself" onPress={() => router.push('/record-relief/add' as never)} />
            <View style={s.block}><SectionTitle>MY CASES</SectionTitle></View>
            {cases.length === 0 ? <EmptyState title="No cases yet" body="Add a case to see whether any verified rule may apply, track a waiting period, and prepare your paperwork. You enter the details, and you can edit or delete them any time." /> : null}
            {cases.map((c) => {
              const rows = c.out_of_state_conviction ? [] : partitionEvaluationsForDisplay(evals[c.id] ?? [], { engineSupported: jurisdictionHasEngineSupport(c.jurisdiction_code) }).primary;
              const head = c.out_of_state_conviction ? { outcome: 'manual_review' as const, eligibility_date: null } : headlineOutcome(rows);
              const info = head ? OUTCOME_INFO[head.outcome] : null;
              const count = head ? countdownText(head.outcome, head.eligibility_date, null) : '';
              return (
                <ListRow key={c.id} title={c.label} body={`${nameOf[c.jurisdiction_code] ?? c.jurisdiction_code}${c.filing_status !== 'not_started' ? ' · ' + c.filing_status.replace(/_/g, ' ') : ''}`}
                  meta={count || info?.summary}
                  onPress={() => router.push(('/record-relief/case/' + c.id) as never)}
                  trailing={info ? <InlineBadge tone={info.tone === 'good' ? 'lime' : 'default'}>{info.label.split(' ').slice(0, 2).join(' ')}</InlineBadge> : undefined} />
              );
            })}

            <View style={s.block}><SectionTitle>COVERAGE & TOOLS</SectionTitle></View>
            <Panel>
              {coveredNames.length ? <BodyText strong>Verified rules: {coveredNames.join(', ')}.</BodyText> : <BodyText muted>No verified jurisdiction rules loaded yet. You can still track a case; FairPath will say what it cannot check.</BodyText>}
              {testCovered ? <BodyText muted>DEV build includes fictional TEST jurisdictions — not real law.</BodyText> : null}
            </Panel>
            <ListRow title="Coverage by state" body="See exactly which jurisdictions have a verified rule loaded" onPress={() => router.push('/record-relief/coverage' as never)} />
            <ListRow title="Explain my record" body="Write a private statement you can choose to attach to a job or housing application" onPress={() => router.push('/record-relief/my-statement' as never)} />
            <ListRow title="Find legal help" body="Legal aid and record-relief organizations near you" onPress={() => router.push('/resources' as never)} />
          </>
        ) : null}
      </ScreenScroll>
    </ScreenFrame>
    </JusticeToolsGate>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 40, paddingTop: 8 },
  spinner: { marginTop: 28 },
  block: { marginTop: 22 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 15 },
});
