import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ExportPanel } from '@/components/ExportPanel';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { SpecPreview } from '@/components/SpecPreview';
import { BodyText, ChipGroup, Field, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { buildResume } from '@/core/documents/builders/resume';
import { generateFromSpec, type GeneratedDocument } from '@/core/documents/generate';
import { EMPTY_RESUME_CONTENT, RESUME_TEMPLATES, type ResumeContent, type ResumeExperience } from '@/core/resume/resume-types';
import { importFromProfile, loadResume, resumeErrorMessage, updateResume, type Resume } from '@/core/resume/resume-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

const emptyExperience = (): ResumeExperience => ({ title: '', employer: '', location: '', start: '', end: '', current: false, bullets: [''] });

export default function ResumeEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useFairPathTheme();
  const [resume, setResume] = useState<Resume | null>(null);
  const [content, setContent] = useState<ResumeContent>(EMPTY_RESUME_CONTENT);
  const [title, setTitle] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [template, setTemplate] = useState<string[]>(['classic']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await loadResume(id);
      setResume(r); setContent(r.content); setTitle(r.title); setTargetRole(r.target_role ?? ''); setTemplate([r.template]);
    } catch { setError('We could not load this resume.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const spec = useMemo(() => buildResume(title, content), [title, content]);

  async function save() {
    if (!id) return;
    setBusy(true);
    try { await updateResume(id, { title: title.trim() || 'My resume', target_role: targetRole.trim() || null, template: (template[0] as 'classic' | 'compact') ?? 'classic', content }); setSaved(true); }
    catch (e) { notify('Could not save', resumeErrorMessage(e)); } finally { setBusy(false); }
  }
  function touch<T>(setter: (v: T) => void) { return (v: T) => { setter(v); setSaved(false); }; }

  async function doImport(overwrite: boolean) {
    setBusy(true);
    try { setContent(await importFromProfile(content, overwrite)); setSaved(false); notify('Imported', overwrite ? 'Your resume now matches your Opportunity Profile. Nothing in your profile changed.' : 'Empty sections were filled from your Opportunity Profile. Nothing in your profile changed.'); }
    catch (e) { notify('Could not import', resumeErrorMessage(e)); } finally { setBusy(false); }
  }

  async function make(format: 'pdf' | 'docx') {
    if (!saved) { notify('Save first', 'Save your changes before exporting.'); return; }
    setBusy(true);
    try { setGenerated(await generateFromSpec(spec, format)); } catch (e) { notify('Could not create the resume file', resumeErrorMessage(e)); } finally { setBusy(false); }
  }

  const setContact = (p: Partial<ResumeContent['contact']>) => touch(setContent)({ ...content, contact: { ...content.contact, ...p } });
  const setExperience = (i: number, p: Partial<ResumeExperience>) => touch(setContent)({ ...content, experience: content.experience.map((e, n) => (n === i ? { ...e, ...p } : e)) });
  const addExperience = () => touch(setContent)({ ...content, experience: [...content.experience, emptyExperience()] });
  const removeExperience = (i: number) => touch(setContent)({ ...content, experience: content.experience.filter((_, n) => n !== i) });
  const setBullet = (ei: number, bi: number, v: string) => setExperience(ei, { bullets: content.experience[ei].bullets.map((b, n) => (n === bi ? v : b)) });
  const addBullet = (ei: number) => setExperience(ei, { bullets: [...content.experience[ei].bullets, ''] });
  const setSkills = (v: string) => touch(setContent)({ ...content, skills: v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40) });

  if (error) return <ScreenFrame><PageHeader eyebrow="RESUME STUDIO" title="Resume" backTo="/resume-studio" alwaysBackTo /><View style={{ paddingHorizontal: L.mobileGutter }}><StatusLine tone="error">{error}</StatusLine></View></ScreenFrame>;
  if (!resume) return <ScreenFrame><PageHeader eyebrow="RESUME STUDIO" title="Resume" backTo="/resume-studio" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RESUME STUDIO" title={title || 'Resume'} backTo="/resume-studio" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <Field label="RESUME TITLE" value={title} onChangeText={touch(setTitle)} />
        <Field label="TARGET ROLE" value={targetRole} onChangeText={touch(setTargetRole)} optional />
        <ChipGroup single label="TEMPLATE" options={RESUME_TEMPLATES} selected={template} onChange={(n) => touch(setTemplate)(n.length ? n : template)} />
        <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
          <SecondaryButton label="IMPORT MISSING FROM PROFILE" onPress={() => void doImport(false)} disabled={busy} />
        </View>
        <TextButton label="REPLACE EVERYTHING WITH MY PROFILE" onPress={() => notify('Replace this resume\'s content?', 'This overwrites your contact info, experience, education, skills and credentials below with what is currently in your Opportunity Profile. Your profile itself is never changed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace', style: 'destructive', onPress: () => void doImport(true) }])} />

        <View style={{ marginTop: 18 }}><SectionTitle>CONTACT</SectionTitle></View>
        <Field label="NAME" value={content.contact.name} onChangeText={(v) => setContact({ name: v })} />
        <Field label="EMAIL" value={content.contact.email} onChangeText={(v) => setContact({ email: v })} keyboardType="email-address" />
        <Field label="PHONE" value={content.contact.phone} onChangeText={(v) => setContact({ phone: v })} keyboardType="phone-pad" />
        <Field label="LOCATION" value={content.contact.location} onChangeText={(v) => setContact({ location: v })} optional />

        <View style={{ marginTop: 18 }}><SectionTitle>SUMMARY</SectionTitle></View>
        <Field label="PROFESSIONAL SUMMARY" value={content.summary} onChangeText={(v) => touch(setContent)({ ...content, summary: v })} multiline maxLength={800} optional />

        <View style={{ marginTop: 18 }}><SectionTitle>EXPERIENCE</SectionTitle></View>
        {content.experience.map((e, i) => (
          <Panel key={i}>
            <Field label="JOB TITLE" value={e.title} onChangeText={(v) => setExperience(i, { title: v })} />
            <Field label="EMPLOYER" value={e.employer} onChangeText={(v) => setExperience(i, { employer: v })} />
            <Field label="LOCATION" value={e.location} onChangeText={(v) => setExperience(i, { location: v })} optional />
            <Field label="START (E.G. MAR 2021)" value={e.start} onChangeText={(v) => setExperience(i, { start: v })} optional />
            <Field label="END (LEAVE BLANK IF CURRENT)" value={e.end} onChangeText={(v) => setExperience(i, { end: v })} optional />
            {e.bullets.map((b, bi) => (
              <Field key={bi} label={bi === 0 ? 'HIGHLIGHTS (ONE PER LINE)' : ''} value={b} onChangeText={(v) => setBullet(i, bi, v)} optional />
            ))}
            <TextButton label="+ ADD A LINE" onPress={() => addBullet(i)} />
            <TextButton tone="danger" label="REMOVE THIS ROLE" onPress={() => removeExperience(i)} />
          </Panel>
        ))}
        <SecondaryButton label="+ ADD EXPERIENCE" onPress={addExperience} />

        <View style={{ marginTop: 18 }}><SectionTitle>SKILLS</SectionTitle></View>
        <Field label="SKILLS (COMMA-SEPARATED)" value={content.skills.join(', ')} onChangeText={setSkills} optional />

        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        <View style={{ marginTop: 18 }}><SectionTitle>SAVE &amp; EXPORT</SectionTitle></View>
        <PrimaryButton label={saved ? 'SAVED' : 'SAVE CHANGES'} onPress={() => void save()} busy={busy} disabled={saved} />
        {!saved ? <StatusLine tone="muted">Save before exporting so the file matches what you see.</StatusLine> : null}
        <SpecPreview title={spec.title} blocks={spec.blocks} footer={spec.footer} />
        <PrimaryButton label="EXPORT PDF" onPress={() => void make('pdf')} busy={busy} />
        <PrimaryButton label="EXPORT DOCX" onPress={() => void make('docx')} busy={busy} />
        {generated ? <ExportPanel result={generated} onChange={setGenerated} onDeleted={() => setGenerated(null)} /> : null}
      </FormScrollView>
    </ScreenFrame>
  );
}
