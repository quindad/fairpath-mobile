import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { openGoogleMaps } from '@/core/location/maps';
import {
  accessibilityLabels,
  costLabel,
  eligibilityLine,
  formatHours,
  freshnessLabel,
  languageLabels,
  modeLabel,
  openNowLabel,
  provenanceBadge,
  safeExternalUrl,
  telUrl,
  verifiedOn,
} from '@/core/resources/resource-format';
import {
  isSignedIn,
  loadResourceCategories,
  loadResourceDetail,
  loadResourceStates,
  reportResource,
  resourceActionMessage,
  saveResource,
  setResourceProgress,
  unsaveResource,
  type ReportReason,
  type ResourceDetail,
  type ResourceMemberState,
} from '@/core/resources/resources-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

const AUTHORITY: Record<string, string> = {
  government: 'Government source',
  nonprofit: 'Nonprofit source',
  partner_submitted: 'Submitted by the organization',
  community: 'Community source',
  test_fixture: 'Test data',
};

const REPORT_REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'wrong_info', label: 'Information is wrong' },
  { reason: 'closed', label: 'It has closed or moved' },
  { reason: 'scam_or_fee', label: 'Asked for money or seems like a scam' },
  { reason: 'unsafe', label: 'Unsafe or harmful' },
  { reason: 'other', label: 'Something else' },
];

function Sec({ children }: { children: React.ReactNode }) {
  const s = useThemedStyles(styles);
  return <View style={s.sec}><SectionTitle>{children}</SectionTitle></View>;
}

