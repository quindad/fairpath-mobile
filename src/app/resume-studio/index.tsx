import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
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
      else setError('We could not load your resumes. Check your connection and try again.');
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
      <PageHeader eyebrow="FAIRPATH" title="Resume Studio" backTo="/me" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40, paddingTop: 8 }}>
        <Panel><BodyText muted>Build a clean, ATS-friendly resume. You can start blank or import your Opportunity Profile as a starting point — importing never changes your profile, and editing here never changes it either.</BodyText></Panel>
        {!resumes && !error ? <ActivityIndicator color={tokens.accentText} style={{ marginTop: 28 }} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}
        {resumes ? (
          <>
            <PrimaryButton label="CREATE A RESUME" onPress={() => router.push('/resume-studio/new' as never)} busy={busy} />
            <View style={{ marginTop: 18 }}><SectionTitle>YOUR RESUMES</SectionTitle></View>
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
