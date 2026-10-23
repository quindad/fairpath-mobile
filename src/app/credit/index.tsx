import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle, SharpChip, FilterStrip } from '@/components/ProductChrome';
import { BodyText, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { CREDIT_EDUCATION } from '@/core/credit/credit-education';
import {
  BUREAU_LABEL, EXTRACTION_LABEL, ISSUE_LABEL, PAYMENT_STATUS_LABEL, STAGE_INFO, bureauName, dateLabel, dueLabel, formatCents, sortAccountsForReview, DISPUTE_STATUS_LABEL,
} from '@/core/credit/credit-format';
import {
  creditErrorMessage, deleteUpload, extendUploadRetention, loadAccounts, loadDisputes, loadItems, loadReports, loadSampleReports, loadUploads, pickReportFile, readUploadedReport, uploadReportFile,
  type CreditAccount, type CreditReport, type Dispute, type ReviewItem, type Upload,
} from '@/core/credit/credit-service';
import { explainCreditReport } from '@/core/ai/signal';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';
import { CreditStudioHome } from '@/components/credit/CreditStudioHome';

type Tab = 'studio' | 'accounts' | 'review' | 'disputes' | 'learn';
const TABS: { tab: Tab; label: string }[] = [{ tab: 'studio', label: 'Studio' }, { tab: 'accounts', label: 'Accounts' }, { tab: 'review', label: 'Review' }, { tab: 'disputes', label: 'Disputes' }, { tab: 'learn', label: 'Learn' }];

export default function CreditWorkspace() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('studio');
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
  const [signalText, setSignalText] = useState('');
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalRequested, setSignalRequested] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [r, a, i, d, u] = await Promise.all([loadReports(), loadAccounts(), loadItems(), loadDisputes(), loadUploads()]);
      setReports(r); setAccounts(a); setItems(i); setDisputes(d); setUploads(u); setLoaded(true);
    } catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/credit')) as never);
      else { setLoaded(false); setError('We could not load your credit workspace. Check your connection and try again.'); }
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
  /** LOAD SAMPLE (DEV) — only wired when __DEV__; production builds never call loadSampleReports. */
  async function sample() {
    if (!__DEV__) return;
    setBusy(true);
    try { await loadSampleReports(); setNote('Sample reports loaded. These are TEST DATA, not a real person.'); await load(); } catch (e) { notify('Could not load samples', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  async function askSignalAboutReport() {
    if (signalLoading) return;
    setSignalLoading(true); setSignalRequested(true);
    try {
      const r = await explainCreditReport();
      if (r.status === 'ok') setSignalText(r.text);
      else if (r.status === 'out_of_credits') setSignalText('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setSignalText('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') { router.replace(('/sign-in?returnTo=' + encodeURIComponent('/credit')) as never); return; }
      else setSignalText(r.message);
    } catch { setSignalText('Signal could not explain your report right now. Please try again.'); }
    finally { setSignalLoading(false); }
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
      <PageHeader eyebrow="FAIRPATH · FINANCIAL WELLNESS" title="Credit Studio" backTo="/home" />
      <FilterStrip>
        {TABS.map((t) => <SharpChip key={t.tab} label={t.label} active={tab === t.tab} onPress={() => setTab(t.tab)} />)}
      </FilterStrip>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, width >= 768 && s.contentWide, { maxWidth: width >= 1024 ? 800 : undefined, alignSelf: 'center' as const, width: '100%' as const }]}>
        {!loaded && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}

        {loaded && tab === 'studio' ? (
          <CreditStudioHome
            reports={reports}
            accounts={accounts}
            items={items}
            disputes={disputes}
            uploads={uploads}
            toConfirm={toConfirm}
            open={open}
            confirmed={confirmed}
            activeDisputes={activeDisputes}
            dueSoon={dueSoon}
            bureau={bureau}
            onBureauChange={setBureau}
            busy={busy}
            note={note}
            signalRequested={signalRequested}
            signalLoading={signalLoading}
            signalText={signalText}
            onUpload={() => void pickAndUpload()}
            onSample={__DEV__ ? () => void sample() : undefined}
            onAskSignal={() => void askSignalAboutReport()}
            onGoAccounts={() => setTab('accounts')}
            onGoReview={() => setTab('review')}
            onGoDisputes={() => setTab('disputes')}
            onGoLearn={() => setTab('learn')}
            uploadStatus={uploadStatus}
            onReadUpload={confirmAndRead}
            onExtendUpload={(id) => void extendUploadRetention(id, 90).then(load).catch((e) => notify('Could not extend', creditErrorMessage(e)))}
            onDeleteUpload={(u) =>
              notify('Delete this file?', 'The file is removed. Accounts you already reviewed stay until you delete the report.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void deleteUpload(u.id).then(load).catch((e) => notify('Could not delete', creditErrorMessage(e))) },
              ])
            }
          />
        ) : null}

        {loaded && tab === 'accounts' ? (
          <>
            {toConfirm.length ? <Panel tone="warning"><BodyText strong>{toConfirm.length} account{toConfirm.length === 1 ? '' : 's'} need your review</BodyText><BodyText muted>Reading a report is never perfectly reliable. Confirm or correct each one.</BodyText></Panel> : null}
            {accounts.length === 0 ? <EmptyState title="No accounts yet" body="Upload a report or enter accounts yourself from the Studio tab." /> : null}
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
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 40, gap: 4 },
  contentWide: { paddingHorizontal: 28 },
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
