import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { ExportPanel } from '@/components/ExportPanel';
import { FormScrollView } from '@/components/FormScrollView';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { SpecPreview } from '@/components/SpecPreview';
import { BodyText, ChipGroup, EmptyState, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { DEFAULT_PROFILE_OPTIONS, describeIncluded, type OpportunityProfileOptions } from '@/core/documents/builders/opportunity-profile';
import { deliver, getDeliveryCapabilities } from '@/core/documents/deliver';
import type { DeliveryCapabilities } from '@/core/documents/deliver-types';
import { deleteDocument, documentErrorMessage, keepDocumentCopy, logDocumentExport } from '@/core/documents/document-service';
import { documentTypeInfo } from '@/core/documents/document-types';
import { RENDERABLE, buildSpec, generateDocument, readinessFor, type GeneratedDocument, type RenderableType } from '@/core/documents/generate';
import type { DocFormat, DocumentSpec } from '@/core/documents/spec';
import { profileErrorMessage } from '@/core/profile/opportunity-service';
import { notify } from '@/core/ui/notify';

const FORMAT_LABEL: Record<DocFormat, string> = { pdf: 'PDF', docx: 'WORD (EDITABLE)', csv: 'SPREADSHEET (CSV)' };
const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

export default function CreateDocumentScreen() {
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const type = (RENDERABLE as string[]).includes(rawType ?? '') ? (rawType as RenderableType) : null;
  const info = type ? documentTypeInfo(type) : null;

  const [ready, setReady] = useState<{ ready: boolean; reason: string } | null>(null);
  const [options, setOptions] = useState<OpportunityProfileOptions>(DEFAULT_PROFILE_OPTIONS);
  const [spec, setSpec] = useState<DocumentSpec | null>(null);
  const [format, setFormat] = useState<DocFormat>('pdf');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedDocument | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<DeliveryCapabilities | null>(null);
  const [status, setStatus] = useState('');
  const [keepBusy, setKeepBusy] = useState(false);
  const buildId = useRef(0);

  useEffect(() => { void getDeliveryCapabilities().then(setCaps); }, []);
  useEffect(() => { if (info) setFormat(info.formats[0]); }, [info]);

  const refreshPreview = useCallback(async () => {
    if (!type) return;
    const id = ++buildId.current;
    setError('');
    try {
      const r = await readinessFor(type);
      if (id !== buildId.current) return;
      setReady(r);
      if (r.ready) {
        const built = await buildSpec(type, options);
        if (id === buildId.current) setSpec(built);
      }
    } catch (e) {
      if (id === buildId.current) {
        if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/documents/create?type=' + type)) as never);
        else setError(profileErrorMessage(e));
      }
    }
  }, [type, options]);
  useEffect(() => { void refreshPreview(); }, [refreshPreview]);

  const included = useMemo(() => (type === 'opportunity_profile' ? describeIncluded(options) : []), [type, options]);

  async function generate() {
    if (!type) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const doc = await generateDocument(type, format, options);
      setResult(doc);
    } catch (e) {
      const msg = e instanceof Error && e.message.startsWith('SERVER_REFUSED') ? 'This document is not available for that choice.' : documentErrorMessage(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!type || !info) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="DOCUMENTS" title="Document" backTo="/documents" alwaysBackTo />
        <View style={{ paddingHorizontal: L.mobileGutter }}><EmptyState title="That document is not available" body="Open My Documents to see what FairPath can prepare for you." action={<PrimaryButton label="MY DOCUMENTS" onPress={() => router.replace('/documents' as never)} />} /></View>
      </ScreenFrame>
    );
  }

  const set = (patch: Partial<OpportunityProfileOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const setSec = (k: keyof OpportunityProfileOptions['sections'], on: boolean) => setOptions((o) => ({ ...o, sections: { ...o.sections, [k]: on } }));
  const toggles: { key: keyof OpportunityProfileOptions; label: string }[] = [
    { key: 'includeName', label: 'My name' }, { key: 'includePhone', label: 'Phone' }, { key: 'includeEmail', label: 'Email' }, { key: 'includeZip', label: 'ZIP code' }, { key: 'includePay', label: 'Minimum pay' },
  ];
  const sectionOpts: { key: keyof OpportunityProfileOptions['sections']; label: string }[] = [
    { key: 'experience', label: 'Work' }, { key: 'education', label: 'Education' }, { key: 'credentials', label: 'Certifications' }, { key: 'skills', label: 'Skills' },
    { key: 'preferences', label: 'Preferences' }, { key: 'availability', label: 'Availability' }, { key: 'transportation', label: 'Transportation' },
  ];
  const isStandard = info.sensitivity === 'standard';

  return (
    <ScreenFrame>
      <PageHeader eyebrow="DOCUMENTS" title={info.label} backTo="/documents" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <BodyText muted>{info.description}</BodyText>

        {!ready ? <ActivityIndicator style={{ marginTop: 28 }} /> : null}
        {ready && !ready.ready ? (
          <EmptyState title="Not ready yet" body={ready.reason} action={<PrimaryButton label={type === 'opportunity_profile' ? 'OPEN OPPORTUNITY PROFILE' : 'FIND RESOURCES'} onPress={() => router.push((type === 'opportunity_profile' ? '/opportunity-profile' : '/resources') as never)} />} />
        ) : null}
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}

        {ready?.ready ? (
          <>
            {type === 'opportunity_profile' ? (
              <>
                <View style={{ marginTop: 18 }}><SectionTitle>CHOOSE WHAT IS INCLUDED</SectionTitle></View>
                <BodyText muted>Private details are off unless you turn them on. This file is yours to share, so include only what you want the reader to see.</BodyText>
                <ChipGroup options={toggles.map((t) => ({ value: t.key, label: t.label }))} selected={toggles.filter((t) => options[t.key] === true).map((t) => t.key)}
                  onChange={(next) => set(Object.fromEntries(toggles.map((t) => [t.key, next.includes(t.key)])) as Partial<OpportunityProfileOptions>)} />
                <ChipGroup options={sectionOpts.map((t) => ({ value: t.key, label: t.label }))} selected={sectionOpts.filter((t) => options.sections[t.key]).map((t) => t.key)}
                  onChange={(next) => sectionOpts.forEach((t) => setSec(t.key, next.includes(t.key)))} />
                <Panel tone="accent"><BodyText strong>This document will include:</BodyText><BodyText>{included.join(' · ') || 'Nothing selected'}</BodyText></Panel>
              </>
            ) : null}

            <View style={{ marginTop: 20 }}><SectionTitle>PREVIEW</SectionTitle></View>
            <BodyText muted>This is exactly what will be in the file.</BodyText>
            {spec ? <SpecPreview title={spec.title} blocks={spec.blocks} footer={spec.footer} /> : <ActivityIndicator style={{ marginTop: 16 }} />}

            <View style={{ marginTop: 22 }}><SectionTitle>FORMAT</SectionTitle></View>
            <ChipGroup single options={info.formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} selected={[format]} onChange={(n) => setFormat((n[0] as DocFormat) ?? format)} />
            <PrimaryButton label={result ? 'CREATE A NEW VERSION' : `CREATE ${format.toUpperCase()}`} onPress={() => void generate()} busy={busy} />

            {result ? <ExportPanel result={result} onChange={setResult} onDeleted={() => setResult(null)} /> : null}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
