import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { parseProfile, VETERAN_PROFILE_KEY, type VeteranProfile } from '@/core/veterans/profile-store';
import { BRANCHES } from '@/core/veterans/branches';
import { getFocusGuidance } from '@/core/ai/signal';

type Load = 'loading' | 'ready' | 'error';

const PLANNED = [
  'Applications and interviews across jobs and housing',
  'Referrals and case-manager tasks, with your consent',
  'Documents and milestones',
  'Entrepreneurship milestones',
  'Food Rescue and Marketplace activity',
];

// My Path reads only what this device has stored. Nothing here is server-synced or case-manager-assigned yet.
export default function MyPathScreen() {
  const s = useThemedStyles(styles);
  const [load, setLoad] = useState<Load>('loading');
  const [veteran, setVeteran] = useState<VeteranProfile | null>(null);
  const [focusText, setFocusText] = useState('');
  const [focusLoading, setFocusLoading] = useState(false);
  const [focusRequested, setFocusRequested] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(VETERAN_PROFILE_KEY)
      .then((raw) => {
        if (!alive) return;
        setVeteran(raw ? parseProfile(raw, new Date().toISOString()) : null);
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
      <View style={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Your plan, on this device</Text>
          <Text style={s.body}>
            Your progress is saved on this device for now. Syncing across devices and case-manager tasks come later. You own your plan, and AI suggestions never change your records without your confirmation.
          </Text>
        </View>

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
            <SectionTitle>Learning</SectionTitle>
            <View style={s.card}>
              <Text style={s.cardTitle}>Find a real course or program</Text>
              <Text style={s.body}>FairPath links directly to real organizations and their real certificates, rather than issuing its own.</Text>
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
        {PLANNED.map((item) => (
          <Text key={item} style={s.item}>• {item}</Text>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  item: { color: t.text, fontSize: 15, lineHeight: 22 },
  button: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent, marginTop: 6 },
  buttonText: { color: t.onAccent, fontWeight: '700' as const },
});
