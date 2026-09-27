import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ChipGroup, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { listMyDocuments } from '@/core/documents/document-service';
import { cancelAccountDeletion, loadConsentState, loadDeletionStatus, requestAccountDeletion, type ConsentState, type DeletionStatus } from '@/core/profile/member-summary';
import { recordConsent } from '@/core/profile/consent-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';
import { supabase } from '@/lib/supabase';

const SHARING: { who: string; body: string }[] = [
  { who: 'Employers', body: 'Never see your live profile. If you choose, a copy of only the parts you pick is attached to a job application at the moment you apply. It never includes your date of birth, home address or any justice-related information.' },
  { who: 'Landlords and housing partners', body: 'Receive only the answers you enter and submit in a housing application. FairPath does not send them your justice-related information, credit information or Opportunity Profile.' },
  { who: 'Caseworkers and organizations', body: 'FairPath does not share anything with them on its own. If we ever offer sharing, it will need your explicit consent and your choice of exactly what is included.' },
  { who: 'Your documents', body: 'Private to you. FairPath never sends a document to anyone. Sharing always starts with a button you press.' },
  { who: 'Your justice-related information', body: 'Used only to help you (readiness, record relief, credit). It is not part of your Opportunity Profile and is never shown to employers or landlords.' },
];

const EXPORT_LABEL: Record<string, string> = { preview: 'Previewed', download: 'Downloaded', share_sheet_opened: 'Share sheet opened', save_to_files: 'Saved to Files', print: 'Printed', regenerate: 'New version created' };

type ExportRow = { id: string; title: string; action: string; platform: string; created_at: string };

