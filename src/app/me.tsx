import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame, ScreenScroll, SectionTitle } from '@/components/ProductChrome';
import { BodyText, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadMemberSummary } from '@/core/profile/member-summary';
import { nextSteps, type MemberSummary } from '@/core/profile/next-step';
import { loadContact } from '@/core/profile/opportunity-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';
import { supabase } from '@/lib/supabase';
import { disablePushRegistration } from '@/core/notifications/push-registration';
import {
  filterNextStepsForCapabilities,
  justiceToolsEnabled,
  loadMemberCapabilities,
  type MemberCapabilities,
} from '@/core/profile/member-capabilities';

function pathLinks(caps: MemberCapabilities | null): { title: string; body: (s: MemberSummary) => string; route: string }[] {
  const base = [
    { title: 'Opportunity Profile', body: (s: MemberSummary) => `${s.profile?.completed_sections ?? 0} of ${s.profile?.total_sections ?? 8} sections · professional credibility for employers`, route: '/opportunity-profile' },
    { title: 'Resume Studio', body: () => 'Build a clean, ATS-friendly resume', route: '/resume-studio' },
    { title: 'Credit Studio', body: (s: MemberSummary) => (s.credit?.reports ?? 0) > 0 ? `${s.credit?.items_to_review ?? 0} item(s) to review` : 'Review a credit report and prepare disputes', route: '/credit' },
  ];
  if (!justiceToolsEnabled(caps)) return base;
  return [
    ...base,
    { title: 'My Justice Records', body: (s: MemberSummary) => (s.record_relief?.cases ?? 0) > 0 ? `${s.record_relief?.cases} case(s) · unified view` : 'Cases, charges & relief in one place', route: '/justice-records' },
    { title: 'Record Relief', body: (s: MemberSummary) => (s.record_relief?.cases ?? 0) > 0 ? `${s.record_relief?.cases} case(s) tracked` : 'Check a case against verified rules', route: '/record-relief' },
  ];
}

function accountLinks(caps: MemberCapabilities | null): { title: string; body: string; route: string }[] {
  const links = [
    { title: 'FairPath tools', body: 'Justice and veteran tool visibility (private to you)', route: '/member-tool-preferences' },
    { title: 'Your location', body: 'ZIP code and search radius', route: '/location-setup' },
    { title: 'Notifications', body: 'Housing, Marketplace, jobs and FairPath updates', route: '/notifications' },
    { title: 'Payments', body: 'Receipts and payment history', route: '/payments' },
    { title: 'FairPath+', body: 'Your membership and access', route: '/plus' },
  ];
  if (justiceToolsEnabled(caps)) {
    return [
      { title: 'Justice readiness', body: 'Your private readiness checklist. Never shared with employers.', route: '/profile-readiness' },
      ...links,
    ];
  }
  return links;
}

// ACTIVITY: what the member has done across FairPath.
const ACTIVITY_LINKS: { title: string; body: string; route: string }[] = [
  { title: 'Job applications', body: 'Track your FairPath job applications', route: '/job-applications' },
  { title: 'Saved jobs', body: 'Jobs you bookmarked for later', route: '/saved-jobs' },
  { title: 'Housing applications', body: 'Track drafts and submitted applications', route: '/housing-applications' },
  { title: 'Saved homes', body: 'Your saved FairPath housing', route: '/saved-homes' },
  { title: 'Saved housing searches', body: 'Rerun housing searches with your filters', route: '/saved-housing-searches' },
  { title: 'Housing activity', body: 'Tour requests and property questions', route: '/housing-activity' },
  { title: 'Saved resources', body: 'Resources you saved or are working through', route: '/saved-resources' },
  { title: 'Meetings', body: 'Interviews, appointments and workshops', route: '/meetings' },
  { title: 'My Documents', body: 'Documents FairPath helped you prepare', route: '/documents' },
  { title: 'Marketplace claims', body: 'Track requests, pickup windows and codes', route: '/marketplace-claims' },
  { title: 'My Marketplace listings', body: 'Manage items you are giving away', route: '/marketplace-my-listings' },
  { title: 'Saved Marketplace', body: 'Free items you bookmarked', route: '/saved-marketplace' },
];

