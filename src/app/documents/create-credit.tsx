import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ExportPanel } from '@/components/ExportPanel';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { SpecPreview } from '@/components/SpecPreview';
import { BodyText, ChipGroup, EmptyState, PrimaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { loadDisputes } from '@/core/credit/credit-service';
import { buildDisputeHistory } from '@/core/documents/builders/credit';
import { documentTypeInfo } from '@/core/documents/document-types';
import { generateFromSpec, type GeneratedDocument } from '@/core/documents/generate';
import type { DocFormat, DocumentSpec } from '@/core/documents/spec';
import { documentErrorMessage } from '@/core/documents/document-service';

/** Dispute history export (a sensitive document: on-demand, no stored file unless the member asks). */
export default function CreateCreditDocument() {
  const info = documentTypeInfo('credit_dispute_history')!;
  const [spec, setSpec] = useState<DocumentSpec | null>(null);
  const [count, setCount] = useState(0);
  const [format, setFormat] = useState<DocFormat>('pdf');
  const [result, setResult] = useState<GeneratedDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDisputes().then((d) => { setCount(d.length); setSpec(buildDisputeHistory(d)); }).catch(() => setError('We could not load your disputes.'));
  }, []);

  async function generate() {
    if (!spec) return;
    setBusy(true); setError('');
    try { setResult(await generateFromSpec(spec, format)); } catch (e) { setError(documentErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="DOCUMENTS" title={info.label} backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <BodyText muted>{info.description} This document contains sensitive information. FairPath does not keep the file unless you ask.</BodyText>
        {!spec && !error ? <ActivityIndicator style={{ marginTop: 28 }} /> : null}
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        {spec && count === 0 ? <EmptyState title="No disputes yet" body="Your dispute history appears here once you create a dispute." action={<PrimaryButton label="BACK TO CREDIT" onPress={() => router.replace('/credit' as never)} />} /> : null}
        {spec && count > 0 ? (
          <>
            <View style={{ marginTop: 20 }}><SectionTitle>PREVIEW</SectionTitle></View>
            <SpecPreview title={spec.title} blocks={spec.blocks} footer={spec.footer} />
            <View style={{ marginTop: 22 }}><SectionTitle>FORMAT</SectionTitle></View>
            <ChipGroup single options={info.formats.map((f) => ({ value: f, label: f === 'csv' ? 'SPREADSHEET (CSV)' : f.toUpperCase() }))} selected={[format]} onChange={(n) => setFormat((n[0] as DocFormat) ?? format)} />
            <PrimaryButton label={result ? 'CREATE A NEW VERSION' : `CREATE ${format.toUpperCase()}`} onPress={() => void generate()} busy={busy} />
            {result ? <ExportPanel result={result} onChange={setResult} onDeleted={() => setResult(null)} /> : null}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
