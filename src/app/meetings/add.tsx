import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { BodyText, ChipGroup, Field, Panel, PrimaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { createMeeting, meetingsErrorMessage, MEETING_TYPE_LABEL, PROVIDER_LABEL, type MeetingProvider, type MeetingType } from '@/core/meetings/meetings-service';
import { notify } from '@/core/ui/notify';

const TYPES = (Object.keys(MEETING_TYPE_LABEL) as MeetingType[]).map((v) => ({ value: v, label: MEETING_TYPE_LABEL[v] }));
const PROVIDERS = (Object.keys(PROVIDER_LABEL) as MeetingProvider[]).map((v) => ({ value: v, label: PROVIDER_LABEL[v] }));

/** Parses "YYYY-MM-DD HH:MM" (24-hour, local time) into an ISO string, or null if it doesn't parse. */
function parseLocal(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AddMeeting() {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string[]>(['employer_interview']);
  const [org, setOrg] = useState('');
  const [host, setHost] = useState('');
  const [provider, setProvider] = useState<string[]>(['zoom']);
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    const startAt = parseLocal(when);
    if (title.trim().length < 2) { setError('Enter a title.'); return; }
    if (!startAt) { setError('Enter the date and time as YYYY-MM-DD HH:MM, for example 2026-10-15 14:30.'); return; }
    if (url.trim() && !/^https?:\/\//i.test(url.trim())) { setError('The meeting link must start with http:// or https://.'); return; }
    setBusy(true);
    try {
      const m = await createMeeting({
        title: title.trim(), meeting_type: type[0] as MeetingType, organization_name: org.trim() || null, host_name: host.trim() || null,
        provider: provider[0] as MeetingProvider, meeting_url: url.trim() || null, location_text: location.trim() || null, start_at: startAt,
        instructions: instructions.trim() || null,
      });
      router.replace(('/meetings/' + m.id) as never);
    } catch (e) { notify('Could not save', meetingsErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="MEETINGS" title="Add a meeting" backTo="/meetings" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <Panel><BodyText muted>FairPath does not host the call — add the link or location the host gave you, and FairPath keeps track of it for you.</BodyText></Panel>
        <Field label="TITLE" value={title} onChangeText={setTitle} placeholder="Interview with Acme Logistics" />
        <ChipGroup single label="TYPE" options={TYPES} selected={type} onChange={(n) => setType(n.length ? n : type)} />
        <Field label="ORGANIZATION" value={org} onChangeText={setOrg} optional />
        <Field label="HOST NAME" value={host} onChangeText={setHost} optional />
        <ChipGroup single label="PROVIDER" options={PROVIDERS} selected={provider} onChange={(n) => setProvider(n.length ? n : provider)} />
        <Field label="MEETING LINK" value={url} onChangeText={setUrl} placeholder="https://zoom.us/j/..." optional keyboardType="url" />
        <Field label="LOCATION (IF IN PERSON)" value={location} onChangeText={setLocation} optional />
        <View style={{ marginTop: 4 }}><SectionTitle>DATE AND TIME</SectionTitle></View>
        <Field label="DATE AND TIME (YYYY-MM-DD HH:MM, YOUR LOCAL TIME)" value={when} onChangeText={setWhen} placeholder="2026-10-15 14:30" />
        <Field label="NOTES / INSTRUCTIONS" value={instructions} onChangeText={setInstructions} multiline optional />
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        <PrimaryButton label="SAVE MEETING" onPress={() => void save()} busy={busy} />
      </FormScrollView>
    </ScreenFrame>
  );
}
