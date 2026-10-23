import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { assembleUnifiedJusticeCases } from '@/core/justice/unified-assembly';
import { previewReliefForBundle } from '@/core/justice/per-charge-relief';
import { unifiedCaseToCaseBundle } from '@/core/justice/mappers';
import { loadMyConvictions } from '@/core/profile/conviction-service';
import { loadCases } from '@/core/record-relief/relief-service';

export default function JusticeRecordsCaseDetail() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(rawId ?? '');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [caseRow, setCaseRow] = useState<ReturnType<typeof assembleUnifiedJusticeCases>[number] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setBusy(true);
        try {
          const [convictions, relief] = await Promise.all([loadMyConvictions(), loadCases()]);
          if (!alive) return;
          const row = assembleUnifiedJusticeCases(convictions, relief).find((c) => c.id === id) ?? null;
          setCaseRow(row);
          if (!row) setError('Case not found.');
        } catch {
          if (alive) setError('Could not load this case.');
        } finally {
          if (alive) setBusy(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [id]),
  );

  const previews = useMemo(() => {
    if (!caseRow?.jurisdictionCode) return [];
    try {
      return previewReliefForBundle(unifiedCaseToCaseBundle(caseRow));
    } catch {
      return [];
    }
  }, [caseRow]);

  const rrCaseId = caseRow?.charges.find((c) => c.linkedRecordReliefCaseId)?.linkedRecordReliefCaseId;

  if (busy) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="MY JUSTICE RECORDS" title="Case" backTo="/justice-records" alwaysBackTo />
        <ActivityIndicator style={{ marginTop: 32 }} />
      </ScreenFrame>
    );
  }

  if (!caseRow) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="MY JUSTICE RECORDS" title="Case" backTo="/justice-records" alwaysBackTo />
        <StatusLine tone="error">{error || 'Case not found.'}</StatusLine>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="MY JUSTICE RECORDS" title={caseRow.docketLabel} backTo="/justice-records" alwaysBackTo />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 48 }}>
        <Panel>
          <BodyText strong>{caseRow.courtName ?? 'Court not specified'}</BodyText>
          <BodyText muted>
            {[caseRow.jurisdictionCode, caseRow.caseNumber ? `Docket ${caseRow.caseNumber}` : null].filter(Boolean).join(' · ')}
          </BodyText>
          <BodyText muted>Verification: {caseRow.verificationState.replace(/_/g, ' ')}</BodyText>
        </Panel>

        <View style={{ marginTop: 18 }}><SectionTitle>CHARGES</SectionTitle></View>
        {caseRow.charges.map((ch, idx) => {
          const preview = previews.find((p) => p.chargeId.includes(ch.id.replace(/[^a-zA-Z0-9_-]/g, '_'))) ?? previews[idx];
          return (
            <Panel key={ch.id}>
              <BodyText strong>{ch.countNumber ? `Count ${ch.countNumber}: ` : ''}{ch.offenseName}</BodyText>
              <BodyText muted>
                {[ch.degree !== 'unknown' ? ch.degree : null, ch.disposition !== 'unknown' ? ch.disposition : null, ch.statuteCode].filter(Boolean).join(' · ')}
              </BodyText>
              {preview ? (
                <View style={{ marginTop: 8 }}>
                  <StatusLine tone={preview.outcome.includes('eligible') ? 'success' : 'muted'}>
                    Record Relief: {preview.outcome.replace(/_/g, ' ')}
                    {preview.daysRemaining != null ? ` · ${preview.daysRemaining} day(s) remaining` : ''}
                  </StatusLine>
                  {preview.missingFacts.length ? (
                    <BodyText muted>Missing for a full check: {preview.missingFacts.join(', ')}</BodyText>
                  ) : null}
                </View>
              ) : (
                <BodyText muted>Record Relief preview unavailable for this charge.</BodyText>
              )}
            </Panel>
          );
        })}

        <View style={{ marginTop: 16, gap: 8 }}>
          {rrCaseId ? (
            <PrimaryButton label="OPEN RECORD RELIEF CASE" onPress={() => router.push(('/record-relief/case/' + rrCaseId) as never)} />
          ) : (
            <PrimaryButton label="TRACK IN RECORD RELIEF" onPress={() => router.push('/record-relief/add' as never)} />
          )}
          <SecondaryButton label="BACK TO ALL RECORDS" onPress={() => router.push('/justice-records' as never)} />
        </View>

        <Panel tone="warning">
          <BodyText muted>FairPath shows potential eligibility only — not a guarantee of expungement or sealing. Employers make hiring decisions; matching insights never replace your choice to disclose.</BodyText>
        </Panel>
      </FormScrollView>
    </ScreenFrame>
  );
}
