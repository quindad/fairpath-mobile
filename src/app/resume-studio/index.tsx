import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { RESUME_PRACTICAL_HELP } from '@/core/credit/credit-practical-help';
import { deleteResume, duplicateResume, loadResumes, resumeErrorMessage, type Resume } from '@/core/resume/resume-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

export default function ResumeStudio() {
  const { tokens } = useFairPathTheme();
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setResumes(await loadResumes()); }
    catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/resume-studio')) as never);
      else { setResumes(null); setError('We could not load your resumes. Check your connection and try again.'); }
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function copy(id: string) {
    setBusy(true);
    try { const d = await duplicateResume(id); await load(); router.push(('/resume-studio/' + d.id) as never); }
    catch (e) { notify('Could not duplicate', resumeErrorMessage(e)); } finally { setBusy(false); }
  }
  function remove(r: Resume) {
    notify('Delete this resume?', `"${r.title}" will be removed. This cannot be undone.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
      setBusy(true);
      deleteResume(r.id).then(load).catch((e) => notify('Could not delete', resumeErrorMessage(e))).finally(() => setBusy(false));
    } }]);
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FAIRPATH · RESUME STUDIO" title="Build your resume" backTo="/me" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40, paddingTop: 8 }}>
        <Panel tone="accent">
          <BodyText strong>Free for everyone</BodyText>
          <BodyText muted>Build a clean, ATS-friendly resume. Import your Opportunity Profile as a starting point — importing never changes your profile, and editing here never changes it either.</BodyText>
        </Panel>

        <View style={{ marginTop: 16 }}><SectionTitle>SIGNAL · AI HELP</SectionTitle></View>
        <Panel>
          <BodyText muted>Signal can strengthen bullets you wrote, help phrase employment gaps honestly, or point you to fair-chance job search — it never invents jobs or credentials.</BodyText>
          <SecondaryButton label="HELP WITH AN EMPLOYMENT GAP" onPress={() => router.push('/fairpath-ai?q=' + encodeURIComponent('Help me explain an employment gap on my resume') as never)} />
          <SecondaryButton label="PRACTICE FOR AN INTERVIEW" onPress={() => router.push('/fairpath-ai?q=' + encodeURIComponent('Help me prepare for a job interview') as never)} />
          <SecondaryButton label="OPEN SIGNAL ASSISTANT" onPress={() => router.push('/fairpath-ai' as never)} />
        </Panel>

        <View style={{ marginTop: 16 }}><SectionTitle>TIPS</SectionTitle></View>
        {RESUME_PRACTICAL_HELP.map((card) => (
          <Panel key={card.id}>
            <BodyText strong>{card.title}</BodyText>
            <BodyText muted>{card.body}</BodyText>
            {card.route ? <SecondaryButton label={card.route.startsWith('/') ? 'OPEN IN FAIRPATH' : 'LEARN MORE'} onPress={() => router.push(card.route as never)} /> : null}
            {card.signalPrompt ? <SecondaryButton label="ASK SIGNAL" onPress={() => router.push('/fairpath-ai?q=' + encodeURIComponent(card.signalPrompt!) as never)} /> : null}
          </Panel>
        ))}

        {!resumes && !error ? <ActivityIndicator color={tokens.accentText} style={{ marginTop: 28 }} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}
        {resumes ? (
          <>
            <View style={{ marginTop: 18 }}><SectionTitle>YOUR RESUMES</SectionTitle></View>
            <PrimaryButton label="CREATE A RESUME" onPress={() => router.push('/resume-studio/new' as never)} busy={busy} />
            {resumes.length === 0 ? <EmptyState title="No resumes yet" body="Create your first resume to get started." /> : null}
            {resumes.map((r) => (
              <ListRow key={r.id} title={r.title} body={[r.target_role, 'Updated ' + new Date(r.updated_at).toLocaleDateString()].filter(Boolean).join(' · ')} onPress={() => router.push(('/resume-studio/' + r.id) as never)}
                trailing={<View style={{ flexDirection: 'row', gap: 4 }}><TextButton label="COPY" onPress={() => void copy(r.id)} /><TextButton tone="danger" label="DELETE" onPress={() => remove(r)} /></View>} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}