export default function MeScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [caps, setCaps] = useState<MemberCapabilities | null>(null);

  const load = useCallback(() => {
    setError('');
    Promise.all([loadMemberSummary(), loadContact().catch(() => null), loadMemberCapabilities().catch(() => null)])
      .then(([sum, contact, capabilities]) => {
        setSummary(sum);
        setCaps(capabilities);
        if (contact) { setName(`${contact.first_name} ${contact.last_name}`.trim()); setEmail(contact.email); }
      })
      .catch(() => { setSummary(null); setError('We could not load your summary. Check your connection and try again.'); })
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(load);

  async function signOut() {
    try { await disablePushRegistration(); }
    catch { notify('Could not sign out', 'Device notification cleanup failed. Please retry.'); return; }
    const { error: err } = await supabase.auth.signOut();
    if (err) notify('Could not sign out', 'Please try again.');
    else router.replace('/find-jobs' as never);
  }

  const steps = filterNextStepsForCapabilities(nextSteps(summary), caps);
  const primary = steps[0];
  const more = steps.slice(1, 3);
  const plus = summary?.plus;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="YOUR ACCOUNT" title="Me" onBack={false} />
      <ScreenScroll contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={load} /></View> : null}

        {summary ? (
          <>
            <View style={s.identity}>
              <View style={s.avatar}><Text style={s.avatarText}>{(name || email || '?').trim().charAt(0).toUpperCase()}</Text></View>
              <View style={s.identityCopy}>
                <Text style={s.name}>{name || 'Your FairPath account'}</Text>
                {email ? <Text style={s.email}>{email}</Text> : null}
              </View>
              {plus?.active ? <InlineBadge tone="lime">FAIRPATH+</InlineBadge> : null}
            </View>

            {summary.deletion_request ? (
              <Panel tone="warning">
                <Text style={s.alertTitle}>Account deletion requested</Text>
                <BodyText muted>Your account has not been deleted. The request is scheduled for review on {new Date(summary.deletion_request.scheduled_for ?? Date.now()).toLocaleDateString()}. You can cancel it until processing starts.</BodyText>
                <SecondaryButton label="REVIEW OR CANCEL" onPress={() => router.push('/privacy' as never)} />
              </Panel>
            ) : null}

            {primary ? (
              <Panel tone="accent">
                <Text style={s.eyebrow}>YOUR NEXT STEP</Text>
                <Text style={s.stepTitle}>{primary.title}</Text>
                <BodyText>{primary.body}</BodyText>
                <PrimaryButton label="GO" accessibilityLabel={`Go to ${primary.title}`} onPress={() => router.push(primary.route as never)} />
              </Panel>
            ) : (
              <Panel><BodyText>You are up to date. Nothing needs your attention right now.</BodyText></Panel>
            )}
            {more.map((m) => <ListRow key={m.key} title={m.title} body={m.body} accessibilityLabel={m.title} accessibilityRole="button" onPress={() => router.push(m.route as never)} />)}

            <View style={s.block}><SectionTitle>YOUR PATH</SectionTitle></View>
            {pathLinks(caps).map((l) => <ListRow key={l.route} title={l.title} body={l.body(summary)} accessibilityLabel={l.title} onPress={() => router.push(l.route as never)} />)}

            <View style={s.block}><SectionTitle>ACTIVITY</SectionTitle></View>
            {ACTIVITY_LINKS.map((l) => <ListRow key={l.route} title={l.title} body={l.body} accessibilityLabel={l.title} onPress={() => router.push(l.route as never)} />)}
          </>
        ) : null}

        <View style={s.block}><SectionTitle>ACCOUNT</SectionTitle></View>
        {accountLinks(caps).map((l) => <ListRow key={l.route} title={l.title} body={l.body} accessibilityLabel={l.title} onPress={() => router.push(l.route as never)} />)}
        <ListRow title="Appearance" body="Dark, light or system" onPress={() => router.push('/appearance' as never)} />
        <ListRow title="Privacy and account" body="What FairPath shares, your data, and deleting your account" onPress={() => router.push('/privacy' as never)} />
        {__DEV__ ? <ListRow title="Integration health (DEV)" body="Live + static status of every external system" onPress={() => router.push('/dev-integration-health' as never)} /> : null}

        <SecondaryButton label="SIGN OUT" onPress={() => void signOut()} />
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 32 },
  spinner: { marginTop: 28 },
  block: { marginTop: 22 },
  identity: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: t.border },
  avatar: { width: 46, height: 46, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  avatarText: { color: t.onAccent, fontFamily: F.black, fontSize: 20 },
  identityCopy: { flex: 1 },
  name: { color: t.text, fontFamily: F.extraBold, fontSize: 17 },
  email: { color: t.textMuted, fontSize: 12, marginTop: 2 },
  eyebrow: { color: t.accentText, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.8 },
  stepTitle: { color: t.text, fontFamily: F.black, fontSize: 20, lineHeight: 24, marginVertical: 6 },
  alertTitle: { color: t.warning, fontFamily: F.extraBold, fontSize: 14, marginBottom: 4 },
});
