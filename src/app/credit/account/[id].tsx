import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FairPathDatePicker } from '@/components/FairPathDatePicker';
import { FormScrollView } from '@/components/FormScrollView';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ChipGroup, Field, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { EXTRACTION_LABEL, ISSUE_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_OPTIONS, dateLabel, dollarsToCents, formatCents } from '@/core/credit/credit-format';
import { confirmAccount, creditErrorMessage, flagNotMine, loadAccount, loadItems, type CreditAccount, type ReviewItem } from '@/core/credit/credit-service';
import { isoFromText, textFromIso } from '@/core/profile/opportunity-forms';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

export default function CreditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useFairPathTheme();
  const [account, setAccount] = useState<CreditAccount | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notMine, setNotMine] = useState(false);
  const [statement, setStatement] = useState('');
  const [form, setForm] = useState({ furnisher: '', status: ['unknown'], opened: '', closed: '', reported: '', delinquency: '', balance: '', limit: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [a, all] = await Promise.all([loadAccount(id), loadItems()]);
      setAccount(a);
      setItems(all.filter((i) => i.account_id === id));
      setForm({
        furnisher: a.furnisher_name, status: [a.payment_status], opened: textFromIso(a.opened_date), closed: textFromIso(a.closed_date), reported: textFromIso(a.last_reported_date),
        delinquency: textFromIso(a.first_delinquency_date), balance: a.balance_cents == null ? '' : (Number(a.balance_cents) / 100).toFixed(2), limit: a.credit_limit_cents == null ? '' : (Number(a.credit_limit_cents) / 100).toFixed(2),
      });
    } catch { setError('We could not load this account.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function confirm(corrections: Record<string, unknown>) {
    if (!account) return;
    setBusy(true);
    try { await confirmAccount(account.id, corrections); setEditing(false); await load(); } catch (e) { notify('Could not save', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  function saveCorrections() {
    if (!account) return;
    const errs: Record<string, string> = {};
    const bal = dollarsToCents(form.balance); const lim = dollarsToCents(form.limit);
    if (form.furnisher.trim().length < 2) errs.furnisher = 'Enter the creditor name.';
    if (bal === 'invalid') errs.balance = 'Enter an amount like 250.00.';
    if (lim === 'invalid') errs.limit = 'Enter an amount like 1000.00.';
    for (const [k, v] of [['opened', form.opened], ['closed', form.closed], ['reported', form.reported], ['delinquency', form.delinquency]] as const) if (v && !isoFromText(v)) errs[k] = 'Choose a valid date.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    void confirm({
      furnisher_name: form.furnisher.trim(), payment_status: form.status[0], opened_date: isoFromText(form.opened) ?? '', closed_date: isoFromText(form.closed) ?? '',
      last_reported_date: isoFromText(form.reported) ?? '', first_delinquency_date: isoFromText(form.delinquency) ?? '',
      balance_cents: bal === 'invalid' || bal === null ? '' : String(bal), credit_limit_cents: lim === 'invalid' || lim === null ? '' : String(lim),
    });
  }

  async function submitNotMine() {
    if (!account) return;
    setBusy(true);
    try { await flagNotMine(account.id, statement); setNotMine(false); setStatement(''); await load(); } catch (e) { notify('Could not save', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  if (error) return <ScreenFrame><PageHeader eyebrow="CREDIT" title="Account" backTo="/credit" alwaysBackTo /><View style={{ paddingHorizontal: L.mobileGutter }}><StatusLine tone="error">{error}</StatusLine></View></ScreenFrame>;
  if (!account) return <ScreenFrame><PageHeader eyebrow="CREDIT" title="Account" backTo="/credit" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;
  const ex = EXTRACTION_LABEL[account.extraction_state];
  const needs = account.extraction_state === 'needs_review' || account.extraction_state === 'extracted';

  return (
    <ScreenFrame>
      <PageHeader eyebrow="CREDIT ACCOUNT" title={account.furnisher_name} backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          <InlineBadge tone={ex.tone === 'ok' ? 'lime' : 'default'}>{ex.label}</InlineBadge>
          {account.source === 'fixture' ? <InlineBadge>DEV TEST DATA</InlineBadge> : null}
          {account.member_says_not_mine ? <InlineBadge>YOU SAY NOT YOURS</InlineBadge> : null}
        </View>

        {needs ? <Panel tone="warning"><BodyText strong>Please check this against your report</BodyText><BodyText muted>{account.source === 'manual' ? '' : 'These details were read from a file and may contain mistakes. '}Confirm them as they are, or correct anything that is wrong.</BodyText>{account.low_confidence_fields.length ? <BodyText muted>Hard to read: {account.low_confidence_fields.map((f) => f.replace(/_/g, ' ')).join(', ')}</BodyText> : null}</Panel> : null}

        {!editing ? (
          <>
            <Panel>
              {[['Status', PAYMENT_STATUS_LABEL[account.payment_status] ?? account.payment_status], ['Account ending', account.account_last4 ?? '—'], ['Opened', dateLabel(account.opened_date)], ['Closed', dateLabel(account.closed_date)], ['Last reported', dateLabel(account.last_reported_date)],
                ['First delinquency', dateLabel(account.first_delinquency_date)], ['Balance', formatCents(account.balance_cents)], ['Credit limit', formatCents(account.credit_limit_cents)], ['Original creditor', account.original_creditor ?? '—']].map(([k, v]) => (
                <View key={k} style={{ marginBottom: 8 }}><BodyText muted>{k}</BodyText><BodyText strong>{v}</BodyText></View>
              ))}
            </Panel>
            {account.extraction_state === 'corrected_by_member' && account.extracted_values ? <Panel><BodyText muted>You corrected this account. Originally read as: balance {formatCents(account.extracted_values.balance_cents as number)}, status {PAYMENT_STATUS_LABEL[String(account.extracted_values.payment_status)] ?? '—'}.</BodyText></Panel> : null}
            {needs ? <PrimaryButton label="THIS IS CORRECT" onPress={() => void confirm({})} busy={busy} /> : null}
            <SecondaryButton label={needs ? 'CORRECT SOMETHING' : 'EDIT DETAILS'} onPress={() => setEditing(true)} />
          </>
        ) : (
          <>
            <Field label="CREDITOR" value={form.furnisher} onChangeText={(v) => setForm({ ...form, furnisher: v })} error={errors.furnisher} autoCapitalize="words" />
            <ChipGroup single label="STATUS" options={PAYMENT_STATUS_OPTIONS} selected={form.status} onChange={(n) => setForm({ ...form, status: n.length ? n : form.status })} />
            <FairPathDatePicker label="OPENED" value={form.opened} onChange={(v) => setForm({ ...form, opened: v })} kind="past" optional error={errors.opened} />
            <FairPathDatePicker label="CLOSED" value={form.closed} onChange={(v) => setForm({ ...form, closed: v })} kind="past" optional error={errors.closed} />
            <FairPathDatePicker label="LAST REPORTED" value={form.reported} onChange={(v) => setForm({ ...form, reported: v })} kind="past" optional error={errors.reported} />
            <FairPathDatePicker label="FIRST DELINQUENCY" value={form.delinquency} onChange={(v) => setForm({ ...form, delinquency: v })} kind="past" optional error={errors.delinquency} />
            <Field label="BALANCE" value={form.balance} onChangeText={(v) => setForm({ ...form, balance: v })} error={errors.balance} keyboardType="decimal-pad" optional />
            <Field label="CREDIT LIMIT" value={form.limit} onChangeText={(v) => setForm({ ...form, limit: v })} error={errors.limit} keyboardType="decimal-pad" optional />
            <PrimaryButton label="SAVE MY CORRECTIONS" onPress={saveCorrections} busy={busy} />
            <SecondaryButton label="CANCEL" onPress={() => setEditing(false)} />
          </>
        )}

        <View style={{ marginTop: 22 }}><SectionTitle>THINGS TO LOOK AT ON THIS ACCOUNT</SectionTitle></View>
        {items.length === 0 ? <BodyText muted>Nothing flagged.</BodyText> : items.map((i) => <ListRow key={i.id} title={i.title} body={ISSUE_LABEL[i.issue_type] ?? i.issue_type} onPress={() => router.push(('/credit/item/' + i.id) as never)} />)}

        {!account.member_says_not_mine ? (
          <>
            <View style={{ marginTop: 22 }}><SectionTitle>IS THIS NOT YOUR ACCOUNT?</SectionTitle></View>
            {!notMine ? <SecondaryButton label="THIS ACCOUNT IS NOT MINE" onPress={() => setNotMine(true)} /> : (
              <>
                <Field label="IN YOUR OWN WORDS" value={statement} onChangeText={setStatement} multiline maxLength={1500} hint="For example: I never opened an account with this company. FairPath cannot verify this. It is your statement." />
                <PrimaryButton label="SAVE MY STATEMENT" onPress={() => void submitNotMine()} busy={busy} />
                <SecondaryButton label="CANCEL" onPress={() => setNotMine(false)} />
              </>
            )}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
