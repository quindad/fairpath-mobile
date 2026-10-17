import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { STARTUP_ACADEMY_TRACK, PROGRAM_REFERENCES, trackPercent, nextStep, type TrackProgress, type TrackStep } from '@/core/entrepreneurship/tracks';
import { ENTREPRENEURSHIP_STORAGE_KEY, parseProgress, persistStepCompletion } from '@/core/entrepreneurship/progress-store';
import { getBusinessIdeaFeedback } from '@/core/ai/signal';
import { router } from 'expo-router';

type Load = 'loading' | 'ready' | 'error';

export default function EntrepreneurshipScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [load, setLoad] = useState<Load>('loading');
  const [progress, setProgress] = useState<TrackProgress>({ completedSteps: [] });
  const [message, setMessage] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRequested, setFeedbackRequested] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ENTREPRENEURSHIP_STORAGE_KEY)
      .then((raw) => { if (alive) { setProgress(parseProgress(raw)); setLoad('ready'); } })
      .catch(() => { if (alive) setLoad('error'); });
    return () => { alive = false; };
  }, []);

  const save = async (step: TrackStep) => {
    const result = await persistStepCompletion(AsyncStorage, progress, step);
    if (!result.saved) {
      setMessage('Your progress could not be saved on this device. Try again.');
      return;
    }
    setProgress(result.progress);
    setMessage(null);
  };

  const percent = trackPercent(progress);
  const next = nextStep(progress);

  async function askSignal() {
    const t = idea.trim();
    if (!t || feedbackLoading) return;
    setFeedbackLoading(true); setFeedbackRequested(true);
    try {
      const r = await getBusinessIdeaFeedback(t, next?.title);
      if (r.status === 'ok') setFeedbackText(r.text);
      else if (r.status === 'out_of_credits') setFeedbackText('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setFeedbackText('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') { router.push(('/sign-in?returnTo=' + encodeURIComponent('/entrepreneurship')) as never); return; }
      else setFeedbackText(r.message);
    } catch { setFeedbackText('Signal could not look at this right now. Please try again.'); }
    finally { setFeedbackLoading(false); }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="ENTREPRENEURSHIP · OPEN TO EVERYONE" title="Startup Academy" backTo="/explore" />
      <FormScrollView contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Build at your own pace</Text>
          <Text style={s.body}>
            15 practical steps from idea to launch. Nothing here promises funding, a grant or a successful business. Your progress is saved on this device.
          </Text>
        </View>

        {load === 'loading' ? <Text style={s.body} accessibilityLiveRegion="polite">Loading your progress…</Text> : null}
        {load === 'error' ? <Text style={s.error} accessibilityRole="alert">Your progress could not be loaded on this device.</Text> : null}

        {load === 'ready' ? (
          <>
            <Text style={s.section}>Progress · {percent}%</Text>
            <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
              <View style={[s.barFill, { width: `${percent}%` }]} />
            </View>
            {next ? (
              <View style={s.card} accessibilityLabel={`Next: ${next.title}`}>
                <Text style={s.cardLabel}>NEXT</Text>
                <Text style={s.cardTitle}>{next.title}</Text>
                <Text style={s.body}>{next.description}</Text>
                <Pressable style={s.primary} accessibilityRole="button" onPress={() => void save(next.id)}>
                  <Text style={s.primaryText}>Mark complete</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.card}><Text style={s.cardTitle}>All 15 steps complete.</Text></View>
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

            <SectionTitle>All steps</SectionTitle>
            {STARTUP_ACADEMY_TRACK.map((step) => {
              const done = progress.completedSteps.includes(step.id);
              return (
                <View key={step.id} style={s.row} accessibilityLabel={`${step.title}, ${done ? 'completed' : 'not completed'}`}>
                  <Text style={s.rowMark}>{done ? '✓' : '○'}</Text>
                  <Text style={done ? s.rowTitleDone : s.rowTitle}>{step.title}</Text>
                </View>
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

        {message ? <Text style={s.error} accessibilityRole="alert">{message}</Text> : null}
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
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  input: { minHeight: 70, borderWidth: 1, borderColor: t.border, backgroundColor: t.input, color: t.text, fontSize: 15, padding: 10, textAlignVertical: 'top' as const },
  cardLabel: { color: t.accent, fontWeight: '700' as const, fontSize: 12, letterSpacing: 0.6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  meta: { color: t.textMuted, fontSize: 13 },
  primary: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
  row: { flexDirection: 'row' as const, gap: 10, alignItems: 'center' as const, paddingVertical: 6 },
  rowMark: { color: t.accent, fontSize: 16, width: 20 },
  rowTitle: { color: t.textSecondary, fontSize: 15, flexShrink: 1 },
  rowTitleDone: { color: t.textMuted, fontSize: 15, flexShrink: 1, textDecorationLine: 'line-through' as const },
});
