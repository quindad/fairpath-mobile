import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import {
  certificateEligible, complete, completeLesson, enroll, progressPercent, scoreAttempt,
  type Enrollment,
} from '@/core/academy/enrollment';
import { NATIVE_FIXTURE_COURSE, scoreQuiz } from '@/core/academy/native-fixtures';
import { loadEnrollments, saveEnrollments, type EnrollmentMap } from '@/core/academy/progress-store';

type LoadState = 'loading' | 'ready' | 'error';

export default function AcademyCourseScreen() {
  const s = useThemedStyles(styles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const course = id === NATIVE_FIXTURE_COURSE.id ? NATIVE_FIXTURE_COURSE : null;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [map, setMap] = useState<EnrollmentMap>({});
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadEnrollments(AsyncStorage).then((loaded) => {
      if (!alive) return;
      setMap(loaded);
      setLoadState('ready');
    }).catch(() => {
      if (alive) setLoadState('error');
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!course) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="ACADEMY" title="Course not found" backTo="/academy" />
        <View style={s.content}>
          <Text style={s.body}>This course is not available. It may have been removed or is not yet published.</Text>
        </View>
      </ScreenFrame>
    );
  }

  const enrollment: Enrollment | null = map[course.id] ?? null;

  const persist = async (next: EnrollmentMap) => {
    const ok = await saveEnrollments(AsyncStorage, next);
    if (ok) {
      setMap(next);
      setMessage(null);
    } else {
      setMessage('Progress could not be saved on this device. Try again.');
    }
  };

  const update = (fn: (e: Enrollment) => Enrollment) => {
    if (!enrollment) return;
    persist({ ...map, [course.id]: fn(enrollment) });
  };

  const onEnroll = () => persist({ ...map, [course.id]: enroll(course, new Date().toISOString(), enrollment) });

  const onSubmitQuiz = () => {
    if (!enrollment) return;
    const { correct, total } = scoreQuiz(course.quiz, answers);
    const attempt = scoreAttempt(course, correct, total, new Date().toISOString());
    if (!attempt) return;
    update((e) => ({ ...e, attempts: [...e.attempts, attempt] }));
  };

  const eligibility = enrollment ? certificateEligible(course, enrollment) : null;
  const percent = enrollment ? progressPercent(course, enrollment) : 0;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="ACADEMY · DEV FIXTURE" title={course.title} backTo="/academy" />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Development fixture</Text>
          <Text style={s.body}>Lessons, quiz and certificate here are for testing only. They are not a real course or credential.</Text>
        </View>

        {loadState === 'loading' ? <Text style={s.body} accessibilityLiveRegion="polite">Loading your progress…</Text> : null}
        {loadState === 'error' ? <Text style={s.error} accessibilityRole="alert">Your progress could not be loaded on this device.</Text> : null}

        {loadState === 'ready' && !enrollment ? (
          <Pressable style={s.primary} accessibilityRole="button" accessibilityLabel="Enroll in this course" onPress={onEnroll}>
            <Text style={s.primaryText}>Enroll</Text>
          </Pressable>
        ) : null}

        {enrollment ? (
          <>
            <Text style={s.section}>Progress · {percent}%</Text>
            <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
              <View style={[s.barFill, { width: `${percent}%` }]} />
            </View>

            <Text style={s.section}>Lessons</Text>
            {course.lessons.map((lesson) => {
              const done = enrollment.completedLessonIds.includes(lesson.id);
              return (
                <View key={lesson.id} style={s.card}>
                  <Text style={s.cardTitle}>{lesson.title}{lesson.required ? '' : ' (optional)'}</Text>
                  <Pressable
                    style={done ? s.doneButton : s.secondary}
                    accessibilityRole="button"
                    accessibilityLabel={done ? `${lesson.title}, completed` : `Mark ${lesson.title} complete`}
                    onPress={() => update((e) => completeLesson(course, e, lesson.id))}
                    disabled={done}
                  >
                    <Text style={done ? s.doneText : s.secondaryText}>{done ? 'Completed' : 'Mark complete'}</Text>
                  </Pressable>
                </View>
              );
            })}

            <Text style={s.section}>Assessment</Text>
            {course.quiz.map((q, qi) => (
              <View key={q.id} style={s.card} accessibilityLabel={`Question ${qi + 1}: ${q.prompt}`}>
                <Text style={s.cardTitle}>{qi + 1}. {q.prompt}</Text>
                {q.choices.map((choice, ci) => {
                  const selected = answers[qi] === ci;
                  return (
                    <Pressable
                      key={choice}
                      style={selected ? s.choiceSelected : s.choice}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={choice}
                      onPress={() => setAnswers((prev) => {
                        const next = [...prev];
                        next[qi] = ci;
                        return next;
                      })}
                    >
                      <Text style={s.body}>{choice}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Pressable
              style={s.primary}
              accessibilityRole="button"
              accessibilityLabel="Submit assessment"
              onPress={onSubmitQuiz}
              disabled={answers.filter((a) => a !== null && a !== undefined).length < course.quiz.length}
            >
              <Text style={s.primaryText}>Submit assessment</Text>
            </Pressable>
            {enrollment.attempts.length > 0 ? (
              <Text style={s.body}>
                Last score: {enrollment.attempts[enrollment.attempts.length - 1]!.score} of {enrollment.attempts[enrollment.attempts.length - 1]!.maxScore}
              </Text>
            ) : null}

            <Text style={s.section}>Certificate</Text>
            {eligibility && eligibility.eligible === false ? (
              <Text style={s.body}>
                {eligibility.reason === 'lessons_incomplete' ? 'Complete every required lesson to unlock the certificate.' : 'Pass the assessment to unlock the certificate.'}
              </Text>
            ) : null}
            {eligibility && eligibility.eligible ? (
              enrollment.completedAt ? (
                <Text style={s.body}>Certificate of completion recorded on this device for {new Date(enrollment.completedAt).toLocaleDateString()}. DEV fixture only.</Text>
              ) : (
                <Pressable style={s.primary} accessibilityRole="button" onPress={() => update((e) => complete(course, e, new Date().toISOString()))}>
                  <Text style={s.primaryText}>Record completion</Text>
                </Pressable>
              )
            ) : null}
          </>
        ) : null}

        {message ? <Text style={s.error} accessibilityRole="alert">{message}</Text> : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  section: { color: t.text, fontWeight: '700' as const, fontSize: 17, marginTop: 8 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  bar: { height: 8, backgroundColor: t.border },
  barFill: { height: 8, backgroundColor: t.accent },
  primary: { minHeight: 48, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
  secondary: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: t.accent },
  secondaryText: { color: t.accent, fontWeight: '700' as const },
  doneButton: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.border },
  doneText: { color: t.textSecondary, fontWeight: '700' as const },
  choice: { minHeight: 48, justifyContent: 'center' as const, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border },
  choiceSelected: { minHeight: 48, justifyContent: 'center' as const, paddingHorizontal: 12, borderWidth: 2, borderColor: t.accent },
});
