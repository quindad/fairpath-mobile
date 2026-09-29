import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { MEETING_TYPE_LABEL, STATUS_LABEL, loadMeetings, type Meeting } from '@/core/meetings/meetings-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';

const when = (m: Meeting) => new Date(m.start_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const badgeTone = (s: Meeting['status']) => (s === 'confirmed' ? 'lime' : s === 'cancelled' || s === 'no_show' ? 'default' : 'default') as 'lime' | 'default';

export default function Meetings() {
  const { tokens } = useFairPathTheme();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setMeetings(await loadMeetings()); }
    catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/meetings')) as never);
      else { setMeetings(null); setError('We could not load your meetings. Check your connection and try again.'); }
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const now = Date.now();
  const upcoming = useMemo(() => (meetings ?? []).filter((m) => new Date(m.start_at).getTime() >= now && m.status !== 'cancelled').sort((a, b) => a.start_at.localeCompare(b.start_at)), [meetings, now]);
  const past = useMemo(() => (meetings ?? []).filter((m) => new Date(m.start_at).getTime() < now || m.status === 'cancelled').sort((a, b) => b.start_at.localeCompare(a.start_at)), [meetings, now]);

  const row = (m: Meeting) => (
    <ListRow key={m.id} title={m.title} body={`${when(m)} · ${MEETING_TYPE_LABEL[m.meeting_type]}${m.organization_name ? ' · ' + m.organization_name : ''}`}
      onPress={() => router.push(('/meetings/' + m.id) as never)} trailing={<InlineBadge tone={badgeTone(m.status)}>{STATUS_LABEL[m.status]}</InlineBadge>} />
  );

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FAIRPATH" title="Meetings" backTo="/me" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40, paddingTop: 8 }}>
        <Panel><BodyText muted>Track interviews, appointments and workshops in one place. FairPath does not host video calls — you join through the link the host gave you.</BodyText></Panel>
        {!meetings && !error ? <ActivityIndicator color={tokens.accentText} style={{ marginTop: 28 }} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}
        {meetings ? (
          <>
            <PrimaryButton label="ADD A MEETING" onPress={() => router.push('/meetings/add' as never)} />
            <View style={{ marginTop: 18 }}><SectionTitle>UPCOMING</SectionTitle></View>
            {upcoming.length === 0 ? <EmptyState title="Nothing scheduled" body="Add a meeting to keep track of it here." /> : upcoming.map(row)}
            {past.length ? <><View style={{ marginTop: 18 }}><SectionTitle>PAST</SectionTitle></View>{past.map(row)}</> : null}
          </>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}
