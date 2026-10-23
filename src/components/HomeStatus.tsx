import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathFonts as F } from '@/constants/fairpath';
import { loadMemberSummary } from '@/core/profile/member-summary';
import { nextSteps, type MemberSummary, type NextStep } from '@/core/profile/next-step';
import { myEarlyAccessEnrollments } from '@/core/coverage/coverage-service';
import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type NextMeeting = { id: string; title: string; start_at: string };

async function loadNextMeeting(): Promise<NextMeeting | null> {
  const { data } = await supabase
    .from('member_meetings')
    .select('id,title,start_at')
    .neq('status', 'cancelled')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as NextMeeting | null) ?? null;
}

function meetingWhen(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
}

/** One clear next action on Home — everything else lives in My Path. */
export function HomeStatus() {
  const s = useThemedStyles(styles);
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [waitlistZip, setWaitlistZip] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadMemberSummary().then((x) => live && setSummary(x)).catch(() => live && setSummary(null));
      loadNextMeeting().then((x) => live && setNextMeeting(x)).catch(() => live && setNextMeeting(null));
      myEarlyAccessEnrollments()
        .then((x) => live && setWaitlistZip(x.find((e) => e.status === 'waitlisted')?.zip ?? null))
        .catch(() => live && setWaitlistZip(null));
      return () => { live = false; };
    }, []),
  );

  if (!summary) return null;

  const steps: NextStep[] = nextSteps(summary);
  const alerts: { label: string; route: string }[] = [];
  const c = summary.credit;
  const r = summary.record_relief;
  if (nextMeeting) {
    alerts.push({ label: `${nextMeeting.title} — ${meetingWhen(nextMeeting.start_at)}`, route: `/meetings/${nextMeeting.id}` });
  }
  if ((c?.items_to_review ?? 0) > 0) {
    alerts.push({ label: `${c?.items_to_review} credit item${c?.items_to_review === 1 ? '' : 's'} to review`, route: '/credit' });
  }
  if ((c?.response_due_soon ?? 0) > 0) alerts.push({ label: 'Dispute response due soon', route: '/credit' });
  if ((r?.eligible_now ?? 0) > 0) alerts.push({ label: 'Record relief may be ready to review', route: '/record-relief' });
  if ((r?.countdowns_due_soon ?? 0) > 0) alerts.push({ label: 'Waiting period ending soon', route: '/record-relief' });
  if ((summary.documents?.expiring_soon ?? 0) > 0) alerts.push({ label: 'Document expiring soon', route: '/documents' });
  if ((summary.resources?.unavailable_saved ?? 0) > 0) alerts.push({ label: 'Saved resource unavailable', route: '/saved-resources' });
  if (waitlistZip) alerts.push({ label: `Early access waitlist (${waitlistZip})`, route: `/early-access?zip=${waitlistZip}` });
  const mp = summary.marketplace;
  if ((mp?.ready_for_pickup ?? 0) > 0) alerts.push({ label: 'Marketplace pickup ready', route: '/marketplace-claims' });
  else if ((mp?.pending_requests_on_my_items ?? 0) > 0) {
    alerts.push({ label: 'Claim requests on your listings', route: '/marketplace-my-listings' });
  }

  const step = steps[0];
  const alert = !step && alerts[0] ? alerts[0] : null;
  if (!step && !alert) return null;

  const route = step?.route ?? alert!.route;
  const title = step?.title ?? alert!.label;

  return (
    <View style={s.wrap} accessibilityLabel="Suggested next step">
      <Pressable accessibilityRole="button" style={s.card} onPress={() => router.push(route as never)}>
        <View style={s.copy}>
          <Text style={s.kicker}>Suggested next step</Text>
          <Text style={s.title}>{title}</Text>
          {step?.body ? <Text style={s.body} numberOfLines={2}>{step.body}</Text> : null}
        </View>
        <Lucide name="chevron-right" color="#A8F32C" size={22} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/my-path' as never)}>
        <Text style={s.more}>All steps on My Path</Text>
      </Pressable>
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  wrap: { marginTop: 14, gap: 6 },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: t.surface,
    borderLeftWidth: 3,
    borderLeftColor: t.accentText,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  copy: { flex: 1, paddingRight: 8 },
  kicker: { color: t.textSecondary, fontFamily: F.semiBold, fontSize: 12 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 16, lineHeight: 21, marginTop: 4 },
  body: { color: t.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  more: { color: t.accentText, fontFamily: F.semiBold, fontSize: 13 },
});
