import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FairPathDatePicker } from '@/components/FairPathDatePicker';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ChipGroup, Field, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { textFromIso } from '@/core/profile/opportunity-forms';
import { DISPOSITION_OPTIONS, OFFENSE_CLASS_OPTIONS, caseToPayload, validateCase, type CaseForm } from '@/core/record-relief/relief-format';
import { loadCase, loadCoveredJurisdictions, loadJurisdictions, reliefErrorMessage, saveCase, type Jurisdiction } from '@/core/record-relief/relief-service';
import { notify } from '@/core/ui/notify';

const BLANK: CaseForm = {
  jurisdiction_code: '', label: '', court_name: '', case_number: '', offense_description: '', offense_class: 'misdemeanor', disposition: 'conviction', is_juvenile: false, out_of_state_conviction: false,
  conviction_text: '', disposition_text: '', sentence_text: '', supervision_text: '', release_text: '', fines_paid: '', restitution_paid: '', other_convictions: '', pending_charges: '', notes: '',
};
const YNU = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

export default function AddReliefCase() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<CaseForm>(BLANK);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const set = (p: Partial<CaseForm>) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    void (async () => {
      try {
        const [j, cov] = await Promise.all([loadJurisdictions(), loadCoveredJurisdictions()]);
        setJurisdictions(j); setCovered(cov);
        if (id) {
          const c = await loadCase(id);
          setForm({
            jurisdiction_code: c.jurisdiction_code, label: c.label, court_name: c.court_name ?? '', case_number: c.case_number ?? '', offense_description: c.offense_description ?? '', offense_class: c.offense_class,
            disposition: c.disposition, is_juvenile: c.is_juvenile, out_of_state_conviction: c.out_of_state_conviction, conviction_text: textFromIso(c.conviction_date), disposition_text: textFromIso(c.disposition_date),
            sentence_text: textFromIso(c.sentence_completion_date), supervision_text: textFromIso(c.supervision_completion_date), release_text: textFromIso(c.release_date),
            fines_paid: c.fines_paid === null ? '' : c.fines_paid ? 'yes' : 'no', restitution_paid: c.restitution_paid === null ? '' : c.restitution_paid ? 'yes' : 'no',
            other_convictions: c.other_convictions_count === null ? '' : String(c.other_convictions_count), pending_charges: c.pending_charges === null ? '' : c.pending_charges ? 'yes' : 'no', notes: c.notes ?? '',
          });
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/record-relief/add')) as never);
      } finally { setReady(true); }
    })();
  }, [id]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return jurisdictions.filter((j) => !q || j.name.toLowerCase().includes(q) || j.code.toLowerCase().includes(q)).slice(0, q ? 60 : 12);
  }, [jurisdictions, filter]);
  const chosen = jurisdictions.find((j) => j.code === form.jurisdiction_code);
  const isFed = form.jurisdiction_code === 'US-FED';

  async function submit() {
    const errs = validateCase(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const saved = await saveCase(id ?? null, caseToPayload(form));
      router.replace(('/record-relief/case/' + saved.id) as never);
    } catch (e) { notify('Could not save the case', reliefErrorMessage(e)); } finally { setBusy(false); }
  }

  if (!ready) return <ScreenFrame><PageHeader eyebrow="RECORD RELIEF" title="Case" backTo="/record-relief" alwaysBackTo /><ActivityIndicator style={{ marginTop: 32 }} /></ScreenFrame>;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RECORD RELIEF" title={id ? 'Edit case' : 'Add a case'} backTo="/record-relief" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 48 }}>
        <Panel><BodyText muted>Enter what you know from your paperwork. You can leave things blank: FairPath will tell you what it cannot check without them. Everything here is private to you.</BodyText></Panel>

        <View style={{ marginTop: 18 }}><SectionTitle>WHERE WAS THE CASE HEARD?</SectionTitle></View>
        {chosen ? (
          <Panel tone="accent"><BodyText strong>{chosen.name}</BodyText><BodyText muted>{covered.has(chosen.code) ? 'FairPath has verified rules for this jurisdiction.' : isFed ? 'Federal cases are tracked separately from state record relief.' : 'FairPath does not have verified rules for this jurisdiction yet. You can still track the case.'}</BodyText><SecondaryButton label="CHANGE" onPress={() => set({ jurisdiction_code: '' })} /></Panel>
        ) : (
          <>
            <Field label="SEARCH STATES AND TERRITORIES" value={filter} onChangeText={setFilter} placeholder="Type a state name" autoCapitalize="words" error={errors.jurisdiction_code} />
            {shown.map((j) => <ListRow key={j.code} title={j.name} body={covered.has(j.code) ? 'Verified rules available' : j.kind === 'federal' ? 'Handled separately' : 'No verified rules yet'} onPress={() => set({ jurisdiction_code: j.code })} />)}
          </>
        )}

        <Field label="A SHORT NAME FOR THIS CASE" value={form.label} onChangeText={(v) => set({ label: v })} error={errors.label} placeholder="2016 theft charge" autoCapitalize="words" />
        <Field label="COURT" value={form.court_name} onChangeText={(v) => set({ court_name: v })} optional autoCapitalize="words" />
        <Field label="CASE NUMBER" value={form.case_number} onChangeText={(v) => set({ case_number: v })} error={errors.case_number} optional hint="Optional and private. It is only printed inside documents you create, never in a file name." />
        <Field label="WHAT WAS THE CHARGE?" value={form.offense_description} onChangeText={(v) => set({ offense_description: v })} optional autoCapitalize="sentences" />

        {!isFed ? <ChipGroup single label="TYPE OF OFFENSE" options={OFFENSE_CLASS_OPTIONS} selected={[form.offense_class]} onChange={(n) => set({ offense_class: n[0] ?? form.offense_class })} hint="Pick the closest match. If you are not sure, choose Other." /> : null}
        <ChipGroup single label="HOW DID THE CASE END?" options={DISPOSITION_OPTIONS} selected={[form.disposition]} onChange={(n) => set({ disposition: n[0] ?? form.disposition })} />
        <ChipGroup label="ANYTHING ELSE THAT APPLIES?" options={[{ value: 'juvenile', label: 'It was a juvenile case' }, { value: 'oos', label: 'It was in a different state than the one I chose' }]} selected={[...(form.is_juvenile ? ['juvenile'] : []), ...(form.out_of_state_conviction ? ['oos'] : [])]} onChange={(n) => set({ is_juvenile: n.includes('juvenile'), out_of_state_conviction: n.includes('oos') })} hint="These can change which rules apply, so FairPath will suggest a manual review." />

        <View style={{ marginTop: 18 }}><SectionTitle>DATES</SectionTitle></View>
        <FairPathDatePicker label="CONVICTION DATE" value={form.conviction_text} onChange={(v) => set({ conviction_text: v })} kind="past" optional error={errors.conviction_text} />
        <FairPathDatePicker label="DISPOSITION DATE" value={form.disposition_text} onChange={(v) => set({ disposition_text: v })} kind="past" optional error={errors.disposition_text} />
        <FairPathDatePicker label="SENTENCE COMPLETED (OR WILL BE)" value={form.sentence_text} onChange={(v) => set({ sentence_text: v })} kind="any" optional error={errors.sentence_text} />
        <FairPathDatePicker label="PROBATION / PAROLE COMPLETED (OR WILL BE)" value={form.supervision_text} onChange={(v) => set({ supervision_text: v })} kind="any" optional error={errors.supervision_text} />
        <FairPathDatePicker label="RELEASE DATE" value={form.release_text} onChange={(v) => set({ release_text: v })} kind="past" optional error={errors.release_text} />

        <View style={{ marginTop: 18 }}><SectionTitle>CONDITIONS SOME RULES CHECK</SectionTitle></View>
        <ChipGroup single label="ARE ALL FINES PAID?" options={YNU} selected={form.fines_paid ? [form.fines_paid] : []} onChange={(n) => set({ fines_paid: (n[0] as 'yes' | 'no') ?? '' })} hint="Leave blank if you are not sure." />
        <ChipGroup single label="IS RESTITUTION PAID?" options={YNU} selected={form.restitution_paid ? [form.restitution_paid] : []} onChange={(n) => set({ restitution_paid: (n[0] as 'yes' | 'no') ?? '' })} />
        <ChipGroup single label="ANY PENDING CHARGES?" options={YNU} selected={form.pending_charges ? [form.pending_charges] : []} onChange={(n) => set({ pending_charges: (n[0] as 'yes' | 'no') ?? '' })} />
        <Field label="HOW MANY OTHER CONVICTIONS DO YOU HAVE?" value={form.other_convictions} onChangeText={(v) => set({ other_convictions: v.replace(/[^0-9]/g, '').slice(0, 2) })} error={errors.other_convictions} keyboardType="number-pad" optional />
        <Field label="NOTES" value={form.notes} onChangeText={(v) => set({ notes: v })} multiline optional maxLength={1500} />

        {Object.keys(errors).length ? <StatusLine tone="error">Please fix the highlighted fields.</StatusLine> : null}
        <PrimaryButton label={id ? 'SAVE AND RE-CHECK' : 'SAVE AND CHECK THIS CASE'} onPress={() => void submit()} busy={busy} />
      </FormScrollView>
    </ScreenFrame>
  );
}
