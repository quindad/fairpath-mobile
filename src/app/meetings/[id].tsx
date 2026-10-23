import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, View } from 'react-native';
import {InlineBadge, PageHeader, ScreenFrame, SectionTitle, ScreenScroll, ScreenColumn } from '@/components/ProductChrome';
import { BodyText, Field, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import {
  MEETING_TYPE_LABEL, PROVIDER_LABEL, STATUS_LABEL, canUpdateMeetingStatus, deleteMeeting, loadMeeting, meetingsErrorMessage, setMeetingStatus, updateMeeting, type Meeting,
} from '@/core/meetings/meetings-service';
import { prepareForMeeting } from '@/core/ai/signal';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function MeetingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useFairPathTheme();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [when, setWhen] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [prepText, setPrepText] = useState('');
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepRequested, setPrepRequested] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try { setMeeting(await loadMeeting(id)); } catch { setError('We could not load this meeting.'); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function askSignal() {
    if (!id || prepLoading) return;
    setPrepLoading(true); setPrepRequested(true);
    try {
      const r = await prepareForMeeting(id);
      if (r.status === 'ok') setPrepText(r.text);
      else if (r.status === 'out_of_credits') setPrepText('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setPrepText('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') { router.replace(('/sign-in?returnTo=' + encodeURIComponent('/meetings/' + id)) as never); return; }
      else setPrepText(r.message);
    } catch { setPrepText('Signal could not prepare meeting tips right now. Please try again.'); }
    finally { setPrepLoading(false); }
  }

  async function setStatus(status: 'confirmed' | 'completed' | 'cancelled' | 'no_show', reason?: string) {
    if (!id) return;
    setBusy(true);
    try { setMeeting(await setMeetingStatus(id, status, reason)); } catch (e) { notify('Could not update', meetingsErrorMessage(e)); } finally { setBusy(false); }
  }
  function confirmCancel() {
    notify('Cancel this meeting?', 'This cannot be undone.', [{ text: 'Never mind', style: 'cancel' }, { text: 'Cancel meeting', style: 'destructive', onPress: () => { void setStatus('cancelled', cancelReason.trim() || undefined); setCancelling(false); setCancelReason(''); } }]);
  }
  function remove() {
    if (!id) return;
    notify('Delete this meeting?', 'This removes it from your list entirely.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
      setBusy(true); deleteMeeting(id).then(() => router.replace('/meetings' as never)).catch((e) => notify('Could not delete', meetingsErrorMessage(e))).finally(() => setBusy(false));
    } }]);
  }
  async function saveReschedule() {
    if (!id) return;
    const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/.exec(when.trim());
    if (!m) { notify('Not a valid date', 'Use the format YYYY-MM-DD HH:MM, for example 2026-10-15 14:30.'); return; }
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    setBusy(true);
    try { setMeeting(await updateMeeting(id, { start_at: d.toISOString() })); setRescheduling(false); } catch (e) { notify('Could not reschedule', meetingsErrorMessage(e)); } finally { setBusy(false); }
  }

  if (error) return <ScreenFrame><PageHeader eyebrow="MEETING" title="Meeting" backTo="/meetings" alwaysBackTo /><View style={{ paddingHorizontal: L.mobileGutter }}><StatusLine tone="error">{error}</StatusLine></View></ScreenFrame>;
  if (!meeting) return <ScreenFrame><PageHeader eyebrow="MEETING" title="Meeting" backTo="/meetings" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  const future = new Date(meeting.start_at).getTime() >= Date.now();
  const upcoming = future && meeting.status !== 'cancelled';
  const canUpdateStatus = canUpdateMeetingStatus(meeting.status);

  return (
    <ScreenFrame>
      <PageHeader eyebrow={MEETING_TYPE_LABEL[meeting.meeting_type].toUpperCase()} title={meeting.title} backTo="/meetings" alwaysBackTo />
      <View style={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <Panel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <BodyText strong>{fmt(meeting.start_at)}</BodyText>
            <InlineBadge tone={meeting.status === 'confirmed' ? 'lime' : 'default'}>{STATUS_LABEL[meeting.status]}</InlineBadge>
          </View>
          {meeting.organization_name ? <BodyText muted>{meeting.organization_name}</BodyText> : null}
          {meeting.host_name ? <BodyText muted>Host: {meeting.host_name}{meeting.host_contact ? ` (${meeting.host_contact})` : ''}</BodyText> : null}
          <BodyText muted>Via {PROVIDER_LABEL[meeting.provider]}</BodyText>
          {meeting.location_text ? <BodyText muted>{meeting.location_text}</BodyText> : null}
          {meeting.instructions ? <BodyText>{meeting.instructions}</BodyText> : null}
          {meeting.cancelled_reason ? <StatusLine tone="muted">Cancelled: {meeting.cancelled_reason}</StatusLine> : null}
        </Panel>

        {upcoming && meeting.meeting_url ? <PrimaryButton label="JOIN MEETING" onPress={() => void Linking.openURL(meeting.meeting_url!)} /> : null}

        {upcoming ? (
          <>
            <View style={{ marginTop: 18 }}><SectionTitle>SIGNAL</SectionTitle></View>
            {prepRequested ? <Panel><BodyText muted>{prepLoading ? 'Signal is thinking…' : prepText}</BodyText></Panel> : null}
            <SecondaryButton label={prepLoading ? 'ASKING SIGNAL…' : 'PREP FOR THIS MEETING WITH SIGNAL'} onPress={() => void askSignal()} disabled={prepLoading} />
          </>
        ) : null}

        {canUpdateStatus ? (
          <>
            <View style={{ marginTop: 18 }}><SectionTitle>UPDATE</SectionTitle></View>
            {meeting.status === 'scheduled' ? <SecondaryButton label="MARK CONFIRMED" onPress={() => void setStatus('confirmed')} disabled={busy} /> : null}
            {meeting.status === 'confirmed' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SecondaryButton label="MARK COMPLETED" onPress={() => void setStatus('completed')} disabled={busy} />
                <SecondaryButton label="MARK NO-SHOW" onPress={() => void setStatus('no_show')} disabled={busy} />
              </View>
            ) : null}
            {future ? (rescheduling ? (
              <>
                <Field label="NEW DATE AND TIME (YYYY-MM-DD HH:MM)" value={when} onChangeText={setWhen} placeholder="2026-10-20 10:00" />
                <PrimaryButton label="SAVE NEW TIME" onPress={() => void saveReschedule()} disabled={busy} />
              </>
            ) : <TextButton label="RESCHEDULE" onPress={() => setRescheduling(true)} />) : null}
            {cancelling ? (
              <>
                <Field label="WHY ARE YOU CANCELLING? (OPTIONAL)" value={cancelReason} onChangeText={setCancelReason} placeholder="e.g. conflict came up" optional />
                <PrimaryButton label="CANCEL MEETING" onPress={confirmCancel} disabled={busy} />
                <TextButton label="NEVER MIND" onPress={() => { setCancelling(false); setCancelReason(''); }} />
              </>
            ) : <TextButton tone="danger" label="CANCEL MEETING" onPress={() => setCancelling(true)} />}
          </>
        ) : null}
        <TextButton tone="danger" label="DELETE" onPress={remove} />
      </View>
    </ScreenFrame>
  );
}
