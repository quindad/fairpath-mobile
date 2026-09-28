import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { ExportPanel } from '@/components/ExportPanel';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { SpecPreview } from '@/components/SpecPreview';
import { BodyText, ChipGroup, Field, Panel, PrimaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { creditErrorMessage } from '@/core/credit/credit-service';
import {
  STANDARD_LETTER_ENCLOSURES, buildIdentityCorrectionLetter, identityLetterProblems, type IdentityCorrectionField, type LetterFields,
} from '@/core/documents/builders/credit';
import { generateFromSpec, type GeneratedDocument } from '@/core/documents/generate';
import { loadContact } from '@/core/profile/opportunity-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

const todayText = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const BUREAUS = [{ value: 'Equifax', label: 'Equifax' }, { value: 'Experian', label: 'Experian' }, { value: 'TransUnion', label: 'TransUnion' }];
const FIELD_LABELS = ['Name', 'Current address', 'Former address', 'Date of birth', 'Employer on file', 'Social Security number (last 4)'];

/**
 * A separate flow from a dispute: this is for a bureau's PERSONAL information about the member being wrong (name,
 * address, DOB, etc.), not an account. Nothing here is inferred from anywhere else in FairPath — every "correct"
 * value is what the member types on this screen, and nothing is sent until they choose to export and mail it.
 */
export default function CorrectIdentity() {
  const { tokens } = useFairPathTheme();
  const [bureau, setBureau] = useState<string[]>(['Equifax']);
  const [rows, setRows] = useState<IdentityCorrectionField[]>(FIELD_LABELS.map((label) => ({ label, current: '', correct: '' })));
  const [fields, setFields] = useState<LetterFields>({ senderName: '', senderAddress: '', senderPhone: '', recipientAddress: '', dateText: todayText(), enclosures: STANDARD_LETTER_ENCLOSURES.slice(0, 2) });
  const [showProblems, setShowProblems] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadContact().then((c) => c && setFields((f) => ({ ...f, senderName: f.senderName || `${c.first_name} ${c.last_name}`.trim(), senderPhone: f.senderPhone || (c.phone ?? '') }))).catch(() => undefined);
  }, []);

  const set = (p: Partial<LetterFields>) => setFields((f) => ({ ...f, ...p }));
  const setRow = (i: number, p: Partial<IdentityCorrectionField>) => setRows((r) => r.map((row, n) => (n === i ? { ...row, ...p } : row)));
  const problems = useMemo(() => identityLetterProblems(bureau[0] ?? '', rows, fields), [bureau, rows, fields]);
  const spec = useMemo(() => buildIdentityCorrectionLetter(bureau[0] ?? '', rows, fields), [bureau, rows, fields]);

  async function make(format: 'pdf' | 'docx') {
    setShowProblems(true);
    if (problems.length) return;
    setBusy(true);
    try { setGenerated(await generateFromSpec(spec, format)); } catch (e) { notify('Could not create the letter', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="CREDIT" title="Correct my personal information" backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <Panel><BodyText muted>Use this when a bureau has your name, address, date of birth or other personal information wrong — not for a specific account. FairPath never sends anything for you.</BodyText></Panel>
        <ChipGroup single label="WHO WILL YOU SEND IT TO?" options={BUREAUS} selected={bureau} onChange={(n) => setBureau(n.length ? n : bureau)} />
        <View style={{ marginTop: 14 }}><SectionTitle>WHAT IS WRONG</SectionTitle></View>
        {rows.map((row, i) => (
          <View key={row.label} style={{ marginBottom: 4 }}>
            <Field label={row.label.toUpperCase() + ' — ON FILE (OPTIONAL)'} value={row.current} onChangeText={(v) => setRow(i, { current: v })} />
            <Field label={row.label.toUpperCase() + ' — CORRECT'} value={row.correct} onChangeText={(v) => setRow(i, { correct: v })} />
          </View>
        ))}
        <View style={{ marginTop: 14 }}><SectionTitle>YOUR CONTACT INFORMATION</SectionTitle></View>
        <Field label="YOUR NAME" value={fields.senderName} onChangeText={(v) => set({ senderName: v })} />
        <Field label="YOUR MAILING ADDRESS" value={fields.senderAddress} onChangeText={(v) => set({ senderAddress: v })} multiline />
        <Field label="YOUR PHONE" value={fields.senderPhone} onChangeText={(v) => set({ senderPhone: v })} />
        <Field label={`${bureau[0] ?? 'RECIPIENT'} MAILING ADDRESS`} value={fields.recipientAddress} onChangeText={(v) => set({ recipientAddress: v })} multiline hint="Find the current dispute address on the bureau's own website." />
        {showProblems && problems.length ? <StatusLine tone="error">{problems[0]}</StatusLine> : null}
        <SpecPreview title={spec.title} blocks={spec.blocks} footer={spec.footer} />
        <PrimaryButton label="CREATE PDF LETTER" onPress={() => void make('pdf')} busy={busy} />
        <PrimaryButton label="CREATE DOCX LETTER" onPress={() => void make('docx')} busy={busy} />
        {generated ? <ExportPanel result={generated} onChange={setGenerated} onDeleted={() => setGenerated(null)} /> : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
