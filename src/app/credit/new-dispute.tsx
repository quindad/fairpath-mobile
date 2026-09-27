import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ChipGroup, EmptyState, Field, Panel, PrimaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { disputableItems } from '@/core/credit/credit-format';
import { createDispute, creditErrorMessage, loadAccounts, loadItems, type CreditAccount, type ReviewItem } from '@/core/credit/credit-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

export default function NewDispute() {
  const { item: preselect } = useLocalSearchParams<{ item?: string }>();
  const { tokens } = useFairPathTheme();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [kind, setKind] = useState<string[]>(['bureau']);
  const [bureau, setBureau] = useState<string[]>([]);
  const [furnisher, setFurnisher] = useState('');
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([loadItems(), loadAccounts()]).then(([i, a]) => {
      const ok = disputableItems(i);
      setItems(ok); setAccounts(a);
      setChosen(preselect && ok.some((x) => x.id === preselect) ? [preselect] : ok.length === 1 ? [ok[0].id] : []);
    }).catch(() => setItems([]));
  }, [preselect]);

  const accountName = (id: string | null) => accounts.find((a) => a.id === id);
  const suggestedReason = useMemo(() => (items ?? []).filter((i) => chosen.includes(i.id)).map((i) => `${accountName(i.account_id)?.furnisher_name ?? i.title}: ${i.member_statement ?? ''}`).join('\n'), [items, chosen, accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const reasonText = reasonTouched ? reason : suggestedReason;
  const targetName = kind[0] === 'bureau' ? ({ equifax: 'Equifax', experian: 'Experian', transunion: 'TransUnion' } as Record<string, string>)[bureau[0] ?? ''] ?? '' : furnisher.trim();
  const ready = chosen.length > 0 && targetName.length >= 2 && reasonText.trim().length >= 10;

  async function create() {
    setBusy(true);
    try {
      const d = await createDispute(kind[0] as 'bureau' | 'furnisher', targetName, chosen, reasonText);
      router.replace(('/credit/dispute/' + d.id) as never);
    } catch (e) { notify('Could not start the dispute', creditErrorMessage(e)); } finally { setBusy(false); }
  }

  if (!items) return <ScreenFrame><PageHeader eyebrow="CREDIT" title="New dispute" backTo="/credit" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="CREDIT" title="New dispute" backTo="/credit" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        {items.length === 0 ? <EmptyState title="No confirmed issues yet" body="A dispute starts from an issue you confirmed as inaccurate. Review your accounts first." action={<PrimaryButton label="GO TO REVIEW" onPress={() => router.replace('/credit' as never)} />} /> : (
          <>
            <Panel><BodyText muted>Choose the issues to include. Only issues you confirmed appear here. Nothing is sent by FairPath: you decide when and how to send a letter.</BodyText></Panel>
            <ChipGroup label="ISSUES TO INCLUDE" options={items.map((i) => ({ value: i.id, label: (accountName(i.account_id)?.furnisher_name ?? i.title).slice(0, 28) }))} selected={chosen} onChange={setChosen} />
            <ChipGroup single label="WHO WILL YOU SEND IT TO?" options={[{ value: 'bureau', label: 'A credit bureau' }, { value: 'furnisher', label: 'The company that reported it' }]} selected={kind} onChange={(n) => setKind(n.length ? n : kind)} />
            {kind[0] === 'bureau' ? <ChipGroup single options={[{ value: 'equifax', label: 'Equifax' }, { value: 'experian', label: 'Experian' }, { value: 'transunion', label: 'TransUnion' }]} selected={bureau} onChange={setBureau} /> : <Field label="COMPANY NAME" value={furnisher} onChangeText={setFurnisher} autoCapitalize="words" />}
            <Field label="WHY YOU ARE DISPUTING (EDITABLE)" value={reasonText} onChangeText={(v) => { setReasonTouched(true); setReason(v); }} multiline maxLength={1500} hint="Built from your own statements. Edit anything that is not exactly right." />
            {!ready ? <StatusLine tone="muted">Choose at least one issue, who you are sending it to, and a reason.</StatusLine> : null}
            <PrimaryButton label="CREATE DISPUTE" onPress={() => void create()} busy={busy} disabled={!ready} />
          </>
        )}
      </FormScrollView>
    </ScreenFrame>
  );
}
