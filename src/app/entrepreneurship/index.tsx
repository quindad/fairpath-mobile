import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { PROGRAM_REFERENCES, trackPercent, nextStep, type TrackProgress } from '@/core/entrepreneurship/tracks';
import { ENTREPRENEURSHIP_STORAGE_KEY, parseProgress } from '@/core/entrepreneurship/progress-store';
import {
  ACADEMY_HONESTY_BANNER,
  ACADEMY_LESSON_MODULES,
  ACADEMY_ROUTES,
  academyLessonPath,
} from '@/core/academy/catalog';
import { getBusinessIdeaFeedback } from '@/core/ai/signal';
import { router } from 'expo-router';

type Load = 'loading' | 'ready' | 'error';

export default function EntrepreneurshipHomeScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [load, setLoad] = useState<Load>('loading');
  const [progress, setProgress] = useState<TrackProgress>({ completedSteps: [] });
  const [idea, setIdea] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRequested, setFeedbackRequested] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ENTREPRENEURSHIP_STORAGE_KEY)
      .then((raw) => {
        if (alive) {
          setProgress(parseProgress(raw));
          setLoad('ready');
        }
      })
      .catch(() => {
        if (alive) setLoad('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  const percent = trackPercent(progress);
  const next = nextStep(progress);

  async function askSignal() {
    const t = idea.trim();
    if (!t || feedbackLoading) return;
    setFeedbackLoading(true);
    setFeedbackRequested(true);
    try {
      const r = await getBusinessIdeaFeedback(t, next?.title);
      if (r.status === 'ok') setFeedbackText(r.text);
      else if (r.status === 'out_of_credits') setFeedbackText('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setFeedbackText('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') {
        router.push(('/sign-in?returnTo=' + encodeURIComponent(ACADEMY_ROUTES.home)) as never);
        return;
      } else setFeedbackText(r.message);
    } catch {
      setFeedbackText('Signal could not look at this right now. Please try again.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="ENTREPRENEURSHIP · OPEN TO EVERYONE" title="Startup Academy" backTo="/explore" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Build at your own pace</Text>
          <Text style={s.body}>{ACADEMY_HONESTY_BANNER}</Text>
        </View>

        {load === 'loading' ? (
          <Text style={s.body} accessibilityLiveRegion="polite">
            Loading your progress…
          </Text>
        ) : null}
        {load === 'error' ? (
          <Text style={s.error} accessibilityRole="alert">
            Your progress could not be loaded on this device.
          </Text>
        ) : null}

        {load === 'ready' ? (
          <>
            <View style={s.linkRow}>
              <Pressable
                style={s.secondary}
                accessibilityRole="button"
                onPress={() => router.push(ACADEMY_ROUTES.plan as never)}
              >
                <Text style={s.secondaryText}>Business plan</Text>
              </Pressable>
              <Pressable
                style={s.secondary}
                accessibilityRole="button"
                onPress={() => router.push(ACADEMY_ROUTES.budget as never)}
              >
                <Text style={s.secondaryText}>Startup budget</Text>
              </Pressable>
            </View>

            <Text style={s.section}>Progress · {percent}%</Text>
            <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
              <View style={[s.barFill, { width: `${percent}%` }]} />
            </View>
            {next ? (
              <View style={s.card} accessibilityLabel={`Next: ${next.title}`}>
                <Text style={s.cardLabel}>START HERE</Text>
                <Text style={s.cardTitle}>{next.title}</Text>
                <Text style={s.body}>{next.description}</Text>
                <Pressable
                  style={s.primary}
                  accessibilityRole="button"
                  onPress={() => router.push(academyLessonPath(next.id) as never)}
                >
                  <Text style={s.primaryText}>Open lesson</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.card}>
                <Text style={s.cardTitle}>All 15 steps complete.</Text>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.cardTitle}>Signal · Get feedback on your idea</Text>
              <TextInput
                style={s.input}
                value={idea}
                onChangeText={setIdea}
                placeholder="Describe your business idea…"
                placeholderTextColor={tokens.textMuted}
                multiline
                accessibilityLabel="Describe your business idea for Signal"
              />
              <Pressable style={s.primary} accessibilityRole="button" onPress={() => void askSignal()}>
                <Text style={s.primaryText}>{feedbackLoading ? 'Asking Signal…' : 'Ask Signal'}</Text>
              </Pressable>
              {feedbackRequested ? <Text style={s.body}>{feedbackLoading ? 'Signal is thinking…' : feedbackText}</Text> : null}
            </View>

            <SectionTitle>All lessons</SectionTitle>
            {ACADEMY_LESSON_MODULES.map((step) => {
              const done = progress.completedSteps.includes(step.id);
              return (
                <Pressable
                  key={step.id}
                  style={s.row}
                  accessibilityRole="button"
                  accessibilityLabel={`${step.title}, ${done ? 'completed' : 'not completed'}`}
                  onPress={() => router.push(academyLessonPath(step.id) as never)}
                >
                  <Text style={s.rowMark}>{done ? '✓' : '○'}</Text>
                  <View style={s.rowBody}>
                    <Text style={done ? s.rowTitleDone : s.rowTitle}>{step.title}</Text>
                    <Text style={s.meta}>
                      Step {step.order} · {step.stage}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <SectionTitle>Programs to look into</SectionTitle>
            {PROGRAM_REFERENCES.map((p) => (
              <View key={p.id} style={s.card}>
                <Text style={s.cardTitle}>{p.name}</Text>
                <Text style={s.body}>{p.description}</Text>
                <Text style={s.meta}>Not an official FairPath partnership.</Text>
              </View>
            ))}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  section: { color: t.text, fontWeight: '700' as const, fontSize: 17, marginTop: 8 },
  bar: { height: 8, backgroundColor: t.border },
  barFill: { height: 8, backgroundColor: t.accent },
  linkRow: { flexDirection: 'row' as const, gap: 10 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  input: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.input,
    color: t.text,
    fontSize: 15,
    padding: 10,
    textAlignVertical: 'top' as const,
  },
  cardLabel: { color: t.accent, fontWeight: '700' as const, fontSize: 12, letterSpacing: 0.6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  meta: { color: t.textMuted, fontSize: 13 },
  primary: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
  secondary: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  secondaryText: { color: t.text, fontWeight: '600' as const, fontSize: 14 },
  row: { flexDirection: 'row' as const, gap: 10, alignItems: 'flex-start' as const, paddingVertical: 8 },
  rowMark: { color: t.accent, fontSize: 16, width: 20, marginTop: 2 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: t.textSecondary, fontSize: 15, flexShrink: 1 },
  rowTitleDone: { color: t.textMuted, fontSize: 15, flexShrink: 1, textDecorationLine: 'line-through' as const },
});
