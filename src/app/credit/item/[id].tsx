import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, Field, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { ISSUE_LABEL, PAYMENT_STATUS_LABEL, STAGE_INFO, formatCents } from '@/core/credit/credit-format';
import { creditErrorMessage, loadAccount, loadItem, setItemStage, type CreditAccount, type ReviewItem } from '@/core/credit/credit-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

/** Plain-language rendering of the rule evidence (never raw JSON). */
function evidenceLines(item: ReviewItem): string[] {
  const e = item.evidence as Record<string, unknown>;
  const out: string[] = [];
  if (e.this_report_balance_cents != null) out.push(`This report: ${formatCents(e.this_report_balance_cents as number)}. Other report: ${formatCents(e.other_report_balance_cents as number)}.`);
  if (e.this_report_status && e.other_report_status) out.push(`This report: ${PAYMENT_STATUS_LABEL[String(e.this_report_status)] ?? e.this_report_status}. Other report: ${PAYMENT_STATUS_LABEL[String(e.other_report_status)] ?? e.other_report_status}.`);
  if (e.opened_date || e.closed_date) out.push(`Opened ${e.opened_date ?? '—'} · Closed ${e.closed_date ?? '—'} · Last reported ${e.last_reported_date ?? '—'}`);
  if (e.first_delinquency_date) out.push(`First delinquency: ${e.first_delinquency_date}`);
  if (e.payment_status && item.issue_type === 'negative_item') out.push(`Status: ${PAYMENT_STATUS_LABEL[String(e.payment_status)] ?? e.payment_status} · Balance ${formatCents(e.balance_cents as number)}`);
  if (Array.isArray(e.fields) && e.fields.length) out.push(`Hard to read: ${(e.fields as string[]).map((f) => f.replace(/_/g, ' ')).join(', ')}`);
  return out;
}

export default function CreditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useFairPathTheme();
  const [item, setItem] = useState<ReviewItem | null>(null);
  const [account, setAccount] = useState<CreditAccount | null>(null);
  const [statement, setStatement] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const it = await loadItem(id);
      setItem(it);
      setAccount(it.account_id ? await loadAccount(it.account_id) : null);
    } catch { setError('We could not load this item.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function move(stage: Parameters<typeof setItemStage>[1], text?: string) {
    if (!item) return;
    setBusy(true);
    try { await setItemStage(item.id, stage, text); setAsking(false); setStatement(''); await load(); } catch (e) { notify('Could not update', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  if (error) return <ScreenFrame><PageHeader eyebrow="CREDIT REVIEW" title="Item" backTo="/credit" alwaysBackTo /><View style={{ paddingHorizontal: L.mobileGutter }}><StatusLine tone="error">{error}</StatusLine></View></ScreenFrame>;
  if (!item) return <ScreenFrame><PageHeader eyebrow="CREDIT REVIEW" title="Item" backTo="/credit" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  const info = STAGE_INFO[item.stage];
  const lines = evidenceLines(item);

  return (
    <ScreenFrame>
      <PageHeader eyebrow={ISSUE_LABEL[item.issue_type]?.toUpperCase() ?? 'REVIEW'} title="Review item" backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
          <InlineBadge tone={item.stage === 'confirmed_dispute_issue' ? 'lime' : 'default'}>{info.label}</InlineBadge>
          {item.origin === 'member' ? <InlineBadge>YOUR CLAIM</InlineBadge> : <InlineBadge>FAIRPATH RULE CHECK</InlineBadge>}
        </View>
        <BodyText strong>{item.title}</BodyText>
        <Panel><BodyText>{item.explanation}</BodyText>{lines.map((l, k) => <BodyText key={k} muted>{l}</BodyText>)}</Panel>
        <Panel tone={item.stage === 'negative_item' ? 'warning' : undefined}><BodyText muted>{info.explain}</BodyText></Panel>

        {account ? <ListRow title={account.furnisher_name + (account.account_last4 ? ` ····${account.account_last4}` : '')} body="Open the account to confirm or correct its details" onPress={() => router.push(('/credit/account/' + account.id) as never)} /> : null}

        {item.member_statement ? <><View style={{ marginTop: 18 }}><SectionTitle>IN YOUR WORDS</SectionTitle></View><Panel><BodyText>{item.member_statement}</BodyText></Panel></> : null}

        {(item.stage === 'negative_item' || item.stage === 'possible_inaccuracy') && !asking ? (
          <>
            <PrimaryButton label={item.stage === 'negative_item' ? 'I BELIEVE SOMETHING ON THIS IS WRONG' : 'YES, SOMETHING HERE IS INACCURATE'} onPress={() => setAsking(true)} />
            <SecondaryButton label={item.stage === 'negative_item' ? 'IT IS ACCURATE. DISMISS.' : 'IT IS ACCURATE, OR NOT A PROBLEM'} onPress={() => void move('dismissed')} />
          </>
        ) : null}
        {asking ? (
          <>
            <Field label="WHAT, EXACTLY, IS WRONG?" value={statement} onChangeText={setStatement} multiline maxLength={1500} hint="Be specific and factual, for example: the balance is $250 but I paid it off in March. FairPath cannot verify this. It is your statement, and it is what a letter will say." />
            <PrimaryButton label="SAVE MY STATEMENT" onPress={() => void move('member_disputes_accuracy', statement)} busy={busy} disabled={statement.trim().length < 10} />
            <SecondaryButton label="CANCEL" onPress={() => setAsking(false)} />
          </>
        ) : null}

        {item.stage === 'member_disputes_accuracy' ? (
          <>
            <Panel tone="warning"><BodyText>Confirm only if you are sure this information is inaccurate. Disputing accurate information can waste your time and does not help.</BodyText></Panel>
            <PrimaryButton label="I CONFIRM THIS IS INACCURATE" onPress={() => void move('confirmed_dispute_issue')} busy={busy} />
            <SecondaryButton label="I CHANGED MY MIND" onPress={() => void move('reopen')} />
          </>
        ) : null}
        {item.stage === 'confirmed_dispute_issue' ? (
          <>
            <PrimaryButton label="START A DISPUTE WITH THIS ISSUE" onPress={() => router.push(('/credit/new-dispute?item=' + item.id) as never)} />
            <StatusLine tone="muted">There is no guarantee about the result of any dispute.</StatusLine>
          </>
        ) : null}
        {item.stage === 'dismissed' ? <SecondaryButton label="REOPEN" onPress={() => void move('reopen')} /> : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
