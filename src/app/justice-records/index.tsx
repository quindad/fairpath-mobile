import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { assembleUnifiedJusticeCases } from '@/core/justice/unified-assembly';
import { previewReliefForBundle } from '@/core/justice/per-charge-relief';
import { unifiedCaseToCaseBundle } from '@/core/justice/mappers';
import { loadMyConvictions } from '@/core/profile/conviction-service';
import { loadCases, loadCurrentEvaluations } from '@/core/record-relief/relief-service';

export default function JusticeRecordsHub() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReturnType<typeof assembleUnifiedJusticeCases>>([]);
  const [evals, setEvals] = useState<Record<string, { outcome: string; eligibility_date: string | null }[]>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setBusy(true);
        setError('');
        try {
          const [convictions, relief, currentEvals] = await Promise.all([loadMyConvictions(), loadCases(), loadCurrentEvaluations()]);
          if (!alive) return;
          setEvals(currentEvals);
          setRows(assembleUnifiedJusticeCases(convictions, relief));
        } catch {
          if (alive) setError('Could not load your justice records.');
        } finally {
          if (alive) setBusy(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <ScreenFrame>
      <PageHeader eyebrow="MY JUSTICE RECORDS" title="Cases & charges" backTo="/me" alwaysBackTo />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 48 }}>
        <Panel>
          <BodyText muted>
            Enter each docket once, track every count, and see Record Relief insights on your charges. This is your private record — employers only see what you choose to share when applying.
          </BodyText>
        </Panel>

        {busy ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}

        {!busy && !error && rows.length === 0 ? (
          <Panel tone="accent">
            <BodyText strong>No cases yet</BodyText>
            <BodyText muted>Add a Record Relief case or a full conviction entry to start building your unified record.</BodyText>
            <View style={{ marginTop: 12, gap: 8 }}>
              <PrimaryButton label="ADD RECORD RELIEF CASE" onPress={() => router.push('/record-relief/add' as never)} />
              <SecondaryButton label="OPEN RECORD RELIEF HUB" onPress={() => router.push('/record-relief' as never)} />
            </View>
          </Panel>
        ) : null}

        {!busy && rows.length > 0 ? (
          <>
            <View style={{ marginTop: 18 }}><SectionTitle>YOUR DOCKETS</SectionTitle></View>
            {rows.map((c) => {
              const rrId = c.charges.find((ch) => ch.linkedRecordReliefCaseId)?.linkedRecordReliefCaseId;
              const rrHead = rrId ? evals[rrId]?.[0] : null;
              let reliefHint = '';
              if (c.jurisdictionCode && c.charges.length) {
                try {
                  const previews = previewReliefForBundle(unifiedCaseToCaseBundle(c));
                  const best = previews.find((p) => p.outcome === 'eligible_now') ?? previews[0];
                  if (best?.daysRemaining != null) reliefHint = `${best.daysRemaining} day(s) on primary count`;
                  else if (best?.outcome) reliefHint = best.outcome.replace(/_/g, ' ');
                } catch {
                  reliefHint = rrHead?.outcome?.replace(/_/g, ' ') ?? '';
                }
              }
              return (
                <ListRow
                  key={c.id}
                  title={c.docketLabel}
                  body={[
                    c.jurisdictionCode ?? 'Jurisdiction not set',
                    `${c.charges.length} charge(s)`,
                    reliefHint || (rrHead ? String(rrHead.outcome).replace(/_/g, ' ') : 'Relief not checked yet'),
                  ].filter(Boolean).join(' · ')}
                  onPress={() => router.push(('/justice-records/case/' + encodeURIComponent(c.id)) as never)}
                />
              );
            })}
            <View style={{ marginTop: 16, gap: 8 }}>
              <SecondaryButton label="ADD ANOTHER CASE" onPress={() => router.push('/record-relief/add' as never)} />
              <SecondaryButton label="RECORD RELIEF WORKSPACE" onPress={() => router.push('/record-relief' as never)} />
            </View>
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
