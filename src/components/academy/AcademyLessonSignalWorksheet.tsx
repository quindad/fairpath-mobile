import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import type { TrackProgress, TrackStep } from '@/core/entrepreneurship/tracks';
import { enrollmentFromStartupTrack, STARTUP_ACADEMY_COURSE, startupTrackFullyComplete } from '@/core/academy/startup-course';
import {
  includedCompanionActions,
  loadLessonWorksheetNotes,
  loadWorksheetConsent,
  saveLessonWorksheetNotes,
  saveWorksheetConsent,
  signalWorksheetConsentLine,
  studyPlanForLesson,
} from '@/core/academy/signal-worksheet';

type Props = {
  stepId: TrackStep;
  lessonTitle: string;
  reflectPrompt: string;
  trackProgress: TrackProgress;
};

export function AcademyLessonSignalWorksheet({ stepId, lessonTitle, reflectPrompt, trackProgress }: Props) {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const enrollment = enrollmentFromStartupTrack(trackProgress, '2026-01-01T00:00:00.000Z');
  const plan = studyPlanForLesson(STARTUP_ACADEMY_COURSE, enrollment, startupTrackFullyComplete(trackProgress));
  const included = includedCompanionActions();

  useEffect(() => {
    let alive = true;
    Promise.all([loadLessonWorksheetNotes(stepId), loadWorksheetConsent()]).then(([loadedNotes, loadedConsent]) => {
      if (!alive) return;
      setNotes(loadedNotes);
      setConsent(loadedConsent);
    });
    return () => {
      alive = false;
    };
  }, [stepId]);

  const persistNotes = useCallback(
    async (text: string) => {
      if (!consent) {
        setSaveNote('Turn on consent below to save worksheet notes on this device.');
        return;
      }
      const ok = await saveLessonWorksheetNotes(stepId, text);
      setSaveNote(ok ? 'Worksheet notes saved on this device.' : 'Could not save worksheet notes.');
    },
    [consent, stepId],
  );

  return (
    <View style={s.wrap}>
      <Text style={s.section}>Signal worksheet · no credits</Text>
      <Text style={s.meta}>{signalWorksheetConsentLine()}</Text>
      <Text style={s.body}>
        Reflect on: {reflectPrompt}
      </Text>
      <TextInput
        style={s.input}
        multiline
        value={notes}
        onChangeText={setNotes}
        onBlur={() => void persistNotes(notes)}
        placeholder={`Your notes for “${lessonTitle}”`}
        placeholderTextColor={tokens.textMuted}
        accessibilityLabel="Lesson worksheet notes"
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        style={s.checkRow}
        onPress={() => {
          const next = !consent;
          setConsent(next);
          void saveWorksheetConsent(next);
        }}
      >
        <View style={[s.box, consent && s.boxOn]} />
        <Text style={s.checkLabel}>
          I understand this worksheet stays on my device until Academy cloud backup succeeds. Signal AI coaching is not used here.
        </Text>
      </Pressable>
      {saveNote ? <Text style={s.meta}>{saveNote}</Text> : null}

      <Text style={s.section}>Study plan from your progress</Text>
      {plan.steps.length === 0 ? (
        <Text style={s.body}>You have finished the required steps for this track. Review your notes and plan sections.</Text>
      ) : (
        plan.steps.map((step) => (
          <Text key={step.id} style={s.step}>
            · {step.text}
          </Text>
        ))
      )}
      <Text style={s.meta}>{plan.percentComplete}% of required Startup Academy lessons complete.</Text>

      {included.length ? (
        <>
          <Text style={s.section}>Included companion tools</Text>
          {included.map((action) => (
            <Text key={action.id} style={s.body}>
              {action.label} — included, no credit charge from this worksheet.
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  wrap: { gap: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14 },
  section: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  meta: { color: t.textMuted, fontSize: 13, lineHeight: 18 },
  step: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top' as const,
  },
  checkRow: { flexDirection: 'row' as const, gap: 12, alignItems: 'flex-start' as const },
  box: { width: 22, height: 22, borderWidth: 2, borderColor: t.border, marginTop: 2 },
  boxOn: { backgroundColor: t.accent, borderColor: t.accent },
  checkLabel: { flex: 1, color: t.textSecondary, fontSize: 13, lineHeight: 18 },
});
