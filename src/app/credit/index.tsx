import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle, SharpChip, FilterStrip } from '@/components/ProductChrome';
import { BodyText, ChipGroup, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { CREDIT_EDUCATION } from '@/core/credit/credit-education';
import {
  BUREAU_LABEL, EXTRACTION_LABEL, ISSUE_LABEL, PAYMENT_STATUS_LABEL, STAGE_INFO, bureauName, dateLabel, dueLabel, formatCents, sortAccountsForReview, DISPUTE_STATUS_LABEL,
} from '@/core/credit/credit-format';
import {
  creditErrorMessage, deleteUpload, extendUploadRetention, loadAccounts, loadDisputes, loadItems, loadReports, loadSampleReports, loadUploads, pickReportFile, readUploadedReport, uploadReportFile,
  type CreditAccount, type CreditReport, type Dispute, type ReviewItem, type Upload,
} from '@/core/credit/credit-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

type Tab = 'overview' | 'accounts' | 'review' | 'disputes' | 'learn';
const TABS: { tab: Tab; label: string }[] = [{ tab: 'overview', label: 'Overview' }, { tab: 'accounts', label: 'Accounts' }, { tab: 'review', label: 'Review' }, { tab: 'disputes', label: 'Disputes' }, { tab: 'learn', label: 'Learn' }];

export default function CreditWorkspace() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [tab, setTab] = useState<Tab>('overview');
  const [reports, setReports] = useState<CreditReport[]>([]);
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [bureau, setBureau] = useState<string[]>(['unknown']);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [r, a, i, d, u] = await Promise.all([loadReports(), loadAccounts(), loadItems(), loadDisputes(), loadUploads()]);
      setReports(r); setAccounts(a); setItems(i); setDisputes(d); setUploads(u); setLoaded(true);
    } catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/credit')) as never);
      else setError('We could not load your credit workspace. Check your connection and try again.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toConfirm = useMemo(() => accounts.filter((a) => a.extraction_state === 'needs_review' || a.extraction_state === 'extracted'), [accounts]);
  const open = useMemo(() => items.filter((i) => i.stage === 'possible_inaccuracy'), [items]);
  const negative = useMemo(() => items.filter((i) => i.stage === 'negative_item'), [items]);
  const claimed = useMemo(() => items.filter((i) => i.stage === 'member_disputes_accuracy'), [items]);
  const confirmed = useMemo(() => items.filter((i) => i.stage === 'confirmed_dispute_issue'), [items]);
  const dismissed = useMemo(() => items.filter((i) => i.stage === 'dismissed'), [items]);
  const activeDisputes = disputes.filter((d) => ['draft', 'sent', 'response_received'].includes(d.status));
  const dueSoon = disputes.filter((d) => d.status === 'sent' && ['soon', 'overdue'].includes(dueLabel(d.response_due_on, d.status).tone));
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.furnisher_name ?? '';

  const next = !reports.length && !uploads.length ? { title: 'Add a credit report', body: 'Upload a report you downloaded, or enter your accounts yourself.' }
    : toConfirm.length ? { title: `Review ${toConfirm.length} account${toConfirm.length === 1 ? '' : 's'}`, body: 'Confirm or correct what was read so nothing is built on a mistake.', go: () => setTab('accounts') }
    : open.length ? { title: `Look at ${open.length} possible issue${open.length === 1 ? '' : 's'}`, body: 'These are questions for you, not findings.', go: () => setTab('review') }
    : confirmed.length && !disputes.length ? { title: 'Start a dispute', body: 'You confirmed an issue. You can prepare a letter from it.', go: () => router.push('/credit/new-dispute' as never) }
    : dueSoon.length ? { title: 'A dispute response needs attention', body: dueLabel(dueSoon[0].response_due_on, dueSoon[0].status).text, go: () => router.push(('/credit/dispute/' + dueSoon[0].id) as never) }
    : null;

  async function pickAndUpload() {
    setBusy(true); setNote('');
    try {
      const file = await pickReportFile();
      if (!file) return;
      await uploadReportFile(file, bureau[0] ?? 'unknown');
      setNote('Uploaded privately. You can try reading it automatically below, or add the accounts you want to review yourself.');
      await load();
    } catch (e) { notify('Could not upload', creditErrorMessage(e)); } finally { setBusy(false); }
  }
  async function sample() {
    setBusy(true);
    try { await loadSampleReports(); setNote('Sample reports loaded. These are TEST DATA, not a real person.'); await load(); } catch (e) { notify('Could not load samples', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  const uploadStatus = (u: Upload) => u.status === 'uploaded' ? 'Stored privately.' : u.status === 'processing' ? 'Reading now…' : u.status === 'needs_review' ? 'Read. Review the accounts below.' : u.status === 'failed' ? 'Could not be read automatically. Add the accounts yourself.' : u.status;

  function confirmAndRead(u: Upload) {
    notify(
      'Read this file with FairPath?',
      'FairPath will send this file to a reading service to find the accounts on it. Nothing found is trusted until you confirm it yourself, and the file stays private either way.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Read it', onPress: () => void doRead(u) }],
    );
  }
  async function doRead(u: Upload) {
    setBusy(true);
    try {
      const r = await readUploadedReport(u.id, true);
      setNote(`Read ${r.accounts} account${r.accounts === 1 ? '' : 's'}${r.inquiries ? ` and ${r.inquiries} inquir${r.inquiries === 1 ? 'y' : 'ies'}` : ''}. Review each one before it counts as yours.`);
      await load();
    } catch (e) { notify('Could not read this file', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FAIRPATH+ · CREDIT" title="Credit Builder" backTo="/home" />
      <FilterStrip>
        {TABS.map((t) => <SharpChip key={t.tab} label={t.label} active={tab === t.tab} onPress={() => setTab(t.tab)} />)}
      </FilterStrip>
      <ScrollView contentContainerStyle={s.content}>
        {!loaded && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}

        {loaded && tab === 'overview' ? (
          <>
            <Panel><BodyText>Review your credit reports, decide what (if anything) is worth disputing, and track it to an outcome. FairPath does not predict scores and cannot promise that anything will be removed.</BodyText></Panel>
            {next ? (
              <Panel tone="accent">
                <Text style={s.eyebrow}>NEXT</Text>
                <Text style={s.nextTitle}>{next.title}</Text>
                <BodyText>{next.body}</BodyText>
                {'go' in next && next.go ? <PrimaryButton label="OPEN" onPress={next.go} /> : null}
              </Panel>
            ) : null}
            <View style={s.grid}>
              {[['REPORTS', reports.length], ['TO CONFIRM', toConfirm.length], ['POSSIBLE ISSUES', open.length], ['CONFIRMED', confirmed.length], ['ACTIVE DISPUTES', activeDisputes.length], ['DUE SOON', dueSoon.length]].map(([l, v]) => (
                <View key={String(l)} style={s.tile}><Text style={s.tileValue}>{String(v)}</Text><Text style={s.tileLabel}>{String(l)}</Text></View>
              ))}
            </View>

            <View style={s.block}><SectionTitle>ADD A REPORT</SectionTitle></View>
            <ChipGroup single label="WHICH BUREAU?" options={[{ value: 'equifax', label: 'Equifax' }, { value: 'experian', label: 'Experian' }, { value: 'transunion', label: 'TransUnion' }, { value: 'unknown', label: 'Not sure' }]} selected={bureau} onChange={(n) => setBureau(n.length ? n : ['unknown'])} />
            <PrimaryButton label="UPLOAD A PDF OR PHOTO" onPress={() => void pickAndUpload()} busy={busy} />
            <SecondaryButton label="ENTER ACCOUNTS MYSELF" onPress={() => router.push('/credit/add' as never)} />
            {__DEV__ ? <SecondaryButton label="LOAD SAMPLE REPORTS (DEV TEST DATA)" onPress={() => void sample()} disabled={busy} /> : null}
            {note ? <StatusLine tone="muted">{note}</StatusLine> : null}
            <BodyText muted>Files are stored privately in your account, only you can open them, and they are removed after 30 days unless you extend it. FairPath never sends a report to anyone.</BodyText>

            {uploads.length ? (
              <>
                <View style={s.block}><SectionTitle>YOUR UPLOADS</SectionTitle></View>
                {uploads.map((u) => (
                  <Panel key={u.id}>
                    <Text style={s.title}>{bureauName(u.bureau)} · {u.file_kind.toUpperCase()}{u.page_count ? ` · ${u.page_count} page${u.page_count === 1 ? '' : 's'}` : ''}</Text>
                    <BodyText muted>{uploadStatus(u)}</BodyText>
                    <BodyText muted>Removed on {dateLabel(u.expires_at)}</BodyText>
                    <View style={s.row}>
                      {u.status === 'uploaded' ? <TextButton label="READ AUTOMATICALLY" onPress={() => confirmAndRead(u)} /> : null}
                      <TextButton label="KEEP 90 DAYS" onPress={() => void extendUploadRetention(u.id, 90).then(load).catch((e) => notify('Could not extend', creditErrorMessage(e)))} />
                      <TextButton tone="danger" label="DELETE FILE" onPress={() => notify('Delete this file?', 'The file is removed. Accounts you already reviewed stay until you delete the report.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteUpload(u.id).then(load).catch((e) => notify('Could not delete', creditErrorMessage(e))) }])} />
                    </View>
                  </Panel>
                ))}
              </>
            ) : null}
            <View style={s.block}><SectionTitle>DOCUMENTS</SectionTitle></View>
            <ListRow title="Dispute history" body="Export your disputes, dates and outcomes" onPress={() => router.push('/documents/create-credit' as never)} />
            <ListRow title="Correct my personal information" body="Name, address or other details a bureau has wrong (not an account issue)" onPress={() => router.push('/credit/correct-identity' as never)} />
          </>
        ) : null}

        {loaded && tab === 'accounts' ? (
          <>
            {toConfirm.length ? <Panel tone="warning"><BodyText strong>{toConfirm.length} account{toConfirm.length === 1 ? '' : 's'} need your review</BodyText><BodyText muted>Reading a report is never perfectly reliable. Confirm or correct each one.</BodyText></Panel> : null}
            {accounts.length === 0 ? <EmptyState title="No accounts yet" body="Upload a report or enter accounts yourself on the Overview tab." /> : null}
            {reports.map((r) => {
              const list = sortAccountsForReview(accounts.filter((a) => a.report_id === r.id));
              if (!list.length) return null;
              return (
                <View key={r.id}>
                  <View style={s.block}><SectionTitle>{bureauName(r.bureau).toUpperCase()} · {r.report_date ? dateLabel(r.report_date) : 'DATE NOT SET'}{r.source === 'fixture' ? ' · TEST DATA' : ''}</SectionTitle></View>
                  {list.map((a) => {
                    const ex = EXTRACTION_LABEL[a.extraction_state];
                    return (
                      <ListRow key={a.id} title={a.furnisher_name + (a.account_last4 ? ` ····${a.account_last4}` : '')}
                        body={`${PAYMENT_STATUS_LABEL[a.payment_status] ?? a.payment_status} · balance ${formatCents(a.balance_cents)}`}
                        onPress={() => router.push(('/credit/account/' + a.id) as never)}
                        trailing={<InlineBadge tone={ex.tone === 'ok' ? 'lime' : 'default'}>{ex.label}</InlineBadge>} />
                    );
                  })}
                </View>
              );
            })}
          </>
        ) : null}

        {loaded && tab === 'review' ? (
          <>
            <Panel><BodyText muted>Four different things live here. A NEGATIVE ITEM is just negative information; if it is accurate it is not a reason to dispute. A POSSIBLE INACCURACY is a question for you. Only issues YOU confirm can go into a dispute.</BodyText></Panel>
            {items.length === 0 ? <EmptyState title="Nothing to review" body={reports.length ? 'FairPath did not flag anything on your reports.' : 'Add a report first.'} /> : null}
            {([['POSSIBLE INACCURACIES', open], ['YOU SAY THESE ARE INACCURATE', claimed], ['CONFIRMED ISSUES', confirmed], ['NEGATIVE ITEMS (INFORMATION)', negative], ['DISMISSED', dismissed]] as [string, ReviewItem[]][]).map(([title, list]) => list.length ? (
              <View key={title}>
                <View style={s.block}><SectionTitle>{title} · {list.length}</SectionTitle></View>
                {list.map((i) => <ListRow key={i.id} title={i.title} body={`${ISSUE_LABEL[i.issue_type] ?? i.issue_type}${accountName(i.account_id) ? ' · ' + accountName(i.account_id) : ''}`} meta={STAGE_INFO[i.stage].short + (i.origin === 'member' ? ' · your claim' : '')} onPress={() => router.push(('/credit/item/' + i.id) as never)} />)}
              </View>
            ) : null)}
          </>
        ) : null}

        {loaded && tab === 'disputes' ? (
          <>
            <PrimaryButton label="START A DISPUTE" onPress={() => router.push('/credit/new-dispute' as never)} disabled={!confirmed.length} />
            {!confirmed.length ? <StatusLine tone="muted">A dispute starts from an issue you confirmed on the Review tab.</StatusLine> : null}
            {disputes.length === 0 ? <EmptyState title="No disputes yet" body="When you send one, track its dates, response and outcome here." /> : null}
            {disputes.map((d) => {
              const due = dueLabel(d.response_due_on, d.status);
              return <ListRow key={d.id} title={d.target_name} body={`${DISPUTE_STATUS_LABEL[d.status]}${d.sent_on ? ' · sent ' + dateLabel(d.sent_on) : ''}`} meta={due.text || undefined} onPress={() => router.push(('/credit/dispute/' + d.id) as never)} />;
            })}
          </>
        ) : null}

        {loaded && tab === 'learn' ? (
          <>
            <Panel tone="warning"><BodyText>This is general education, not legal advice. The official sources linked on each card control. FairPath is not a credit repair company and cannot promise results.</BodyText></Panel>
            {CREDIT_EDUCATION.map((c) => (
              <Panel key={c.id}>
                <Text style={s.title}>{c.title}</Text>
                <BodyText>{c.body}</BodyText>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(c.source.url)}><Text style={s.link}>OFFICIAL SOURCE: {c.source.label.toUpperCase()} →</Text></Pressable>
              </Panel>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 40 },
  spinner: { marginTop: 28 },
  block: { marginTop: 22 },
  eyebrow: { color: t.accentText, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.4 },
  nextTitle: { color: t.text, fontFamily: F.black, fontSize: 20, lineHeight: 24, marginVertical: 6 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 15, marginBottom: 4 },
  link: { color: t.accentText, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.6, marginTop: 8 },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginHorizontal: -4, marginTop: 12 },
  tile: { width: '33.333%' as const, padding: 4 },
  tileValue: { color: t.text, fontFamily: F.black, fontSize: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 10, paddingTop: 10 },
  tileLabel: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 0.8, borderWidth: 1, borderTopWidth: 0, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
});
