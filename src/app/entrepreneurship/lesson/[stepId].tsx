import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { academyPlanPath, planSectionForLesson } from '@/core/academy/workspace-store';
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
import { getLessonContentOrNull } from '@/core/academy/lessons';
import {
  ACADEMY_LESSON_EXERCISES_STORAGE_KEY,
  academyExerciseTrackPercent,
  canMarkLessonComplete,
  isExerciseChecked,
  parseLessonExerciseProgress,
  persistExerciseToggle,
  type LessonExerciseProgress,
} from '@/core/academy/lesson-progress-store';
import { academyPersistenceStatusLine, getLastAcademySyncAttempt } from '@/core/academy/cloud-persistence';
import { AcademyLessonSignalWorksheet } from '@/components/academy/AcademyLessonSignalWorksheet';
import { ENTREPRENEURSHIP_STORAGE_KEY, parseProgress, persistStepCompletion } from '@/core/entrepreneurship/progress-store';
import { type TrackProgress, type TrackStep } from '@/core/entrepreneurship/tracks';

type Load = 'loading' | 'ready' | 'error';

export default function AcademyLessonScreen() {
  const { stepId: rawStepId } = useLocalSearchParams<{ stepId: string }>();
  const stepId = Array.isArray(rawStepId) ? rawStepId[0] : rawStepId;
  const lesson = stepId ? getAcademyLesson(stepId) : null;
  const s = useThemedStyles(styles);
  const [load, setLoad] = useState<Load>('loading');
  const [progress, setProgress] = useState<TrackProgress>({ completedSteps: [] });
  const [exerciseProgress, setExerciseProgress] = useState<LessonExerciseProgress>({ checkedByStep: {} });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(ENTREPRENEURSHIP_STORAGE_KEY),
      AsyncStorage.getItem(ACADEMY_LESSON_EXERCISES_STORAGE_KEY),
    ])
      .then(([trackRaw, exerciseRaw]) => {
        if (alive) {
          setProgress(parseProgress(trackRaw));
          setExerciseProgress(parseLessonExerciseProgress(exerciseRaw));
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

  const content = lesson ? getLessonContentOrNull(lesson.id) : null;
  const done = lesson ? progress.completedSteps.includes(lesson.id) : false;
  const percent = academyExerciseTrackPercent(exerciseProgress);
  const exercisesComplete = lesson && isTrackStepId(lesson.id) ? canMarkLessonComplete(exerciseProgress, lesson.id) : false;
  const linkedPlanSection =
    lesson && isTrackStepId(lesson.id) ? planSectionForLesson(lesson.id) : null;

  const toggleExercise = useCallback(
    async (exerciseId: string, checked: boolean) => {
      if (!lesson || !isTrackStepId(lesson.id)) return;
      const result = await persistExerciseToggle(AsyncStorage, exerciseProgress, lesson.id, exerciseId, checked);
      if (!result.saved) {
        setMessage('Your exercise progress could not be saved on this device. Try again.');
        return;
      }
      setExerciseProgress(result.progress);
      setMessage(null);
    },
    [lesson, exerciseProgress],
  );

  const markComplete = useCallback(async () => {
    if (!lesson || !isTrackStepId(lesson.id)) return;
    if (!canMarkLessonComplete(exerciseProgress, lesson.id)) {
      setMessage('Complete every required exercise before marking this lesson done.');
      return;
    }
    const result = await persistStepCompletion(AsyncStorage, progress, lesson.id as TrackStep);
    if (!result.saved) {
      setMessage('Your progress could not be saved on this device. Try again.');
      return;
    }
    setProgress(result.progress);
    setMessage(null);
  }, [lesson, progress, exerciseProgress]);

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
          <Text style={s.meta}>{academyPersistenceStatusLine(getLastAcademySyncAttempt().state)}</Text>
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
            {linkedPlanSection ? (
              <Pressable
                style={s.secondary}
                accessibilityRole="button"
                onPress={() => router.push(academyPlanPath(linkedPlanSection) as never)}
              >
                <Text style={s.secondaryText}>Open related plan section</Text>
              </Pressable>
            ) : null}
            {content ? (
              <>
                <Text style={s.section}>Read</Text>
                <Text style={s.body}>{content.read}</Text>
                {isTrackStepId(lesson.id) ? (
                  <AcademyLessonSignalWorksheet
                    stepId={lesson.id}
                    lessonTitle={lesson.title}
                    reflectPrompt={content.reflectPrompt}
                    trackProgress={progress}
                  />
                ) : null}
                <Text style={s.section}>Exercises</Text>
                <Text style={s.meta}>Check each item when you have done the work. Required items must be checked before you can mark this lesson complete.</Text>
                {content.exercises.map((ex) => {
                  const checked = isExerciseChecked(exerciseProgress, lesson.id, ex.id);
                  const required = ex.required !== false;
                  return (
                    <Pressable
                      key={ex.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      style={s.checkRow}
                      onPress={() => void toggleExercise(ex.id, !checked)}
                    >
                      <View style={[s.box, checked && s.boxOn]} />
                      <View style={s.checkBody}>
                        <Text style={s.checkLabel}>
                          {ex.label}
                          {required ? '' : ' (optional)'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
            {done ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>You marked this step complete.</Text>
              </View>
            ) : (
              <>
                {!exercisesComplete ? (
                  <Text style={s.meta}>Finish the required exercises above to unlock marking this lesson complete.</Text>
                ) : null}
                <Pressable
                  style={[s.primary, !exercisesComplete && s.primaryDisabled]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !exercisesComplete }}
                  disabled={!exercisesComplete}
                  onPress={() => void markComplete()}
                >
                  <Text style={s.primaryText}>Mark step complete</Text>
                </Pressable>
              </>
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
  meta: { color: t.textMuted, fontSize: 13, lineHeight: 18 },
  checkRow: { flexDirection: 'row' as const, gap: 12, alignItems: 'flex-start' as const, paddingVertical: 6 },
  box: { width: 22, height: 22, borderWidth: 2, borderColor: t.border, marginTop: 2 },
  boxOn: { backgroundColor: t.accent, borderColor: t.accent },
  checkBody: { flex: 1 },
  checkLabel: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  primary: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
  secondary: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  secondaryText: { color: t.text, fontWeight: '600' as const, fontSize: 14 },
});
