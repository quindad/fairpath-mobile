import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { ExportPanel } from '@/components/ExportPanel';
import { FairPathDatePicker } from '@/components/FairPathDatePicker';
import { FormScrollView } from '@/components/FormScrollView';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { SpecPreview } from '@/components/SpecPreview';
import { BodyText, ChipGroup, Field, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { DISPUTE_STATUS_LABEL, OUTCOME_LABEL, dateLabel, dueLabel, nextDisputeAction } from '@/core/credit/credit-format';
import {
  addEvidence, creditErrorMessage, deleteDispute, loadAccounts, loadDisputeDetail, loadItems, markDisputeSent, recordDisputeResponse, updateDispute,
  type CreditAccount, type Dispute, type ReviewItem,
} from '@/core/credit/credit-service';
import {
  STANDARD_LETTER_ENCLOSURES, buildAccountSummary, buildDisputeLetter, buildEvidenceChecklist, buildMailingInstructions, letterProblems, type LetterFields,
} from '@/core/documents/builders/credit';
import { deliver } from '@/core/documents/deliver';
import { logDocumentExport } from '@/core/documents/document-service';
import { generateFromSpec, type GeneratedDocument } from '@/core/documents/generate';
import type { DocumentSpec } from '@/core/documents/spec';
import { isoFromText } from '@/core/profile/opportunity-forms';
import { loadContact } from '@/core/profile/opportunity-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
const todayText = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export default function DisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useFairPathTheme();
  const [data, setData] = useState<{ dispute: Dispute; itemIds: string[]; events: { event_type: string; created_at: string }[]; evidence: { id: string; description: string }[] } | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // letter fields (all editable before anything is generated)
  const [fields, setFields] = useState<LetterFields>({ senderName: '', senderAddress: '', senderPhone: '', recipientAddress: '', dateText: todayText(), enclosures: STANDARD_LETTER_ENCLOSURES.slice(0, 2) });
  const [showProblems, setShowProblems] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [packetNote, setPacketNote] = useState('');

  // tracker inputs
  const [sentText, setSentText] = useState('');
  const [method, setMethod] = useState<string[]>(['mail']);
  const [reference, setReference] = useState('');
  const [respText, setRespText] = useState('');
  const [outcome, setOutcome] = useState<string[]>([]);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [followText, setFollowText] = useState('');
  const [evidenceText, setEvidenceText] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [d, allItems, allAccounts, contact] = await Promise.all([loadDisputeDetail(id), loadItems(), loadAccounts(), loadContact().catch(() => null)]);
      setData(d); setAccounts(allAccounts); setItems(allItems.filter((i) => d.itemIds.includes(i.id)));
      setFields((f) => ({ ...f, senderName: f.senderName || (contact ? `${contact.first_name} ${contact.last_name}`.trim() : ''), senderPhone: f.senderPhone || (contact?.phone ?? '') }));
    } catch { setError('We could not load this dispute.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const dispute = data?.dispute;
  const problems = useMemo(() => (dispute ? letterProblems(items, fields) : []), [dispute, items, fields]);
  const letterSpec: DocumentSpec | null = useMemo(() => (dispute ? buildDisputeLetter(dispute, items, accounts, fields) : null), [dispute, items, accounts, fields]);

  const run = async (fn: () => Promise<unknown>, failTitle: string) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { notify(failTitle, creditErrorMessage(e)); } finally { setBusy(false); }
  };

  async function makeLetter(format: 'pdf' | 'docx') {
    setShowProblems(true);
    if (problems.length || !letterSpec) return;
    setBusy(true);
    try { setGenerated(await generateFromSpec(letterSpec, format)); } catch (e) { notify('Could not create the letter', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  async function buildPacket() {
    setShowProblems(true);
    if (problems.length || !dispute || !letterSpec) return;
    setBusy(true); setPacketNote('');
    try {
      const specs: DocumentSpec[] = [letterSpec, buildEvidenceChecklist(dispute, [...(data?.evidence ?? []), ...fields.enclosures.map((d) => ({ description: d }))]), buildAccountSummary(items, accounts), buildMailingInstructions(dispute)];
      const docs: GeneratedDocument[] = [];
      for (let n = 0; n < specs.length; n++) docs.push(await generateFromSpec({ ...specs[n], subject: `${String(n + 1).padStart(2, '0')} ${specs[n].subject}` }, 'pdf', { position: n + 1, total: specs.length }));
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      docs.forEach((d) => zip.file(d.fileName, d.bytes));
      const bytes = await zip.generateAsync({ type: 'uint8array' });
      const d = new Date();
      const name = `FairPath_Credit_Dispute_Packet_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`;
      const r = await deliver(platform === 'web' ? 'download' : 'share', { bytes, fileName: name, mime: 'application/zip', format: 'zip' });
      if (r.ok) { docs.forEach((x) => void logDocumentExport(x.row.id, platform === 'web' ? 'download' : 'share_sheet_opened', platform)); setPacketNote(`Packet created: ${docs.length} documents in ${name}. Review every page before you send anything.`); }
      else setPacketNote(r.message ?? 'The packet was created, but could not be saved or shared on this device.');
    } catch (e) { notify('Could not build the packet', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  if (error) return <ScreenFrame><PageHeader eyebrow="CREDIT" title="Dispute" backTo="/credit" alwaysBackTo /><View style={{ paddingHorizontal: L.mobileGutter }}><StatusLine tone="error">{error}</StatusLine></View></ScreenFrame>;
  if (!dispute || !data) return <ScreenFrame><PageHeader eyebrow="CREDIT" title="Dispute" backTo="/credit" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  const due = dueLabel(dispute.response_due_on, dispute.status);
  const set = (p: Partial<LetterFields>) => setFields((f) => ({ ...f, ...p }));

  return (
    <ScreenFrame>
      <PageHeader eyebrow="CREDIT DISPUTE" title={dispute.target_name} backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          <InlineBadge tone="lime">{DISPUTE_STATUS_LABEL[dispute.status].toUpperCase()}</InlineBadge>
          {dispute.outcome ? <InlineBadge>{OUTCOME_LABEL[dispute.outcome].toUpperCase()}</InlineBadge> : null}
        </View>
        {due.text ? <StatusLine tone={due.tone === 'overdue' ? 'error' : due.tone === 'soon' ? 'warning' : 'muted'}>{due.text}</StatusLine> : null}
        <Panel><BodyText muted>{nextDisputeAction(dispute.status, Boolean(dispute.outcome))}</BodyText></Panel>
        <Panel><BodyText strong>Why you are disputing</BodyText><BodyText>{dispute.reason}</BodyText></Panel>

        <View style={{ marginTop: 18 }}><SectionTitle>ISSUES IN THIS DISPUTE</SectionTitle></View>
        {items.map((i) => <ListRow key={i.id} title={i.title} body={i.member_statement ?? undefined} onPress={() => router.push(('/credit/item/' + i.id) as never)} />)}

        {dispute.status === 'draft' ? (
          <>
            <View style={{ marginTop: 22 }}><SectionTitle>PREPARE YOUR LETTER</SectionTitle></View>
            <Panel tone="warning"><BodyText>Fill in and check every box. FairPath writes the letter from what YOU confirmed, and does not send it. Nothing is invented.</BodyText></Panel>
            <Field label="YOUR NAME (AS IT SHOULD APPEAR)" value={fields.senderName} onChangeText={(v) => set({ senderName: v })} autoCapitalize="words" />
            <Field label="YOUR MAILING ADDRESS" value={fields.senderAddress} onChangeText={(v) => set({ senderAddress: v })} multiline hint="Street, city, state, ZIP" />
            <Field label="YOUR PHONE" value={fields.senderPhone} onChangeText={(v) => set({ senderPhone: v })} keyboardType="phone-pad" optional />
            <Field label={`ADDRESS OF ${dispute.target_name.toUpperCase()}`} value={fields.recipientAddress} onChangeText={(v) => set({ recipientAddress: v })} multiline hint="FairPath does not store bureau or company addresses because they change. Copy the current dispute address from their official website." />
            <Field label="DATE ON THE LETTER" value={fields.dateText} onChangeText={(v) => set({ dateText: v })} />
            <ChipGroup label="ENCLOSURES TO LIST" options={STANDARD_LETTER_ENCLOSURES.map((e) => ({ value: e, label: e.length > 34 ? e.slice(0, 32) + '…' : e }))} selected={fields.enclosures} onChange={(n) => set({ enclosures: n })} hint="Only list what you will actually include." />
            {showProblems && problems.length ? <View>{problems.map((p) => <StatusLine key={p} tone="error">{p}</StatusLine>)}</View> : null}

            <View style={{ marginTop: 18 }}><SectionTitle>PREVIEW</SectionTitle></View>
            {letterSpec ? <SpecPreview title={letterSpec.title} blocks={letterSpec.blocks} footer={letterSpec.footer} /> : null}
            <PrimaryButton label="CREATE LETTER (PDF)" onPress={() => void makeLetter('pdf')} busy={busy} />
            <SecondaryButton label="CREATE EDITABLE LETTER (WORD)" onPress={() => void makeLetter('docx')} disabled={busy} />
            <SecondaryButton label="BUILD MY DISPUTE PACKET (4 DOCUMENTS)" onPress={() => void buildPacket()} disabled={busy} />
            {packetNote ? <StatusLine tone="muted">{packetNote}</StatusLine> : null}
            {generated ? <ExportPanel result={generated} onChange={setGenerated} onDeleted={() => setGenerated(null)} /> : null}

            <View style={{ marginTop: 26 }}><SectionTitle>AFTER YOU SEND IT</SectionTitle></View>
            <FairPathDatePicker label="DATE YOU SENT IT" value={sentText} onChange={setSentText} kind="past" />
            <ChipGroup single label="HOW YOU SENT IT" options={[{ value: 'mail', label: 'Mail' }, { value: 'online', label: 'Online' }, { value: 'other', label: 'Other' }]} selected={method} onChange={(n) => setMethod(n.length ? n : method)} />
            <Field label="TRACKING OR REFERENCE NUMBER" value={reference} onChangeText={setReference} optional maxLength={80} />
            <PrimaryButton label="RECORD THAT I SENT IT" onPress={() => void run(() => markDisputeSent(dispute.id, isoFromText(sentText) ?? '', method[0] as 'mail' | 'online' | 'other', reference), 'Could not record')} disabled={!isoFromText(sentText) || busy} />
          </>
        ) : null}

        {dispute.status === 'sent' || dispute.status === 'response_received' ? (
          <>
            <View style={{ marginTop: 22 }}><SectionTitle>TRACKER</SectionTitle></View>
            <Panel>
              {[['Sent', dateLabel(dispute.sent_on) + (dispute.sent_method ? ` by ${dispute.sent_method}` : '')], ['Reference', dispute.tracking_reference ?? '—'], ['Response expected by', dateLabel(dispute.response_due_on)], ['Response received', dateLabel(dispute.response_received_on)], ['Follow-up', dateLabel(dispute.follow_up_on)]].map(([k, v]) => (
                <View key={k} style={{ marginBottom: 8 }}><BodyText muted>{k}</BodyText><BodyText strong>{v}</BodyText></View>
              ))}
              {dispute.outcome_notes ? <BodyText muted>Notes: {dispute.outcome_notes}</BodyText> : null}
            </Panel>
            <View style={{ marginTop: 18 }}><SectionTitle>RECORD A RESPONSE</SectionTitle></View>
            <FairPathDatePicker label="DATE YOU RECEIVED IT" value={respText} onChange={setRespText} kind="past" />
            <ChipGroup single label="WHAT DID IT SAY?" options={Object.entries(OUTCOME_LABEL).map(([value, label]) => ({ value, label }))} selected={outcome} onChange={setOutcome} />
            <Field label="NOTES" value={outcomeNotes} onChangeText={setOutcomeNotes} multiline optional maxLength={1000} />
            <PrimaryButton label="SAVE THE RESPONSE" onPress={() => void run(() => recordDisputeResponse(dispute.id, isoFromText(respText) ?? '', outcome[0], outcomeNotes), 'Could not save')} disabled={!isoFromText(respText) || !outcome.length || busy} />
            <FairPathDatePicker label="REMIND ME TO FOLLOW UP ON" value={followText} onChange={setFollowText} kind="future" optional />
            <SecondaryButton label="SET FOLLOW-UP DATE" onPress={() => void run(() => updateDispute(dispute.id, { followUpOn: isoFromText(followText) ?? undefined }), 'Could not save')} disabled={!isoFromText(followText) || busy} />
            <SecondaryButton label="CLOSE THIS DISPUTE" onPress={() => void run(() => updateDispute(dispute.id, { close: true }), 'Could not close')} disabled={busy} />
          </>
        ) : null}

        <View style={{ marginTop: 22 }}><SectionTitle>SUPPORTING DOCUMENTS</SectionTitle></View>
        {data.evidence.map((e) => <ListRow key={e.id} title={e.description} />)}
        <Field label="ADD A NOTE ABOUT A DOCUMENT YOU HAVE" value={evidenceText} onChangeText={setEvidenceText} optional placeholder="March statement showing the payment" />
        <SecondaryButton label="ADD TO THIS DISPUTE" onPress={() => void run(async () => { await addEvidence(dispute.id, evidenceText); setEvidenceText(''); }, 'Could not add')} disabled={evidenceText.trim().length < 3 || busy} />
        <BodyText muted>FairPath keeps a list of what you plan to include. It does not store your evidence files.</BodyText>

        <View style={{ marginTop: 22 }}><SectionTitle>HISTORY</SectionTitle></View>
        {data.events.map((e, k) => <BodyText key={k} muted>{dateLabel(e.created_at)} · {e.event_type.replace(/_/g, ' ')}</BodyText>)}

        <SecondaryButton tone="danger" label="DELETE THIS DISPUTE" onPress={() => notify('Delete this dispute?', 'This removes the dispute and its history from FairPath. It does not affect anything you already sent.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteDispute(dispute.id).then(() => router.replace('/credit' as never)).catch((e) => notify('Could not delete', creditErrorMessage(e))) }])} />
      </FormScrollView>
    </ScreenFrame>
  );
}