export default function ResourceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [member, setMember] = useState<ResourceMemberState>({ is_saved: false, progress: null });
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    isSignedIn()
      .then((ok) => (ok ? loadResourceStates([id]) : null))
      .then((states) => active && states && states[id] && setMember(states[id]))
      .catch(() => {});
    loadResourceCategories().then((c) => active && setLabels(Object.fromEntries(c.map((x) => [x.slug, x.label])))).catch(() => {});
    loadResourceDetail(id)
      .then((r) => active && setResource(r))
      .catch(() => active && setError('This resource could not be loaded. Check your connection and try again.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  /** Runs a member-only action. Guests are sent to sign in and returned here afterward. */
  async function memberAction(action: () => Promise<void>) {
    if (!id || busy) return;
    if (!(await isSignedIn())) {
      router.push(('/sign-in?returnTo=' + encodeURIComponent('/resource/' + id)) as never);
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify('That did not work', resourceActionMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const toggleSave = () =>
    memberAction(async () => {
      if (member.is_saved) await unsaveResource(id as string);
      else await saveResource(id as string);
      setMember((m) => ({ ...m, is_saved: !m.is_saved }));
    });

  const setProgress = (state: 'started' | 'completed' | 'cleared') =>
    memberAction(async () => {
      await setResourceProgress(id as string, state);
      setMember((m) => ({ ...m, progress: state === 'cleared' ? null : state }));
    });

  const submitReport = () =>
    memberAction(async () => {
      if (!reportReason) {
        notify('Choose a reason', 'Pick what is wrong so we can review it.');
        return;
      }
      await reportResource(id as string, reportReason, reportNote);
      setReportDone(true);
      setReportOpen(false);
      setReportNote('');
      setReportReason(null);
    });

  async function open(url: string | null) {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      notify('Could not open link', 'Your device could not open this link.');
    }
  }

  async function directions(query: string) {
    try {
      await openGoogleMaps(query);
    } catch {
      notify('Maps unavailable', 'Your device could not open a maps app.');
    }
  }

  const fresh = resource ? freshnessLabel(resource.freshness) : { label: '', tone: 'none' as const };
  const test = resource ? provenanceBadge(resource.data_origin) : '';
  const apply = resource ? safeExternalUrl(resource.application_url) : null;
  const source = resource ? safeExternalUrl(resource.official_source_url) : null;
  const primaryPhone = resource?.contacts.find((c) => c.method === 'phone' && telUrl(c.value));

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RESOURCE" title="Details" backTo="/resources" />
      <FormScrollView contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {!loading && !error && !resource ? (
          <View style={s.box}>
            <Text style={s.boxTitle}>This resource is not available</Text>
            <Text style={s.body}>
              FairPath only shows resources that are verified and current. This one may have been removed, closed or is
              waiting to be re-verified.
            </Text>
          </View>
        ) : null}

        {resource ? (
          <>
            <View style={s.badges}>
              {fresh.tone === 'ok' ? <InlineBadge tone="lime">{fresh.label}</InlineBadge> : null}
              {resource.cost_type === 'free' ? <InlineBadge>FREE</InlineBadge> : null}
              {resource.urgency_tier === 2 && resource.freshness === 'fresh' ? <InlineBadge>HELP TODAY</InlineBadge> : null}
              {test ? <InlineBadge>{test}</InlineBadge> : null}
            </View>
            <Text style={s.title}>{resource.title}</Text>
            <Text style={s.org}>{resource.organization.name}</Text>
            {resource.categories.length ? (
              <Text style={s.cats}>{resource.categories.map((c) => labels[c] ?? c).join(' · ')}</Text>
            ) : null}

            {fresh.tone === 'warn' ? (
              <View style={s.warn}>
                <Text style={s.warnTitle}>This information may be out of date</Text>
                <Text style={s.warnBody}>
                  It was last verified {verifiedOn(resource.last_verified_at) || 'a while ago'}. Call or check the
                  organization&apos;s site before you go.
                </Text>
              </View>
            ) : null}

            <Text style={s.lead}>{resource.summary}</Text>
            {resource.description && !resource.description.startsWith(resource.summary) ? <Text style={s.body}>{resource.description}</Text> : null}

            <View style={s.actions}>
              {primaryPhone ? (
                <Pressable accessibilityRole="button" style={s.primary} onPress={() => void open(telUrl(primaryPhone.value))}>
                  <Text style={s.primaryText}>CALL {primaryPhone.value}</Text>
                </Pressable>
              ) : null}
              {apply ? (
                <Pressable accessibilityRole="button" style={primaryPhone ? s.secondary : s.primary} onPress={() => void open(apply)}>
                  <Text style={primaryPhone ? s.secondaryText : s.primaryText}>APPLY OR LEARN MORE</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={s.memberPanel}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: member.is_saved }} disabled={busy} style={[s.memberBtn, member.is_saved && s.memberBtnOn]} onPress={() => void toggleSave()}>
                <Text style={[s.memberBtnText, member.is_saved && s.memberBtnTextOn]}>{member.is_saved ? 'SAVED ✓' : 'SAVE'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: member.progress === 'started' }} disabled={busy} style={[s.memberBtn, member.progress === 'started' && s.memberBtnOn]} onPress={() => void setProgress(member.progress === 'started' ? 'cleared' : 'started')}>
                <Text style={[s.memberBtnText, member.progress === 'started' && s.memberBtnTextOn]}>I STARTED THIS</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: member.progress === 'completed' }} disabled={busy} style={[s.memberBtn, member.progress === 'completed' && s.memberBtnOn]} onPress={() => void setProgress(member.progress === 'completed' ? 'cleared' : 'completed')}>
                <Text style={[s.memberBtnText, member.progress === 'completed' && s.memberBtnTextOn]}>I FINISHED THIS</Text>
              </Pressable>
            </View>
            <Text style={s.memberNote}>
              Saved items and progress are private to you. “Started” and “finished” are marked by you and are not checked by FairPath.
            </Text>

            <Sec>HOW TO GET HELP</Sec>
            <Text style={s.body}>{resource.how_to_access ?? 'Contact the organization for the next step.'}</Text>

            <Sec>COST</Sec>
            <Text style={s.body}>{costLabel(resource.cost_type)}{resource.cost_notes ? ` — ${resource.cost_notes}` : ''}</Text>

            <Sec>WHO IT IS FOR</Sec>
            {resource.eligibility.length ? (
              resource.eligibility.map((e, i) => <Text key={i} style={s.bullet}>• {eligibilityLine(e)}</Text>)
            ) : (
              <Text style={s.body}>{resource.eligibility_summary ?? 'Open to everyone.'}</Text>
            )}

            {resource.required_documents.length ? (
              <>
                <Sec>WHAT TO BRING</Sec>
                {resource.required_documents.map((d, i) => (
                  <Text key={i} style={s.bullet}>
                    {d.is_required ? '☐ ' : '◇ '}
                    {d.description ?? d.document_type}
                    {d.is_required ? '' : ' (helpful, not required)'}
                  </Text>
                ))}
              </>
            ) : null}

            <Sec>{resource.locations.length > 1 ? 'LOCATIONS' : 'LOCATION'}</Sec>
            <Text style={s.meta}>{modeLabel(resource.delivery_mode)}{resource.is_national ? ' · Available nationwide' : ''}</Text>
            {resource.locations.map((l) => {
              const address = [l.address_line, l.city, l.state_code, l.postal_code].filter(Boolean).join(', ');
              const lines = formatHours(l.hours);
              const open = openNowLabel(l.open_now);
              return (
                <View key={l.id} style={s.box}>
                  <Text style={s.boxTitle}>{l.label}{open ? ` · ${open}` : ''}</Text>
                  {l.is_virtual ? <Text style={s.body}>{l.label}. No travel needed.</Text> : <Text style={s.body}>{address}</Text>}
                  {lines.length ? lines.map((line) => <Text key={line} style={s.hours}>{line}</Text>) : (
                    <Text style={s.hours}>{resource.hours_note ?? 'Hours are not listed. Call to confirm.'}</Text>
                  )}
                  {accessibilityLabels(l.accessibility).length && l.accessibility.join() !== resource.accessibility.join() ? <Text style={s.meta}>{accessibilityLabels(l.accessibility).join(' · ')}</Text> : null}
                  {!l.is_virtual && address ? (
                    <Pressable accessibilityRole="button" style={s.linkRow} onPress={() => void directions(address)}>
                      <Text style={s.link}>GET DIRECTIONS →</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {!resource.locations.length && resource.hours_note ? <Text style={s.body}>{resource.hours_note}</Text> : null}

            <Sec>CONTACT</Sec>
            {resource.contacts.map((c, i) => {
              const link = c.method === 'phone' ? telUrl(c.value) : c.method === 'url' ? safeExternalUrl(c.value) : c.method === 'email' ? `mailto:${c.value}` : null;
              return (
                <Pressable key={i} accessibilityRole={link ? 'link' : 'text'} disabled={!link} style={s.contactRow} onPress={() => void open(link)}>
                  <Text style={s.contactLabel}>{c.label ?? c.method.toUpperCase()}</Text>
                  <Text style={link ? s.link : s.body}>{c.value}</Text>
                </Pressable>
              );
            })}

            {accessibilityLabels(resource.accessibility).length || languageLabels(resource.languages).length ? (
              <>
                <Sec>ACCESS AND LANGUAGES</Sec>
                {accessibilityLabels(resource.accessibility).length ? <Text style={s.body}>{accessibilityLabels(resource.accessibility).join(' · ')}</Text> : null}
                <Text style={s.meta}>Languages: {languageLabels(resource.languages).join(', ')}</Text>
              </>
            ) : null}

            <Sec>WHERE THIS COMES FROM</Sec>
            <View style={s.box}>
              <Text style={s.body}>{AUTHORITY[resource.source_authority] ?? 'Source not listed'}</Text>
              <Text style={s.meta}>
                {resource.last_verified_at ? `Last verified ${verifiedOn(resource.last_verified_at)}.` : 'Verification date not listed.'}
              </Text>
              {source ? (
                <Pressable accessibilityRole="link" style={s.linkRow} onPress={() => void open(source)}>
                  <Text style={s.link}>OFFICIAL SOURCE →</Text>
                </Pressable>
              ) : null}
              {test ? <Text style={s.testNote}>This is fictional DEV test data and does not describe a real organization.</Text> : null}
            </View>

            <Sec>SEE SOMETHING WRONG?</Sec>
            {reportDone ? (
              <View style={s.box}>
                <Text style={s.boxTitle}>Thanks for telling us</Text>
                <Text style={s.body}>Your report goes to FairPath for review. A report does not change or remove a listing by itself.</Text>
              </View>
            ) : !reportOpen ? (
              <Pressable accessibilityRole="button" style={s.secondary} onPress={() => setReportOpen(true)}>
                <Text style={s.secondaryText}>REPORT A PROBLEM</Text>
              </Pressable>
            ) : (
              <View style={s.box}>
                <Text style={s.boxTitle}>What is wrong?</Text>
                {REPORT_REASONS.map((r) => (
                  <Pressable key={r.reason} accessibilityRole="radio" accessibilityState={{ selected: reportReason === r.reason }} style={[s.reasonRow, reportReason === r.reason && s.reasonRowOn]} onPress={() => setReportReason(r.reason)}>
                    <Text style={s.reasonText}>{r.label}</Text>
                  </Pressable>
                ))}
                <TextInput
                  style={s.note}
                  value={reportNote}
                  onChangeText={setReportNote}
                  placeholder="Add details (optional, no personal information)"
                  placeholderTextColor={tokens.textMuted}
                  multiline
                  maxLength={500}
                  accessibilityLabel="Report details"
                />
                <View style={s.reportActions}>
                  <Pressable accessibilityRole="button" disabled={busy} style={s.primaryInline} onPress={() => void submitReport()}>
                    <Text style={s.primaryText}>SEND REPORT</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={s.cancelInline} onPress={() => setReportOpen(false)}>
                    <Text style={s.secondaryText}>CANCEL</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 36 },
  spinner: { marginTop: 32 },
  sec: { marginTop: 22 },
  error: { color: t.error, fontSize: 13, lineHeight: 19, marginTop: 18 },
  badges: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 18 },
  title: { color: t.text, fontFamily: F.black, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, marginTop: 12 },
  org: { color: t.textSecondary, fontFamily: F.semiBold, fontSize: 14, marginTop: 6 },
  cats: { color: t.accentText, fontFamily: F.bold, fontSize: 11, letterSpacing: 0.4, marginTop: 8 },
  lead: { color: t.text, fontFamily: F.medium, fontSize: 16, lineHeight: 24, marginTop: 18 },
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 6 },
  bullet: { color: t.textSecondary, fontSize: 14, lineHeight: 22 },
  meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 6 },
  hours: { color: t.text, fontFamily: F.medium, fontSize: 13, lineHeight: 20, marginTop: 2 },
  warn: { borderWidth: 1, borderColor: t.warning, padding: 12, marginTop: 16 },
  warnTitle: { color: t.warning, fontFamily: F.extraBold, fontSize: 13 },
  warnBody: { color: t.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { marginTop: 18, marginBottom: 6, gap: 10 },
  primary: { height: 48, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  primaryText: { color: t.onAccent, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  secondary: { height: 48, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const },
  secondaryText: { color: t.text, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  box: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, marginTop: 8 },
  boxTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 15, marginBottom: 6 },
  linkRow: { marginTop: 10 },
  link: { color: t.accentText, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.5 },
  contactRow: { borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 12 },
  contactLabel: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1, marginBottom: 3 },
  memberPanel: { flexDirection: 'row' as const, gap: 8, marginTop: 16 },
  memberBtn: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 4 },
  memberBtnOn: { borderColor: t.accentBorder, backgroundColor: t.accentSubtle },
  memberBtnText: { color: t.textSecondary, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 0.6, textAlign: 'center' as const },
  memberBtnTextOn: { color: t.accentText },
  memberNote: { color: t.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  reasonRow: { minHeight: 44, borderWidth: 1, borderColor: t.border, justifyContent: 'center' as const, paddingHorizontal: 12, marginTop: 6 },
  reasonRowOn: { borderColor: t.accentBorder, backgroundColor: t.accentSubtle },
  reasonText: { color: t.text, fontSize: 13 },
  note: { minHeight: 84, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, fontSize: 14, padding: 10, marginTop: 10, textAlignVertical: 'top' as const },
  reportActions: { flexDirection: 'row' as const, gap: 8, marginTop: 12 },
  primaryInline: { flex: 1, height: 46, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  cancelInline: { flex: 1, height: 46, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const },
  testNote: { color: t.warning, fontSize: 11, lineHeight: 16, marginTop: 10 },
});