export default function PrivacyScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [consent, setConsent] = useState<Record<string, ConsentState> | null>(null);
  const [deletion, setDeletion] = useState<DeletionStatus>(null);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [c, d, docs, ev] = await Promise.all([
        loadConsentState(), loadDeletionStatus(), listMyDocuments().catch(() => []),
        supabase.from('document_export_events').select('id,document_id,action,platform,created_at').order('created_at', { ascending: false }).limit(10),
      ]);
      setConsent(c);
      setDeletion(d);
      const titles = Object.fromEntries(docs.map((x) => [x.doc.id, `${x.doc.title} (v${x.doc.version})`]));
      setExports(((ev.data ?? []) as { id: string; document_id: string; action: string; platform: string; created_at: string }[]).map((e) => ({ id: e.id, title: titles[e.document_id] ?? 'A document', action: e.action, platform: e.platform, created_at: e.created_at })));
    } catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/privacy')) as never);
      else setError('We could not load your privacy settings. Check your connection and try again.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const marketing = consent?.marketing_opt_in && (!consent.marketing_opt_out || new Date(consent.marketing_opt_in.created_at) > new Date(consent.marketing_opt_out.created_at));

  async function toggleMarketing(next: boolean) {
    setBusy(true);
    try { await recordConsent(next ? 'marketing_opt_in' : 'marketing_opt_out'); await load(); } catch { notify('Could not save', 'Please try again.'); } finally { setBusy(false); }
  }
  async function requestDeletion() {
    setBusy(true);
    try { await requestAccountDeletion(reason[0]); setConfirming(false); await load(); } catch { notify('Could not send the request', 'Please try again.'); } finally { setBusy(false); }
  }
  async function cancelDeletion() {
    setBusy(true);
    try { await cancelAccountDeletion(); await load(); } catch { notify('Could not cancel', 'The request may already be in progress. Contact support if you need help.'); } finally { setBusy(false); }
  }

  const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const stamp = (k: string) => (consent?.[k] ? `${consent[k].granted ? 'Accepted' : 'Withdrawn'} ${date(consent[k].created_at)}${consent[k].document_version ? ' · ' + consent[k].document_version : ''}` : 'Not recorded');

  return (
    <ScreenFrame>
      <PageHeader eyebrow="YOUR ACCOUNT" title="Privacy and account" backTo="/me" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        {!consent && !error ? <ActivityIndicator color={tokens.accentText} style={{ marginTop: 28 }} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}

        <View style={s.block}><SectionTitle>WHAT FAIRPATH DOES NOT AUTOMATICALLY SHARE</SectionTitle></View>
        <BodyText muted>FairPath does not sell your information and does not send it to anyone unless you press a button that says so.</BodyText>
        {SHARING.map((x) => (
          <Panel key={x.who}>
            <Text style={s.who}>{x.who}</Text>
            <BodyText>{x.body}</BodyText>
          </Panel>
        ))}

        {consent ? (
          <>
            <View style={s.block}><SectionTitle>YOUR AGREEMENTS AND CHOICES</SectionTitle></View>
            <ListRow title="Terms of Service" body={stamp('terms_accepted')} />
            <ListRow title="Privacy Policy" body={stamp('privacy_accepted')} />
            <ListRow title="Justice-history disclosure consent" body={stamp('justice_history_disclosure_consent') + ' · managed in Justice readiness'} onPress={() => router.push('/profile-readiness' as never)} />
            <View style={s.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.who}>Product and update emails</Text>
                <BodyText muted>{marketing ? 'You are subscribed.' : 'You are not subscribed. FairPath still sends account and safety messages.'}</BodyText>
              </View>
              <SecondaryButton label={marketing ? 'UNSUBSCRIBE' : 'SUBSCRIBE'} onPress={() => void toggleMarketing(!marketing)} disabled={busy} />
            </View>
          </>
        ) : null}

        <View style={s.block}><SectionTitle>DOCUMENT RETENTION</SectionTitle></View>
        <Panel>
          <BodyText>By default FairPath keeps only a record that you created a document, not the file. Sensitive documents (credit and record relief) are never stored unless you choose to keep a copy for 30 or 90 days. You can delete a stored copy any time in My Documents.</BodyText>
          <BodyText muted>A file you download or share leaves FairPath. FairPath cannot recall it from your device or another app.</BodyText>
        </Panel>
        <ListRow title="Open My Documents" body="Versions, stored copies and deletion" onPress={() => router.push('/documents' as never)} />

        {exports.length ? (
          <>
            <View style={s.block}><SectionTitle>RECENT EXPORT ACTIVITY</SectionTitle></View>
            <BodyText muted>What you did with your documents. FairPath records the action, not the contents.</BodyText>
            {exports.map((e) => <ListRow key={e.id} title={e.title} body={`${EXPORT_LABEL[e.action] ?? e.action} · ${e.platform} · ${date(e.created_at)}`} />)}
          </>
        ) : null}

        <View style={s.block}><SectionTitle>DELETE MY ACCOUNT</SectionTitle></View>
        {deletion && (deletion.status === 'requested' || deletion.status === 'processing') ? (
          <Panel tone="warning">
            <Text style={s.alert}>{deletion.status === 'processing' ? 'Deletion is being processed' : 'Deletion requested'}</Text>
            <BodyText>
              {deletion.status === 'processing'
                ? 'Your request is in progress and can no longer be cancelled here. Contact support if you need help.'
                : `Your account has NOT been deleted. It is scheduled for review on ${date(deletion.scheduled_for)}. Until processing starts you can cancel and nothing changes.`}
            </BodyText>
            {deletion.status === 'requested' ? <SecondaryButton label="CANCEL THE DELETION REQUEST" onPress={() => void cancelDeletion()} disabled={busy} /> : null}
          </Panel>
        ) : (
          <Panel>
            <BodyText>You can ask FairPath to delete your account and the data in it. This is a request: nothing is deleted immediately, and you can cancel during a 14-day waiting period. FairPath cannot recall files you already downloaded or shared, or applications already received by an employer or housing provider.</BodyText>
            {!confirming ? (
              <SecondaryButton tone="danger" label="REQUEST ACCOUNT DELETION" onPress={() => setConfirming(true)} />
            ) : (
              <View>
                <ChipGroup single label="WHY ARE YOU LEAVING? (OPTIONAL)" options={[{ value: 'no_longer_needed', label: 'No longer need it' }, { value: 'privacy', label: 'Privacy' }, { value: 'duplicate_account', label: 'Duplicate account' }, { value: 'other', label: 'Other' }]} selected={reason} onChange={setReason} />
                <PrimaryButton label="SEND DELETION REQUEST" onPress={() => void requestDeletion()} busy={busy} />
                <SecondaryButton label="KEEP MY ACCOUNT" onPress={() => setConfirming(false)} />
              </View>
            )}
          </Panel>
        )}
        {deletion?.status === 'failed' ? <StatusLine tone="warning">A previous deletion attempt could not be completed. Contact support to continue.</StatusLine> : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  block: { marginTop: 24 },
  who: { color: t.text, fontFamily: F.extraBold, fontSize: 14, marginBottom: 4 },
  alert: { color: t.warning, fontFamily: F.extraBold, fontSize: 14, marginBottom: 4 },
  toggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 10 },
});
