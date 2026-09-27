import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { FairPathDatePicker } from '@/components/FairPathDatePicker';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { BodyText, ChipGroup, Field, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { PAYMENT_STATUS_OPTIONS, dollarsToCents } from '@/core/credit/credit-format';
import { addAccount, createManualReport, creditErrorMessage } from '@/core/credit/credit-service';
import { isoFromText } from '@/core/profile/opportunity-forms';
import { notify } from '@/core/ui/notify';

const TYPES = [{ value: 'revolving', label: 'Credit card' }, { value: 'auto', label: 'Auto loan' }, { value: 'installment', label: 'Other loan' }, { value: 'mortgage', label: 'Mortgage' }, { value: 'student', label: 'Student loan' }, { value: 'collection', label: 'Collection' }, { value: 'utility', label: 'Utility' }, { value: 'other', label: 'Other' }];

export default function AddCreditAccount() {
  const [bureau, setBureau] = useState<string[]>(['unknown']);
  const [reportId, setReportId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string[]>(['revolving']);
  const [last4, setLast4] = useState('');
  const [status, setStatus] = useState<string[]>(['current']);
  const [opened, setOpened] = useState('');
  const [balance, setBalance] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  async function submit() {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Enter the creditor or company name.';
    if (last4 && !/^\d{4}$/.test(last4)) errs.last4 = 'Enter exactly the last 4 digits, or leave it blank.';
    const bal = dollarsToCents(balance);
    if (bal === 'invalid') errs.balance = 'Enter an amount like 250.00.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      let rid = reportId;
      if (!rid) { rid = await createManualReport(bureau[0] ?? 'unknown', null); setReportId(rid); }
      await addAccount(rid, {
        furnisher_name: name.trim(), account_type: type[0] ?? 'other', account_number: last4 || null, payment_status: status[0] ?? 'unknown',
        opened_date: opened ? isoFromText(opened) : null, balance_cents: bal === 'invalid' ? null : bal,
      });
      setAdded((n) => n + 1);
      setName(''); setLast4(''); setOpened(''); setBalance('');
    } catch (e) { notify('Could not add the account', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="CREDIT BUILDER" title="Enter an account" backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <Panel><BodyText muted>Copy each account from your credit report. Only the last 4 digits of an account number are kept. Because you type it yourself, it counts as confirmed by you.</BodyText></Panel>
        {!reportId ? <ChipGroup single label="WHICH BUREAU'S REPORT?" options={[{ value: 'equifax', label: 'Equifax' }, { value: 'experian', label: 'Experian' }, { value: 'transunion', label: 'TransUnion' }, { value: 'unknown', label: 'Not sure' }]} selected={bureau} onChange={(n) => setBureau(n.length ? n : ['unknown'])} /> : null}
        <Field label="CREDITOR OR COMPANY" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
        <ChipGroup single label="TYPE" options={TYPES} selected={type} onChange={(n) => setType(n.length ? n : type)} />
        <Field label="LAST 4 DIGITS OF THE ACCOUNT NUMBER" value={last4} onChangeText={(v) => setLast4(v.replace(/[^0-9]/g, '').slice(0, 4))} error={errors.last4} keyboardType="number-pad" optional />
        <ChipGroup single label="STATUS AS SHOWN" options={PAYMENT_STATUS_OPTIONS} selected={status} onChange={(n) => setStatus(n.length ? n : status)} />
        <FairPathDatePicker label="DATE OPENED" value={opened} onChange={setOpened} kind="past" optional />
        <Field label="BALANCE" value={balance} onChangeText={setBalance} error={errors.balance} keyboardType="decimal-pad" placeholder="250.00" optional />
        <PrimaryButton label={added ? 'ADD ANOTHER ACCOUNT' : 'ADD ACCOUNT'} onPress={() => void submit()} busy={busy} />
        {added ? <View><StatusLine tone="success">{added} account{added === 1 ? '' : 's'} added. FairPath reviewed them for things worth a second look.</StatusLine><SecondaryButton label="DONE" onPress={() => router.replace('/credit' as never)} /></View> : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
