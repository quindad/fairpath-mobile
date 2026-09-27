import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FairPathDatePicker } from '@/components/FairPathDatePicker';
import { BodyText, ChipGroup, EmptyState, Field, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import {
  CREDENTIAL_OPTIONS, DAYS, EMPLOYMENT_TYPES, SHIFTS, TRANSPORT, WORKPLACE_TYPES, isoFromText, parsePay, parseTitles, textFromIso,
  validateCredential, validateEducation, validateSkill, validateTitles, validateWork, type FieldErrors,
} from '@/core/profile/opportunity-forms';
import {
  EMPTY_PREFERENCES, addSkill, deleteCredential, deleteEducation, deleteSkill, deleteWork, loadContact, loadCredentials, loadEducation, loadPreferences, loadSkills,
  loadWork, profileErrorMessage, saveContact, saveCredential, saveEducation, savePreferences, saveWork,
  type Credential, type Education, type JobPreferences, type Skill, type WorkExperience,
} from '@/core/profile/opportunity-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

/** Shared loading wrapper: loading spinner, error with retry, then the editor. */
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await load()); } catch (e) { setError(profileErrorMessage(e)); } finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

function LoadState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  const { tokens } = useFairPathTheme();
  if (loading) return <ActivityIndicator color={tokens.accentText} style={{ marginTop: 28 }} />;
  if (error) return <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={reload} /></View>;
  return null;
}

function confirmDelete(what: string, onYes: () => void) {
  notify(`Remove this ${what}?`, 'This removes it from your profile. It does not change applications you already sent.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onYes },
  ]);
}

