import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadMemberSummary } from '@/core/profile/member-summary';
import { nextSteps, type MemberSummary, type NextStep } from '@/core/profile/next-step';
import { myEarlyAccessEnrollments } from '@/core/coverage/coverage-service';
import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type NextMeeting = { id: string; title: string; start_at: string };
/** Owner-only (RLS) read of the soonest non-cancelled upcoming meeting. A load failure just omits the chip. */
async function loadNextMeeting(): Promise<NextMeeting | null> {
  const { data } = await supabase.from('member_meetings').select('id,title,start_at').neq('status', 'cancelled').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(1).maybeSingle();
  return (data as NextMeeting | null) ?? null;
}
function meetingWhen(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return 'Today, ' + time;
  if (days === 1) return 'Tomorrow, ' + time;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + time;
}

/**
 * Real, server-derived status for the Home screen: shows only what actually needs attention (credit items, dispute
 * deadlines, record-relief countdowns, document or resource problems, profile progress). Nothing is invented, nothing
 * is shown to signed-out visitors, and a load failure simply hides the card.
 */
export function HomeStatus() {
  const s = useThemedStyles(styles);
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [waitlistZip, setWaitlistZip] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let live = true;
    loadMemberSummary().then((x) => live && setSummary(x)).catch(() => live && setSummary(null));
    loadNextMeeting().then((x) => live && setNextMeeting(x)).catch(() => live && setNextMeeting(null));
    myEarlyAccessEnrollments().then((x) => live && setWaitlistZip(x.find((e) => e.status === 'waitlisted')?.zip ?? null)).catch(() => live && setWaitlistZip(null));
    return () => { live = false; };
  }, []));

  if (!summary) return null;
  const steps: NextStep[] = nextSteps(summary).slice(0, 3);
  const chips: { label: string; route: string }[] = [];
  const c = summary.credit;
  const r = summary.record_relief;
  if (nextMeeting) chips.push({ label: `${nextMeeting.title} — ${meetingWhen(nextMeeting.start_at)}`, route: '/meetings/' + nextMeeting.id });
  if ((c?.items_to_review ?? 0) > 0) chips.push({ label: `${c?.items_to_review} credit item${c?.items_to_review === 1 ? '' : 's'} to review`, route: '/credit' });
  if ((c?.response_due_soon ?? 0) > 0) chips.push({ label: 'Dispute response due soon', route: '/credit' });
  if ((r?.eligible_now ?? 0) > 0) chips.push({ label: 'Case may be ready for review', route: '/record-relief' });
  if ((r?.countdowns_due_soon ?? 0) > 0) chips.push({ label: 'A waiting period ends soon', route: '/record-relief' });
  if ((summary.documents?.expiring_soon ?? 0) > 0) chips.push({ label: 'A stored document expires soon', route: '/documents' });
  if ((summary.resources?.unavailable_saved ?? 0) > 0) chips.push({ label: 'A saved resource is unavailable', route: '/saved-resources' });
  if (waitlistZip) chips.push({ label: `On the Early Access list for ${waitlistZip}`, route: '/early-access?zip=' + waitlistZip });
  if (!steps.length && !chips.length) return null;

  return (
    <View style={s.wrap} accessibilityLabel="Your status">
      <Text style={s.eyebrow}>YOUR STATUS</Text>
      {steps[0] ? (
        <Pressable accessibilityRole="button" style={s.primary} onPress={() => router.push(steps[0].route as never)}>
          <View style={s.copy}><Text style={s.title}>{steps[0].title}</Text><Text style={s.body}>{steps[0].body}</Text></View>
          <Text style={s.arrow}>→</Text>
        </Pressable>
      ) : null}
      {chips.length ? <View style={s.chips}>{chips.map((k) => <Pressable key={k.label} accessibilityRole="button" style={s.chip} onPress={() => router.push(k.route as never)}><Text style={s.chipText}>{k.label}</Text></Pressable>)}</View> : null}
      {steps.slice(1).map((st) => (
        <Pressable key={st.key} accessibilityRole="button" style={s.row} onPress={() => router.push(st.route as never)}><Text style={s.rowText}>{st.title}</Text><Text style={s.arrow}>→</Text></Pressable>
      ))}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  wrap: { marginHorizontal: L.mobileGutter, marginTop: 16, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentSubtle, padding: 14 },
  eyebrow: { color: t.accentText, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.4, marginBottom: 8 },
  primary: { flexDirection: 'row' as const, alignItems: 'center' as const },
  copy: { flex: 1, paddingRight: 10 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 15, lineHeight: 19 },
  body: { color: t.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  arrow: { color: t.accentText, fontSize: 18 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 10 },
  chip: { borderWidth: 1, borderColor: t.accentBorder, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: t.surface },
  chipText: { color: t.text, fontFamily: F.bold, fontSize: 11 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderTopWidth: 1, borderTopColor: t.accentBorder, marginTop: 10, paddingTop: 10 },
  rowText: { color: t.textSecondary, fontFamily: F.semiBold, fontSize: 13, flex: 1, paddingRight: 8 },
});
