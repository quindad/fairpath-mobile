import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { ExportPanel } from '@/components/ExportPanel';
import { FairPathDatePicker } from '@/components/FairPathDatePicker';
import { FormScrollView } from '@/components/FormScrollView';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ChipGroup, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { buildCaseSummary, buildFilingChecklist, buildFormsGuide, buildWorksheet, type ReliefCaseForDoc } from '@/core/documents/builders/record-relief';
import { deliver } from '@/core/documents/deliver';
import { logDocumentExport } from '@/core/documents/document-service';
import { generateFromSpec, type GeneratedDocument } from '@/core/documents/generate';
import type { DocumentSpec } from '@/core/documents/spec';
import { isoFromText } from '@/core/profile/opportunity-forms';
import { loadContact } from '@/core/profile/opportunity-service';
import {
  ANCHOR_LABEL, DISCLAIMER, FILING_STATUS_OPTIONS, MISSING_LABEL, OUTCOME_INFO, REMEDY_LABEL, countdownText, ruleChangedNotice, staleRuleNotice,
} from '@/core/record-relief/relief-format';
import {
  deleteCase, loadCase, loadCaseDetail, loadJurisdictions, reevaluateCase, reliefErrorMessage, setCaseStatus, toggleChecklist,
  type ReliefCase, type ReliefDetail, type ReliefEvaluation,
} from '@/core/record-relief/relief-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

