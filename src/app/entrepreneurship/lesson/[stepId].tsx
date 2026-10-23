import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import {
  ACADEMY_HONESTY_BANNER,
  ACADEMY_ROUTES,
  ACADEMY_STAGE_LABELS,
  getAcademyLesson,
  isTrackStepId,
} from '@/core/academy/catalog';
import { ENTREPRENEURSHIP_STORAGE_KEY, parseProgress, persistStepCompletion } from '@/core/entrepreneurship/progress-store';
import { trackPercent, type TrackProgress, type TrackStep } from '@/core/entrepreneurship/tracks';

type Load = 'loading' | 'ready' | 'error';

export default function AcademyLessonScreen() {
  const { stepId: rawStepId } = useLocalSearchParams<{ stepId: string }>();
  const stepId = Array.isArray(rawStepId) ? rawStepId[0] : rawStepId;
  const lesson = stepId ? getAcademyLesson(stepId) : null;
  const s = useThemedStyles(styles);
  const [load, setLoad] = useState<Load>('loading');
  const [progress, setProgress] = useState<TrackProgress>({ completedSteps: [] });
  const [message, setMessage] = useState<string | null>(null);

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

  const done = lesson ? progress.completedSteps.includes(lesson.id) : false;
  const percent = trackPercent(progress);

  const markComplete = useCallback(async () => {
    if (!lesson || !isTrackStepId(lesson.id)) return;
    const result = await persistStepCompletion(AsyncStorage, progress, lesson.id as TrackStep);
    if (!result.saved) {
      setMessage('Your progress could not be saved on this device. Try again.');
      return;
    }
    setProgress(result.progress);
    setMessage(null);
  }, [lesson, progress]);

  if (!lesson) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="STARTUP ACADEMY" title="Lesson not found" backTo={ACADEMY_ROUTES.home} />
        <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
          <Text style={s.body}>That lesson is not part of the Startup Academy track.</Text>
          <Pressable style={s.primary} accessibilityRole="button" onPress={() => router.replace(ACADEMY_ROUTES.home as never)}>
            <Text style={s.primaryText}>Back to academy home</Text>
          </Pressable>
        </FormScrollView>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <PageHeader
        eyebrow={`LESSON ${lesson.order} · ${ACADEMY_STAGE_LABELS[lesson.stage].toUpperCase()}`}
        title={lesson.title}
        backTo={ACADEMY_ROUTES.home}
      />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>On this device only</Text>
          <Text style={s.body}>{ACADEMY_HONESTY_BANNER}</Text>
        </View>

        {load === 'loading' ? <Text style={s.body}>Loading your progress…</Text> : null}
        {load === 'error' ? (
          <Text style={s.error} accessibilityRole="alert">
            Your progress could not be loaded on this device.
          </Text>
        ) : null}

        {load === 'ready' ? (
          <>
            <Text style={s.section}>Track progress · {percent}%</Text>
            <Text style={s.body}>{lesson.description}</Text>
            <Text style={s.body}>
              Full lesson exercises and checklists arrive in the next academy update. For now, use this screen to read the step and mark it complete when you have done the work offline.
            </Text>
            {done ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>You marked this step complete.</Text>
              </View>
            ) : (
              <Pressable style={s.primary} accessibilityRole="button" onPress={() => void markComplete()}>
                <Text style={s.primaryText}>Mark step complete</Text>
              </Pressable>
            )}
          </>
        ) : null}

        {message ? (
          <Text style={s.error} accessibilityRole="alert">
            {message}
          </Text>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  section: { color: t.text, fontWeight: '700' as const, fontSize: 17 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  primary: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
});