// ---------------------------------------------------------------------------------------------------- Work experience
const blankWork = { job_title: '', employer_name: '', location_text: '', start_text: '', end_text: '', is_current: false, description: '' };
export function ExperienceEditor({ onChanged }: { onChanged: () => void }) {
  const list = useLoad(useCallback(async () => ({ work: await loadWork(), prefs: await loadPreferences() }), []));
  const [form, setForm] = useState<typeof blankWork | null>(null);
  const [editing, setEditing] = useState<string | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof blankWork>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const open = (w?: WorkExperience) => {
    setEditing(w?.id);
    setErrors({});
    setForm(w ? { job_title: w.job_title, employer_name: w.employer_name, location_text: w.location_text ?? '', start_text: textFromIso(w.start_date), end_text: textFromIso(w.end_date), is_current: w.is_current, description: w.description ?? '' } : blankWork);
  };
  const submit = async () => {
    if (!form) return;
    const errs = validateWork(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await saveWork({
        job_title: form.job_title.trim(), employer_name: form.employer_name.trim(), location_text: form.location_text.trim() || null,
        start_date: isoFromText(form.start_text)!, end_date: form.is_current ? null : isoFromText(form.end_text), is_current: form.is_current, description: form.description.trim() || null,
      }, editing);
      setForm(null);
      await list.reload();
      onChanged();
    } catch (e) { notify('Could not save', profileErrorMessage(e)); } finally { setBusy(false); }
  };

  if (list.loading || list.error) return <LoadState {...list} />;
  if (form) {
    return (
      <View>
        <Field label="JOB TITLE" value={form.job_title} onChangeText={(v) => set({ job_title: v })} error={errors.job_title} placeholder="Forklift operator" autoCapitalize="words" />
        <Field label="EMPLOYER" value={form.employer_name} onChangeText={(v) => set({ employer_name: v })} error={errors.employer_name} placeholder="Company name" autoCapitalize="words" />
        <Field label="LOCATION" value={form.location_text} onChangeText={(v) => set({ location_text: v })} error={errors.location_text} placeholder="City, State" optional autoCapitalize="words" />
        <FairPathDatePicker label="START DATE" value={form.start_text} onChange={(v) => set({ start_text: v })} kind="past" error={errors.start_text} />
        <ChipGroup single options={[{ value: 'current', label: 'I still work here' }]} selected={form.is_current ? ['current'] : []} onChange={(n) => set({ is_current: n.includes('current'), end_text: n.includes('current') ? '' : form.end_text })} />
        {!form.is_current ? <FairPathDatePicker label="END DATE" value={form.end_text} onChange={(v) => set({ end_text: v })} kind="past" error={errors.end_text} /> : null}
        <Field label="WHAT YOU DID" value={form.description} onChangeText={(v) => set({ description: v })} error={errors.description} multiline maxLength={1000} optional hint="Real tasks and results. Employers only see this if you choose to share it." />
        <PrimaryButton label={editing ? 'SAVE CHANGES' : 'ADD EXPERIENCE'} onPress={() => void submit()} busy={busy} />
        <SecondaryButton label="CANCEL" onPress={() => setForm(null)} />
        {editing ? <SecondaryButton tone="danger" label="REMOVE THIS JOB" onPress={() => confirmDelete('job', () => void deleteWork(editing).then(() => { setForm(null); void list.reload(); onChanged(); }).catch((e) => notify('Could not remove', profileErrorMessage(e))))} /> : null}
      </View>
    );
  }
  const work = list.data!.work;
  const none = list.data!.prefs.no_work_experience_yet;
  return (
    <View>
      {work.length === 0 ? <EmptyState title="No work experience added" body="Add jobs you have held, including short, informal or prison-based work. If you have none yet, say so below and this section counts as done." /> : null}
      {work.map((w) => (
        <ListRow key={w.id} title={w.job_title} body={w.employer_name} meta={`${textFromIso(w.start_date).slice(6)} – ${w.is_current ? 'Present' : textFromIso(w.end_date).slice(6)}`} onPress={() => open(w)} />
      ))}
      <PrimaryButton label="ADD WORK EXPERIENCE" onPress={() => open()} />
      {work.length === 0 ? (
        <ChipGroup single options={[{ value: 'none', label: 'I have no work experience yet' }]} selected={none ? ['none'] : []}
          onChange={(n) => void savePreferences({ no_work_experience_yet: n.includes('none') }).then(() => { void list.reload(); onChanged(); }).catch((e) => notify('Could not save', profileErrorMessage(e)))} />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------- Education
const blankEdu = { school_name: '', credential: '', field_of_study: '', start_year: '', end_year: '', status: 'completed' };
export function EducationEditor({ onChanged }: { onChanged: () => void }) {
  const list = useLoad(loadEducation);
  const [form, setForm] = useState<typeof blankEdu | null>(null);
  const [editing, setEditing] = useState<string | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof blankEdu>) => setForm((f) => (f ? { ...f, ...p } : f));
  const open = (e?: Education) => { setEditing(e?.id); setErrors({}); setForm(e ? { school_name: e.school_name, credential: e.credential, field_of_study: e.field_of_study ?? '', start_year: e.start_year ? String(e.start_year) : '', end_year: e.end_year ? String(e.end_year) : '', status: e.status } : blankEdu); };
  const submit = async () => {
    if (!form) return;
    const errs = validateEducation(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await saveEducation({ school_name: form.school_name.trim(), credential: form.credential, field_of_study: form.field_of_study.trim() || null, start_year: form.start_year ? Number(form.start_year) : null, end_year: form.end_year ? Number(form.end_year) : null, status: form.status }, editing);
      setForm(null); await list.reload(); onChanged();
    } catch (e) { notify('Could not save', profileErrorMessage(e)); } finally { setBusy(false); }
  };
  if (list.loading || list.error) return <LoadState {...list} />;
  if (form) {
    return (
      <View>
        <Field label="SCHOOL OR PROGRAM" value={form.school_name} onChangeText={(v) => set({ school_name: v })} error={errors.school_name} autoCapitalize="words" />
        <ChipGroup single label="CREDENTIAL" options={CREDENTIAL_OPTIONS} selected={form.credential ? [form.credential] : []} onChange={(n) => set({ credential: n[0] ?? '' })} hint={errors.credential} />
        <Field label="FIELD OF STUDY" value={form.field_of_study} onChangeText={(v) => set({ field_of_study: v })} error={errors.field_of_study} optional autoCapitalize="words" />
        <Field label="START YEAR" value={form.start_year} onChangeText={(v) => set({ start_year: v.replace(/[^0-9]/g, '').slice(0, 4) })} error={errors.start_year} keyboardType="number-pad" optional placeholder="2012" />
        <Field label="END YEAR" value={form.end_year} onChangeText={(v) => set({ end_year: v.replace(/[^0-9]/g, '').slice(0, 4) })} error={errors.end_year} keyboardType="number-pad" optional placeholder="2015" />
        <ChipGroup single label="STATUS" options={[{ value: 'completed', label: 'Completed' }, { value: 'in_progress', label: 'In progress' }, { value: 'incomplete', label: 'Did not finish' }]} selected={[form.status]} onChange={(n) => set({ status: n[0] ?? 'completed' })} />
        <PrimaryButton label={editing ? 'SAVE CHANGES' : 'ADD EDUCATION'} onPress={() => void submit()} busy={busy} />
        <SecondaryButton label="CANCEL" onPress={() => setForm(null)} />
        {editing ? <SecondaryButton tone="danger" label="REMOVE" onPress={() => confirmDelete('education entry', () => void deleteEducation(editing).then(() => { setForm(null); void list.reload(); onChanged(); }).catch((e) => notify('Could not remove', profileErrorMessage(e))))} /> : null}
      </View>
    );
  }
  const items = list.data!;
  return (
    <View>
      {items.length === 0 ? <EmptyState title="No education added" body="Add a diploma, GED, trade program or any classes you have taken, including programs completed while incarcerated." /> : null}
      {items.map((e) => <ListRow key={e.id} title={CREDENTIAL_OPTIONS.find((o) => o.value === e.credential)?.label ?? e.credential} body={e.school_name} meta={e.end_year ? String(e.end_year) : e.status === 'in_progress' ? 'In progress' : ''} onPress={() => open(e)} />)}
      <PrimaryButton label="ADD EDUCATION" onPress={() => open()} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------- Credentials
const blankCred = { credential_type: 'certification', name: '', issuer: '', issued_text: '', expires_text: '' };
export function CredentialsEditor({ onChanged }: { onChanged: () => void }) {
  const list = useLoad(loadCredentials);
  const [form, setForm] = useState<typeof blankCred | null>(null);
  const [editing, setEditing] = useState<string | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof blankCred>) => setForm((f) => (f ? { ...f, ...p } : f));
  const open = (c?: Credential) => { setEditing(c?.id); setErrors({}); setForm(c ? { credential_type: c.credential_type, name: c.name, issuer: c.issuer ?? '', issued_text: textFromIso(c.issued_date), expires_text: textFromIso(c.expires_date) } : blankCred); };
  const submit = async () => {
    if (!form) return;
    const errs = validateCredential(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await saveCredential({ credential_type: form.credential_type as Credential['credential_type'], name: form.name.trim(), issuer: form.issuer.trim() || null, issued_date: form.issued_text ? isoFromText(form.issued_text) : null, expires_date: form.expires_text ? isoFromText(form.expires_text) : null }, editing);
      setForm(null); await list.reload(); onChanged();
    } catch (e) { notify('Could not save', profileErrorMessage(e)); } finally { setBusy(false); }
  };
  if (list.loading || list.error) return <LoadState {...list} />;
  if (form) {
    return (
      <View>
        <ChipGroup single label="TYPE" options={[{ value: 'certification', label: 'Certification' }, { value: 'license', label: 'License' }]} selected={[form.credential_type]} onChange={(n) => set({ credential_type: n[0] ?? 'certification' })} />
        <Field label="NAME" value={form.name} onChangeText={(v) => set({ name: v })} error={errors.name} placeholder="OSHA 10, Forklift certification, CDL…" autoCapitalize="words" />
        <Field label="ISSUED BY" value={form.issuer} onChangeText={(v) => set({ issuer: v })} error={errors.issuer} optional autoCapitalize="words" />
        <FairPathDatePicker label="ISSUE DATE" value={form.issued_text} onChange={(v) => set({ issued_text: v })} kind="past" optional error={errors.issued_text} />
        <FairPathDatePicker label="EXPIRES" value={form.expires_text} onChange={(v) => set({ expires_text: v })} kind="any" optional error={errors.expires_text} />
        <StatusLine tone="muted">Do not enter license or certificate numbers. FairPath does not store them.</StatusLine>
        <PrimaryButton label={editing ? 'SAVE CHANGES' : 'ADD'} onPress={() => void submit()} busy={busy} />
        <SecondaryButton label="CANCEL" onPress={() => setForm(null)} />
        {editing ? <SecondaryButton tone="danger" label="REMOVE" onPress={() => confirmDelete('entry', () => void deleteCredential(editing).then(() => { setForm(null); void list.reload(); onChanged(); }).catch((e) => notify('Could not remove', profileErrorMessage(e))))} /> : null}
      </View>
    );
  }
  const items = list.data!;
  return (
    <View>
      {items.length === 0 ? <EmptyState title="Nothing added yet" body="Certifications and licenses are optional, but they help. Add any you hold." /> : null}
      {items.map((c) => <ListRow key={c.id} title={c.name} body={c.issuer ?? undefined} meta={c.credential_type === 'license' ? 'License' : 'Certification'} onPress={() => open(c)} />)}
      <PrimaryButton label="ADD CERTIFICATION OR LICENSE" onPress={() => open()} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------- Skills
export function SkillsEditor({ onChanged }: { onChanged: () => void }) {
  const list = useLoad(loadSkills);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (list.loading || list.error) return <LoadState {...list} />;
  const skills: Skill[] = list.data!;
  const add = async () => {
    const problem = validateSkill(text, skills.map((s) => s.skill));
    setError(problem ?? '');
    if (problem) return;
    setBusy(true);
    try { await addSkill(text); setText(''); await list.reload(); onChanged(); } catch (e) { setError(profileErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View>
      <Field label="ADD A SKILL" value={text} onChangeText={setText} error={error} placeholder="Forklift, customer service, welding…" hint="Add at least 3. Real skills you can do today." autoCapitalize="words" />
      <PrimaryButton label="ADD SKILL" onPress={() => void add()} busy={busy} />
      {skills.length === 0 ? <EmptyState title="No skills yet" body="Think about what you can do: tools, equipment, languages, people skills, licenses you hold." /> : null}
      {skills.map((s) => (
        <ListRow key={s.id} title={s.skill} trailing={<TextButton tone="danger" label="REMOVE" onPress={() => void deleteSkill(s.id).then(() => { void list.reload(); onChanged(); }).catch((e) => notify('Could not remove', profileErrorMessage(e)))} />} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------- Preferences / availability / transportation
export function PreferencesEditor({ mode, onChanged }: { mode: 'preferences' | 'availability' | 'transportation'; onChanged: () => void }) {
  const list = useLoad(loadPreferences);
  const [p, setP] = useState<JobPreferences>(EMPTY_PREFERENCES);
  const [titles, setTitles] = useState('');
  const [pay, setPay] = useState('');
  const [startText, setStartText] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (list.data) { setP(list.data); setTitles(list.data.desired_titles.join(', ')); setPay(list.data.pay_min_hourly != null ? String(list.data.pay_min_hourly) : ''); setStartText(textFromIso(list.data.earliest_start_date)); }
  }, [list.data]);
  if (list.loading || list.error) return <LoadState {...list} />;
  const upd = (patch: Partial<JobPreferences>) => { setSaved(false); setP((cur) => ({ ...cur, ...patch })); };
  const submit = async () => {
    const errs: FieldErrors = {};
    let patch: Partial<JobPreferences> = {};
    if (mode === 'preferences') {
      const parsed = parseTitles(titles);
      const tErr = validateTitles(parsed, titles);
      if (tErr) errs.titles = tErr;
      const pp = parsePay(pay);
      if (pp.error) errs.pay = pp.error;
      patch = { desired_titles: parsed, employment_types: p.employment_types, workplace_types: p.workplace_types, pay_min_hourly: pp.value };
    } else if (mode === 'availability') {
      patch = { available_days: p.available_days, shift_preferences: p.shift_preferences, earliest_start_date: startText ? isoFromText(startText) : null };
    } else {
      patch = { transportation_modes: p.transportation_modes, has_drivers_license: p.has_drivers_license };
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await savePreferences(patch); setSaved(true); onChanged(); } catch (e) { notify('Could not save', profileErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View>
      {mode === 'preferences' ? (
        <>
          <Field label="ROLES YOU WANT" value={titles} onChangeText={(v) => { setSaved(false); setTitles(v); }} error={errors.titles} placeholder="Warehouse associate, cook, driver" hint="Up to 5, separated by commas." autoCapitalize="words" />
          <ChipGroup label="JOB TYPE" options={EMPLOYMENT_TYPES} selected={p.employment_types} onChange={(n) => upd({ employment_types: n })} />
          <ChipGroup label="WORKPLACE" options={WORKPLACE_TYPES} selected={p.workplace_types} onChange={(n) => upd({ workplace_types: n })} />
          <Field label="MINIMUM HOURLY PAY" value={pay} onChangeText={(v) => { setSaved(false); setPay(v); }} error={errors.pay} keyboardType="decimal-pad" optional placeholder="18.00" hint="Private to you. It is never shared with employers." />
        </>
      ) : null}
      {mode === 'availability' ? (
        <>
          <ChipGroup label="DAYS YOU CAN WORK" options={DAYS} selected={p.available_days} onChange={(n) => upd({ available_days: n })} />
          <ChipGroup label="SHIFTS" options={SHIFTS} selected={p.shift_preferences} onChange={(n) => upd({ shift_preferences: n })} />
          <FairPathDatePicker label="EARLIEST START DATE" value={startText} onChange={(v) => { setSaved(false); setStartText(v); }} kind="future" optional />
        </>
      ) : null}
      {mode === 'transportation' ? (
        <>
          <ChipGroup label="HOW YOU GET TO WORK" options={TRANSPORT} selected={p.transportation_modes} onChange={(n) => upd({ transportation_modes: n })} />
          <ChipGroup single label="DRIVER'S LICENSE" options={[{ value: 'yes', label: 'I have one' }, { value: 'no', label: 'I do not' }]} selected={p.has_drivers_license === null ? [] : [p.has_drivers_license ? 'yes' : 'no']} onChange={(n) => upd({ has_drivers_license: n[0] === 'yes' ? true : n[0] === 'no' ? false : null })} hint="Optional. Only shared if you choose to include Transportation on an application." />
        </>
      ) : null}
      <PrimaryButton label="SAVE" onPress={() => void submit()} busy={busy} />
      {saved ? <StatusLine tone="success">Saved.</StatusLine> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------- Contact
export function ContactEditor({ onChanged }: { onChanged: () => void }) {
  const list = useLoad(loadContact);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (list.data) { setFirst(list.data.first_name); setLast(list.data.last_name); setPhone(list.data.phone); } }, [list.data]);
  if (list.loading || list.error) return <LoadState {...list} />;
  const submit = async () => {
    const errs: FieldErrors = {};
    if (first.trim().length < 2) errs.first = 'Enter your first name.';
    if (last.trim().length < 2) errs.last = 'Enter your last name.';
    if (phone.replace(/[^0-9]/g, '').length !== 10) errs.phone = 'Enter a 10-digit phone number.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await saveContact({ first_name: first, last_name: last, phone }); setSaved(true); onChanged(); } catch (e) { notify('Could not save', profileErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View>
      <Field label="FIRST NAME" value={first} onChangeText={(v) => { setSaved(false); setFirst(v); }} error={errors.first} autoCapitalize="words" />
      <Field label="LAST NAME" value={last} onChangeText={(v) => { setSaved(false); setLast(v); }} error={errors.last} autoCapitalize="words" />
      <Field label="PHONE" value={phone} onChangeText={(v) => { setSaved(false); setPhone(v); }} error={errors.phone} keyboardType="phone-pad" placeholder="(614) 555-0100" />
      <Panel><BodyText>Email: {list.data?.email || 'Not set'}</BodyText></Panel>
      <PrimaryButton label="SAVE" onPress={() => void submit()} busy={busy} />
      {saved ? <StatusLine tone="success">Saved.</StatusLine> : null}
    </View>
  );
}
