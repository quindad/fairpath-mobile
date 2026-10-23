import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, ScreenScroll, SectionTitle } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { parseProfile, VETERAN_PROFILE_KEY, type VeteranProfile } from '@/core/veterans/profile-store';
import { BRANCHES } from '@/core/veterans/branches';
import { getFocusGuidance } from '@/core/ai/signal';
import { homeQuickLinks, loadHomePersonalization, type HomePersonalization } from '@/core/profile/home-personalization';
import { loadOpportunityPlan, type OpportunityPlan } from '@/core/opportunity/plan-store';
import { loadMyResourceReferralRequests, type MemberReferralRow } from '@/core/opportunity/referral-service';

type Load = 'loading' | 'ready' | 'error';

const PLANNED = [
  'Applications and interviews across jobs and housing',
  'Referrals and case-manager tasks, with your consent',
  'Documents and milestones',
];

// My Path reads only what this device has stored. Nothing here is server-synced or case-manager-assigned yet.
export default function MyPathScreen() {
  const s = useThemedStyles(styles);
  const [load, setLoad] = useState<Load>('loading');
  const [veteran, setVeteran] = useState<VeteranProfile | null>(null);
  const [personalization, setPersonalization] = useState<HomePersonalization | null>(null);
  const [focusText, setFocusText] = useState('');
  const [focusLoading, setFocusLoading] = useState(false);
  const [focusRequested, setFocusRequested] = useState(false);
  const [opportunityPlan, setOpportunityPlan] = useState<OpportunityPlan | null>(null);
  const [resourceReferrals, setResourceReferrals] = useState<MemberReferralRow[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(VETERAN_PROFILE_KEY),
      loadHomePersonalization().catch(() => null),
      loadOpportunityPlan().catch(() => ({ items: [] })),
      loadMyResourceReferralRequests().catch(() => []),
    ])
      .then(([raw, p, plan, referrals]) => {
        if (!alive) return;
        setVeteran(raw ? parseProfile(raw, new Date().toISOString()) : null);
        setPersonalization(p);
        setOpportunityPlan(plan);
        setResourceReferrals(referrals);
        setLoad('ready');
      })
      .catch(() => { if (alive) setLoad('error'); });
    return () => { alive = false; };
  }, []);

  async function askSignal() {
    if (focusLoading) return;
    setFocusLoading(true); setFocusRequested(true);
    try {
      const r = await getFocusGuidance();
      if (r.status === 'ok') setFocusText(r.text);
      else if (r.status === 'out_of_credits') setFocusText('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setFocusText('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') { router.push(('/sign-in?returnTo=' + encodeURIComponent('/my-path')) as never); return; }
      else setFocusText(r.message);
    } catch { setFocusText('Signal could not look at your activity right now. Please try again.'); }
    finally { setFocusLoading(false); }
  }

  const branch = veteran?.branch ? BRANCHES.find((b) => b.id === veteran.branch)?.officialName ?? null : null;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="MY PATH" title="My Path" onBack={false} />
      <ScreenScroll contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Your plan on this device</Text>
          <Text style={s.body}>
            Progress is saved on this device for now. Sync and case-manager tools come later. Signal suggestions never change your records without your OK.
          </Text>
        </View>

        {personalization?.goals.length ? (
          <>
            <SectionTitle>Your focus areas</SectionTitle>
            <Text style={s.body}>{personalization.goals.join(' · ')}</Text>
            <View style={s.row}>
              {homeQuickLinks(personalization).map((l) => (
                <Pressable key={l.route} style={s.chip} accessibilityRole="link" onPress={() => router.push(l.route as never)}>
                  <Text style={s.chipText}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={s.card}>
          <Text style={s.cardTitle}>Signal · What should I focus on?</Text>
          {focusRequested ? <Text style={s.body}>{focusLoading ? 'Signal is thinking…' : focusText}</Text> : (
            <Pressable style={s.button} accessibilityRole="button" onPress={() => void askSignal()}>
              <Text style={s.buttonText}>Ask Signal</Text>
            </Pressable>
          )}
        </View>

        {load === 'loading' ? <Text style={s.body} accessibilityLiveRegion="polite">Loading your plan…</Text> : null}
        {load === 'error' ? <Text style={s.error} accessibilityRole="alert">Your plan could not be loaded on this device.</Text> : null}

        {load === 'ready' ? (
          <>
            <SectionTitle>Professional credibility</SectionTitle>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/opportunity-profile' as never)}>
              <Text style={s.cardTitle}>Opportunity Profile</Text>
              <Text style={s.body}>Skills and credentials you choose to share on applications.</Text>
            </Pressable>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/opportunity-profile/preview' as never)}>
              <Text style={s.cardTitle}>Preview your professional card</Text>
              <Text style={s.body}>Preview before you apply. Justice records stay private.</Text>
            </Pressable>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/job-applications' as never)}>
              <Text style={s.cardTitle}>Job applications</Text>
              <Text style={s.body}>Track status, interviews, and offers from employers on FairPath.</Text>
            </Pressable>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/find-jobs' as never)}>
              <Text style={s.cardTitle}>Find jobs</Text>
              <Text style={s.body}>Search participating employers and apply with your saved profile.</Text>
            </Pressable>

            <SectionTitle>My opportunity plan</SectionTitle>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/community/help-now' as never)}>
              <Text style={s.cardTitle}>Help now</Text>
              <Text style={s.body}>Resources, Marketplace, and Food Rescue in one search.</Text>
            </Pressable>
            {opportunityPlan?.items.length ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Recent needs on this device</Text>
                {opportunityPlan.items.slice(0, 6).map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole={item.route ? 'link' : 'text'}
                    onPress={() => item.route && router.push(item.route as never)}
                    style={s.planRow}
                  >
                    <Text style={s.body}>
                      {item.title} — {item.status.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                ))}
                <Text style={s.bodyMuted}>Mark items complete when you are done.</Text>
              </View>
            ) : (
              <Text style={s.body}>When you use Help now, FairPath remembers what you explored on this device.</Text>
            )}
            {resourceReferrals.length ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Resource referral requests</Text>
                {resourceReferrals.slice(0, 5).map((r) => (
                  <Pressable key={r.id} accessibilityRole="link" onPress={() => router.push(`/resource/${r.resource_id}` as never)}>
                    <Text style={s.body}>
                      • {r.status.replace(/_/g, ' ')} — submitted {new Date(r.created_at).toLocaleDateString()}
                      {r.status === 'accepted' ? ' (service not complete until provider confirms)' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <SectionTitle>Community exchange</SectionTitle>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/community/exchanges' as never)}>
              <Text style={s.cardTitle}>My exchanges</Text>
              <Text style={s.body}>Marketplace claims, listings, community requests, and saved resources.</Text>
            </Pressable>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/community/need-help' as never)}>
              <Text style={s.cardTitle}>I need help</Text>
              <Text style={s.body}>Post or manage essentials requests.</Text>
            </Pressable>

            <SectionTitle>Learning</SectionTitle>
            <View style={s.card}>
              <Text style={s.cardTitle}>Find a real course or program</Text>
              <Text style={s.body}>Real courses from partner organizations — not FairPath certificates.</Text>
              <Pressable style={s.button} accessibilityRole="link" onPress={() => router.push('/academy' as never)}>
                <Text style={s.buttonText}>Browse Academy</Text>
              </Pressable>
            </View>

            <SectionTitle>FairPath Staffing</SectionTitle>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/my-assignment' as never)}>
              <Text style={s.cardTitle}>My Assignment</Text>
              <Text style={s.body}>DEV demo. Once placed on a FairPath Staffing assignment, it shows up here.</Text>
            </Pressable>

            <SectionTitle>Veterans</SectionTitle>
            <Pressable style={s.card} accessibilityRole="link" onPress={() => router.push('/veterans/profile' as never)}>
              <Text style={s.cardTitle}>Service profile</Text>
              <Text style={s.body}>
                {branch ? `Branch: ${branch}` : 'No branch selected. Optional.'}
              </Text>
              <Text style={s.body}>
                {veteran ? `${veteran.consents.filter((c) => c.granted).length} details shared with your profile` : 'No details shared yet'}
              </Text>
            </Pressable>
          </>
        ) : null}

        <SectionTitle>Coming to My Path</SectionTitle>
        <Text style={s.bodyMuted}>{PLANNED.join(' · ')}</Text>
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  bodyMuted: { color: t.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  item: { color: t.text, fontSize: 15, lineHeight: 22 },
  planRow: { paddingVertical: 4 },
  button: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent, marginTop: 6 },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  chip: { borderWidth: 1, borderColor: t.border, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { color: t.text, fontWeight: '700' as const, fontSize: 13 },
  buttonText: { color: t.onAccent, fontWeight: '700' as const },
});
