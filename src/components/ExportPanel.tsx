import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { InlineBadge, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ChipGroup, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { deliver, getDeliveryCapabilities } from '@/core/documents/deliver';
import type { DeliveryCapabilities } from '@/core/documents/deliver-types';
import { deleteDocument, documentErrorMessage, keepDocumentCopy, logDocumentExport } from '@/core/documents/document-service';
import { documentTypeInfo } from '@/core/documents/document-types';
import type { GeneratedDocument } from '@/core/documents/generate';
import { notify } from '@/core/ui/notify';

const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/**
 * The one export UI: file identity, Download / Save to Files / Share / Print (only what this device supports),
 * keep-a-copy retention, delete, and the plain statement that exported files cannot be recalled.
 */
export function ExportPanel({ result, onChange, onDeleted }: { result: GeneratedDocument; onChange: (next: GeneratedDocument) => void; onDeleted: () => void }) {
  const info = documentTypeInfo(result.row.document_type);
  const [caps, setCaps] = useState<DeliveryCapabilities | null>(null);
  const [status, setStatus] = useState('');
  const [keepBusy, setKeepBusy] = useState(false);
  useEffect(() => { void getDeliveryCapabilities().then(setCaps); }, []);

  async function act(action: 'download' | 'share' | 'print' | 'preview') {
    const r = await deliver(action, { bytes: result.bytes, fileName: result.fileName, mime: result.mime, format: result.format });
    if (r.ok) {
      setStatus(action === 'download' ? 'Downloaded. The file is now on your device, outside FairPath.' : action === 'share' ? 'Share sheet opened.' : action === 'print' ? 'Print dialog opened.' : 'Preview opened.');
      void logDocumentExport(result.row.id, action === 'share' ? 'share_sheet_opened' : action === 'download' ? 'download' : action === 'print' ? 'print' : 'preview', platform);
    } else if (r.message) setStatus(r.message);
  }

  async function keep(days: 30 | 90 | 365) {
    setKeepBusy(true);
    try {
      const row = await keepDocumentCopy(result.row, result.bytes, days);
      onChange({ ...result, row });
      setStatus(`A private copy is stored in FairPath until ${new Date(row.expires_at ?? Date.now()).toLocaleDateString()}. Only you can open it, and you can delete it any time.`);
    } catch (e) { notify('Could not keep a copy', documentErrorMessage(e)); } finally { setKeepBusy(false); }
  }

  function remove() {
    notify('Delete this document?', 'This removes FairPath’s stored copy and its history entry. A file you already downloaded or shared stays where it is: FairPath cannot recall it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteDocument(result.row.id).then(onDeleted).catch((e) => notify('Could not delete', documentErrorMessage(e))) },
    ]);
  }

  const standard = info?.sensitivity === 'standard';
  return (
    <View>
      <View style={{ marginTop: 22 }}><SectionTitle>YOUR FILE</SectionTitle></View>
      <Panel tone="accent">
        <BodyText strong>{result.fileName}</BodyText>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <InlineBadge tone="lime">VERSION {result.row.version}</InlineBadge>
          <InlineBadge>{result.generatedBy === 'server' ? 'PREPARED BY FAIRPATH' : 'PREPARED ON THIS DEVICE'}</InlineBadge>
          <InlineBadge>{Math.max(1, Math.round(result.bytes.length / 1024))} KB</InlineBadge>
        </View>
      </Panel>
      {caps?.download ? <PrimaryButton label={caps.labels.download + ' ' + result.format.toUpperCase()} onPress={() => void act('download')} /> : null}
      {caps?.openPreview && result.format === 'pdf' ? <SecondaryButton label="OPEN PREVIEW" onPress={() => void act('preview')} /> : null}
      {caps?.share ? (caps.download ? <SecondaryButton label={caps.labels.share} onPress={() => void act('share')} /> : <PrimaryButton label={caps.labels.share} onPress={() => void act('share')} />) : null}
      {caps?.print && result.format === 'pdf' ? <SecondaryButton label="PRINT" onPress={() => void act('print')} /> : null}
      {caps && !caps.download && !caps.share ? <StatusLine tone="warning">Sharing is not available on this device.</StatusLine> : null}
      {status ? <StatusLine tone="muted">{status}</StatusLine> : null}
      {platform !== 'web' ? <StatusLine tone="muted">Native saving and sharing use your phone’s own share sheet.</StatusLine> : null}

      <View style={{ marginTop: 22 }}><SectionTitle>KEEP A COPY IN FAIRPATH (OPTIONAL)</SectionTitle></View>
      <BodyText muted>
        {standard ? 'By default FairPath keeps only a record that this file was created, not the file. ' : 'Because this document is sensitive, FairPath does not keep the file unless you ask. '}
        If you keep a copy it is stored privately for the time you choose and only you can open it.
      </BodyText>
      {result.row.has_stored_copy ? (
        <StatusLine tone="success">A copy is stored until {new Date(result.row.expires_at ?? Date.now()).toLocaleDateString()}.</StatusLine>
      ) : (
        <ChipGroup single options={(info?.retentionChoices ?? [30, 90]).map((d) => ({ value: String(d), label: `${d} days` }))} selected={[]} onChange={(n) => n[0] && !keepBusy && void keep(Number(n[0]) as 30 | 90 | 365)} />
      )}
      <SecondaryButton tone="danger" label="DELETE THIS DOCUMENT" onPress={remove} />
      <StatusLine tone="muted">A file you download or share leaves FairPath. FairPath cannot recall or delete it from your device or another app.</StatusLine>
    </View>
  );
}