export default function ReliefCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [c, setC] = useState<ReliefCase | null>(null);
  const [detail, setDetail] = useState<ReliefDetail | null>(null);
  const [jName, setJName] = useState('');
  const [member, setMember] = useState({ firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filedText, setFiledText] = useState('');
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [packetNote, setPacketNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [cc, d, js, contact] = await Promise.all([loadCase(id), loadCaseDetail(id), loadJurisdictions(), loadContact().catch(() => null)]);
      setC(cc); setDetail(d); setJName(js.find((j) => j.code === cc.jurisdiction_code)?.name ?? cc.jurisdiction_code);
      if (contact) setMember({ firstName: contact.first_name, lastName: contact.last_name });
    } catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/record-relief')) as never);
      else setError('We could not load this case.');
    }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const docCase: ReliefCaseForDoc | null = useMemo(() => (c ? { ...c, jurisdiction_name: jName } : null), [c, jName]);
  const doneKey = useMemo(() => new Set((detail?.checklist ?? []).filter((x) => x.done).map((x) => x.kind + ':' + x.key)), [detail]);

  const run = async (fn: () => Promise<unknown>, title: string) => { setBusy(true); try { await fn(); await load(); } catch (e) { notify(title, reliefErrorMessage(e)); } finally { setBusy(false); } };

  async function makeDoc(spec: DocumentSpec, format: 'pdf' | 'docx') {
    setBusy(true);
    try { setGenerated(await generateFromSpec(spec, format)); } catch { notify('Could not create the document', 'Please try again.'); } finally { setBusy(false); }
  }

  async function buildPacket() {
    if (!docCase || !detail) return;
    setBusy(true); setPacketNote('');
    try {
      const specs = [buildCaseSummary(docCase, detail), buildFilingChecklist(docCase, detail), buildWorksheet(docCase, detail, member), buildFormsGuide(docCase, detail)];
      const docs: GeneratedDocument[] = [];
      for (let n = 0; n < specs.length; n++) docs.push(await generateFromSpec({ ...specs[n], subject: `${String(n + 1).padStart(2, '0')} ${specs[n].subject}` }, 'pdf', { position: n + 1, total: specs.length }));
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      docs.forEach((d) => zip.file(d.fileName, d.bytes));
      const bytes = await zip.generateAsync({ type: 'uint8array' });
      const now = new Date();
      const name = `FairPath_Record_Relief_Packet_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.zip`;
      const r = await deliver(platform === 'web' ? 'download' : 'share', { bytes, fileName: name, mime: 'application/zip', format: 'zip' });
      if (r.ok) { docs.forEach((x) => void logDocumentExport(x.row.id, platform === 'web' ? 'download' : 'share_sheet_opened', platform)); setPacketNote(`Packet created: ${docs.length} documents. FairPath does not file anything. Review every page, and confirm the current forms and fees with the court clerk.`); }
      else setPacketNote(r.message ?? 'The packet was created but could not be saved or shared on this device.');
    } catch { notify('Could not build the packet', 'Please try again.'); } finally { setBusy(false); }
  }

  if (error) return <ScreenFrame><PageHeader eyebrow="RECORD RELIEF" title="Case" backTo="/record-relief" alwaysBackTo /><View style={{ paddingHorizontal: L.mobileGutter }}><StatusLine tone="error">{error}</StatusLine></View></ScreenFrame>;
  if (!c || !detail || !docCase) return <ScreenFrame><PageHeader eyebrow="RECORD RELIEF" title="Case" backTo="/record-relief" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  const evs = detail.evaluations;
  const openLink = (url: string | null | undefined) => { if (url) void Linking.openURL(url); };
  const steps = new Map<string, { key: string; title: string; body?: string }>();
  const docsNeeded = new Map<string, { key: string; label: string }>();
  for (const e of evs) if (e.rule && e.outcome !== 'potentially_ineligible') { e.rule.steps.forEach((x) => steps.set(x.key, x)); e.rule.required_documents.forEach((x) => docsNeeded.set(x.key, x)); }

  return (
    <ScreenFrame>
      <PageHeader eyebrow={jName.toUpperCase()} title={c.label} backTo="/record-relief" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 56 }}>
        <Panel tone="warning"><BodyText muted>{DISCLAIMER}</BodyText></Panel>

        <View style={s.block}><SectionTitle>ELIGIBILITY REVIEW</SectionTitle></View>
        {evs.length === 0 ? <Panel><BodyText>This case has not been checked yet.</BodyText><PrimaryButton label="CHECK NOW" onPress={() => void run(() => reevaluateCase(c.id), 'Could not check')} busy={busy} /></Panel> : null}
        {evs.map((e: ReliefEvaluation) => {
          const info = OUTCOME_INFO[e.outcome];
          const count = countdownText(e.outcome, e.eligibility_date, e.days_remaining);
          return (
            <Panel key={e.id} tone={info.tone === 'good' ? 'accent' : info.tone === 'warn' ? 'warning' : undefined}>
              {e.rule ? <Text style={s.ruleTitle}>{e.rule.title}{e.remedy ? ` · ${REMEDY_LABEL[e.remedy] ?? e.remedy}` : ''}</Text> : null}
              <View style={s.badgeRow}><InlineBadge tone={info.tone === 'good' ? 'lime' : 'default'}>{info.label}</InlineBadge>{e.rule?.data_origin === 'dev_fixture' ? <InlineBadge>TEST DATA · NOT REAL LAW</InlineBadge> : null}</View>
              {count ? <Text style={s.countdown}>{count}</Text> : null}
              {e.outcome === 'waiting_period' && e.inputs_used.anchor_date && e.inputs_used.waiting_anchor ? <BodyText muted>Counted from {ANCHOR_LABEL[String(e.inputs_used.waiting_anchor)] ?? 'a date you entered'} ({String(e.inputs_used.anchor_date)}) under rule version {e.rule_version}.</BodyText> : null}
              {e.reasons.map((r, k) => <BodyText key={k}>{r.text}</BodyText>)}
              {e.missing_inputs.length ? (
                <View><BodyText strong>What FairPath still needs:</BodyText>{e.missing_inputs.map((m) => <BodyText key={m} muted>• {MISSING_LABEL[m] ?? m.replace(/_/g, ' ')}</BodyText>)}<SecondaryButton label="ADD MISSING INFORMATION" onPress={() => router.push(('/record-relief/add?id=' + c.id) as never)} /></View>
              ) : null}
              {ruleChangedNotice(e.rule_changed) ? <View><StatusLine tone="warning">{ruleChangedNotice(e.rule_changed)}</StatusLine><SecondaryButton label="RE-CHECK WITH THE CURRENT RULE" onPress={() => void run(() => reevaluateCase(c.id), 'Could not re-check')} /></View> : null}
              {staleRuleNotice(e.rule_stale, e.rule?.last_verified_at ?? null) ? <StatusLine tone="warning">{staleRuleNotice(e.rule_stale, e.rule?.last_verified_at ?? null)}</StatusLine> : null}
              {e.rule ? (
                <View style={s.source}>
                  <BodyText muted>Source: {e.rule.citation_text}</BodyText>
                  <BodyText muted>Rule version {e.rule.rule_version} · effective {e.rule.effective_from} · last verified {e.rule.last_verified_at ?? 'unknown'}</BodyText>
                  <TextButton label="OPEN THE SOURCE" onPress={() => openLink(e.rule?.source_url)} />
                </View>
              ) : null}
            </Panel>
          );
        })}
        {evs.length ? <SecondaryButton label="RE-CHECK THIS CASE" onPress={() => void run(() => reevaluateCase(c.id), 'Could not re-check')} disabled={busy} /> : null}

        {detail.pathways.length ? (
          <>
            <View style={s.block}><SectionTitle>FEDERAL PATHWAYS LISTED BY FAIRPATH</SectionTitle></View>
            <Panel tone="warning"><BodyText>These are not state expungement, and none of them is a general federal expungement. Talk to a lawyer or legal aid organization before relying on any of them.</BodyText></Panel>
            {detail.pathways.map((p) => (
              <Panel key={p.title}>
                <Text style={s.ruleTitle}>{p.title}</Text>{p.data_origin === 'dev_fixture' ? <InlineBadge>TEST DATA</InlineBadge> : null}
                <BodyText>{p.description}</BodyText><BodyText muted>{p.citation_text} · last verified {p.last_verified_at ?? 'unknown'}</BodyText>
                <TextButton label="OPEN THE SOURCE" onPress={() => openLink(p.source_url)} />
              </Panel>
            ))}
          </>
        ) : null}
        {c.jurisdiction_code === 'US-FED' && detail.pathways.length === 0 ? <Panel><BodyText>FairPath does not have verified federal pathway information loaded yet. You can still track this case and export a summary.</BodyText></Panel> : null}

        {steps.size || docsNeeded.size ? (
          <>
            <View style={s.block}><SectionTitle>STEPS AND DOCUMENTS</SectionTitle></View>
            {[...steps.values()].map((st) => (
              <Pressable key={st.key} accessibilityRole="checkbox" accessibilityState={{ checked: doneKey.has('step:' + st.key) }} style={s.checkRow} onPress={() => void run(() => toggleChecklist(c.id, 'step', st.key, !doneKey.has('step:' + st.key)), 'Could not save')}>
                <View style={[s.box, doneKey.has('step:' + st.key) && s.boxOn]} /><View style={{ flex: 1 }}><BodyText strong>{st.title}</BodyText>{st.body ? <BodyText muted>{st.body}</BodyText> : null}</View>
              </Pressable>
            ))}
            {[...docsNeeded.values()].map((d) => (
              <Pressable key={d.key} accessibilityRole="checkbox" accessibilityState={{ checked: doneKey.has('document:' + d.key) }} style={s.checkRow} onPress={() => void run(() => toggleChecklist(c.id, 'document', d.key, !doneKey.has('document:' + d.key)), 'Could not save')}>
                <View style={[s.box, doneKey.has('document:' + d.key) && s.boxOn]} /><View style={{ flex: 1 }}><BodyText strong>Have: {d.label}</BodyText></View>
              </Pressable>
            ))}
          </>
        ) : null}

        {evs.some((e) => e.rule && e.outcome !== 'potentially_ineligible') ? (
          <>
            <View style={s.block}><SectionTitle>FEES AND WHERE TO FILE</SectionTitle></View>
            {evs.filter((e) => e.rule && e.outcome !== 'potentially_ineligible').map((e) => {
              const f = e.rule!.fees as { court_fee_cents?: number; fee_waiver_available?: boolean; note?: string };
              const fl = e.rule!.filing as { where_text?: string; instructions_text?: string; court_type?: string };
              return (
                <Panel key={e.id}>
                  <BodyText strong>{e.rule!.title}</BodyText>
                  <BodyText>{typeof f.court_fee_cents === 'number' ? `Court fee: $${(f.court_fee_cents / 100).toFixed(2)}${e.rule!.data_origin === 'dev_fixture' ? ' (TEST value)' : ''}` : 'Court fee: not listed. Ask the clerk. FairPath does not estimate fees.'}</BodyText>
                  <BodyText muted>{f.fee_waiver_available === true ? 'A fee waiver is available under this rule.' : f.fee_waiver_available === false ? 'No fee waiver is listed.' : 'Fee waiver information is not listed.'}</BodyText>
                  {fl.where_text ? <BodyText muted>Where: {fl.where_text}</BodyText> : null}{fl.instructions_text ? <BodyText muted>{fl.instructions_text}</BodyText> : null}
                </Panel>
              );
            })}
          </>
        ) : null}

        <View style={s.block}><SectionTitle>FORMS</SectionTitle></View>
        {detail.forms.length === 0 ? <Panel><BodyText>FairPath has no verified forms for {jName} yet. The court clerk or a legal aid organization can tell you which forms apply. FairPath never invents a court form.</BodyText></Panel> : null}
        {detail.forms.map((f) => (
          <Panel key={f.form_key}>
            <View style={s.badgeRow}>{f.kind === 'official_form' ? <InlineBadge tone="lime">OFFICIAL FORM · VERIFIED SOURCE</InlineBadge> : <InlineBadge>{f.kind === 'fee_waiver_form' ? 'FEE WAIVER FORM' : 'INSTRUCTIONS'}</InlineBadge>}{f.data_origin === 'dev_fixture' ? <InlineBadge>TEST DATA</InlineBadge> : null}</View>
            <Text style={s.ruleTitle}>{f.name}</Text>
            <BodyText muted>{f.revision ? `Revision ${f.revision}` : 'No revision listed'}{f.effective_date ? ` · effective ${f.effective_date}` : ''} · last verified {f.last_verified_at ?? 'unknown'}</BodyText>
            <BodyText muted>{f.auto_fillable ? 'FairPath can prepare this form from information you confirm.' : 'FairPath does not fill this form. Use the prepared-information worksheet to organize your answers.'}</BodyText>
            <TextButton label="OPEN THE OFFICIAL SOURCE" onPress={() => openLink(f.official_source_url)} />
          </Panel>
        ))}

        <View style={s.block}><SectionTitle>DOCUMENTS</SectionTitle></View>
        <BodyText muted>These contain sensitive information. FairPath does not keep the files unless you ask, and only you can open them.</BodyText>
        <SecondaryButton label="CASE SUMMARY (PDF)" onPress={() => void makeDoc(buildCaseSummary(docCase, detail), 'pdf')} disabled={busy} />
        <SecondaryButton label="FILING CHECKLIST (PDF)" onPress={() => void makeDoc(buildFilingChecklist(docCase, detail), 'pdf')} disabled={busy} />
        <SecondaryButton label="FILING CHECKLIST (WORD, EDITABLE)" onPress={() => void makeDoc(buildFilingChecklist(docCase, detail), 'docx')} disabled={busy} />
        <SecondaryButton label="PREPARED-INFORMATION WORKSHEET (WORD)" onPress={() => void makeDoc(buildWorksheet(docCase, detail, member), 'docx')} disabled={busy} />
        <SecondaryButton label="FORMS AND FILING GUIDE (PDF)" onPress={() => void makeDoc(buildFormsGuide(docCase, detail), 'pdf')} disabled={busy} />
        <PrimaryButton label="BUILD MY FILING PACKET (4 DOCUMENTS)" onPress={() => void buildPacket()} busy={busy} />
        {packetNote ? <StatusLine tone="muted">{packetNote}</StatusLine> : null}
        {generated ? <ExportPanel result={generated} onChange={setGenerated} onDeleted={() => setGenerated(null)} /> : null}

        <View style={s.block}><SectionTitle>FILING STATUS (YOU ENTER THIS)</SectionTitle></View>
        <BodyText muted>FairPath does not file anything and is not connected to any court. This only tracks what you tell it.</BodyText>
        <ChipGroup single options={FILING_STATUS_OPTIONS} selected={[c.filing_status]} onChange={(n) => n[0] && void run(() => setCaseStatus(c.id, n[0], isoFromText(filedText)), 'Could not save')} />
        <FairPathDatePicker label="DATE FILED" value={filedText} onChange={setFiledText} kind="past" optional />

        <View style={s.block}><SectionTitle>HISTORY</SectionTitle></View>
        {detail.events.map((e, k) => <BodyText key={k} muted>{new Date(e.created_at).toLocaleDateString()} · {e.event_type.replace(/_/g, ' ')}{e.detail ? ` (${e.detail})` : ''}</BodyText>)}

        <SecondaryButton label="EDIT CASE DETAILS" onPress={() => router.push(('/record-relief/add?id=' + c.id) as never)} />
        <SecondaryButton tone="danger" label="DELETE THIS CASE" onPress={() => notify('Delete this case?', 'This removes the case, its results and its history from FairPath. Files you already exported stay where they are.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteCase(c.id).then(() => router.replace('/record-relief' as never)).catch((e) => notify('Could not delete', reliefErrorMessage(e))) }])} />
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  block: { marginTop: 22 },
  ruleTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 15, marginBottom: 6 },
  badgeRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 },
  countdown: { color: t.accentText, fontFamily: F.black, fontSize: 17, lineHeight: 22, marginVertical: 6 },
  source: { borderTopWidth: 1, borderTopColor: t.border, marginTop: 10, paddingTop: 8 },
  checkRow: { flexDirection: 'row' as const, gap: 12, alignItems: 'flex-start' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  box: { width: 18, height: 18, borderWidth: 1, borderColor: t.text, marginTop: 2 },
  boxOn: { backgroundColor: t.accent, borderColor: t.accent },
});
