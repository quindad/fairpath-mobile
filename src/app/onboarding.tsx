import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView, KeyboardFooterLayout } from '@/components/FormScrollView';
import { FairBackButton } from '@/components/ProductChrome';
import { SafeAreaView } from 'react-native-safe-area-context';

const LIME = '#A8F32C';
const BLACK = '#090A09';
const CARD = '#151715';
const BORDER = '#303330';
const MUTED = '#909690';

const WORK_CHOICES = ['Direct hire', 'Temporary staffing', 'Contract work', 'Temp-to-hire', 'Part-time', 'Remote', 'Open to anything'];
const HOUSING_CHOICES = ['Apartment', 'House', 'Room', 'Transitional housing', 'Emergency housing', 'Housing stability help', 'Not looking right now'];
const FOCUS_CHOICES = [
  'Jobs & staffing', 'Housing', 'Resources', 'Record relief', 'Academy', 'Entrepreneurship', 'Marketplace', 'My plan',
  'Food', 'Transportation', 'Identification documents', 'Benefits', 'Legal help', 'Safety support', 'Recovery support', 'Nothing urgent',
  'Job matching help', 'Résumé help', 'Interview prep', 'Resource guidance', 'Personal plan', 'Record-relief explanations', 'Do not personalize AI yet',
];

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  type: 'choices' | 'text';
  choices?: string[];
  placeholder?: string;
  optional?: boolean;
  /** Single-select steps (tools). */
  single?: boolean;
};

function buildProfilePayload(
  answers: Record<number, string[]>,
  textAnswers: Record<number, string>,
  complete: boolean,
) {
  const goals = new Set(answers[0] ?? []);
  const tools = answers[2] ?? [];
  if (tools.includes('Reentry & record relief')) goals.add('Reentry');
  if (tools.includes('Veteran transition')) goals.add('Veteran transition');

  const wh = answers[3] ?? [];
  const focus = answers[4] ?? [];

  return {
    goals: Array.from(goals),
    location_text: textAnswers[1]?.trim() ?? '',
    justice_impacted: tools.includes('Reentry & record relief')
      ? 'Yes'
      : tools.includes('Neither — skip for now')
        ? 'Prefer not to say'
        : 'Prefer not to say',
    opportunity_priorities: focus.filter((x) => FOCUS_CHOICES.slice(0, 16).includes(x)),
    work_preferences: wh.filter((x) => WORK_CHOICES.includes(x)),
    housing_preferences: wh.filter((x) => HOUSING_CHOICES.includes(x)),
    ai_preferences: focus.filter((x) => FOCUS_CHOICES.slice(16).includes(x)),
    ...(complete
      ? { onboarding_completed: true, onboarding_completed_at: new Date().toISOString() }
      : {}),
    updated_at: new Date().toISOString(),
  };
}

/** Five focused steps — full detail lives in Opportunity Profile later. */
const steps: Step[] = [
  {
    eyebrow: 'START WITH YOU',
    title: 'What do you want to move forward?',
    body: 'Pick every area that matters right now. FairPath uses this to shape your home screen — not to put you in a box.',
    type: 'choices',
    choices: ['Work & income', 'Housing', 'Food & essentials', 'Reentry', 'Veteran transition', 'Safety & recovery', 'Give or help someone', 'Learn new skills', 'Build a business'],
  },
  {
    eyebrow: 'YOUR LOCATION',
    title: 'Where should FairPath look first?',
    body: 'City, state or ZIP. We use this for nearby jobs, housing and resources. Not shared publicly by default.',
    type: 'text',
    placeholder: 'Columbus, OH or 43215',
  },
  {
    eyebrow: 'YOUR TOOLS',
    title: 'Turn on extra FairPath tools?',
    body: 'Optional. Reentry and veteran tools stay private — never an employer label.',
    type: 'choices',
    single: true,
    choices: ['Reentry & record relief', 'Veteran transition', 'Both', 'Neither — skip for now'],
  },
  {
    eyebrow: 'WORK & HOME',
    title: 'What are you looking for?',
    body: 'Pick everything you would consider today. You can change this anytime in your profile.',
    type: 'choices',
    choices: [...WORK_CHOICES, ...HOUSING_CHOICES],
  },
  {
    eyebrow: 'YOUR FOCUS',
    title: 'What should FairPath put first?',
    body: 'Pick what matters most right now — including urgent needs and how AI can help (you stay in control).',
    type: 'choices',
    choices: FOCUS_CHOICES,
  },
];

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const step = steps[stepIndex];
  const selected = answers[stepIndex] ?? [];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const canContinue =
    step.optional ||
    (step.type === 'text'
      ? Boolean(textAnswers[stepIndex]?.trim())
      : selected.length > 0);

  const buttonLabel = useMemo(
    () => (stepIndex === steps.length - 1 ? 'Finish setup' : 'Continue'),
    [stepIndex],
  );

  function toggleChoice(choice: string) {
    const singleChoice = step.single === true;
    setAnswers((current) => {
      const currentSelected = current[stepIndex] ?? [];
      if (singleChoice) {
        if (choice === 'Both') return { ...current, [stepIndex]: ['Reentry & record relief', 'Veteran transition'] };
        return { ...current, [stepIndex]: [choice] };
      }
      const next = currentSelected.includes(choice)
        ? currentSelected.filter((item) => item !== choice)
        : [...currentSelected, choice];
      return { ...current, [stepIndex]: next };
    });
  }

  function goBack() {
    if (stepIndex === 0) {
      router.replace('/find-jobs');
      return;
    }
    setStepIndex((current) => current - 1);
  }

  async function persistProfile(complete: boolean) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaveError('Your session expired. Sign in again so FairPath can securely save your setup.');
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update(buildProfilePayload(answers, textAnswers, complete))
      .eq('id', user.id);

    if (error) {
      setSaveError('We could not save your setup. Your answers are still here — try again.');
      return false;
    }
    return true;
  }

  async function finishOnboarding() {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const ok = await persistProfile(true);
      if (ok) router.replace('/home');
    } catch {
      setSaveError('We could not save your setup. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function finishLater() {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const ok = await persistProfile(true);
      if (ok) router.replace('/home');
    } catch {
      setSaveError('We could not save. Try again or sign out and back in.');
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (!canContinue || saving) return;

    if (stepIndex === steps.length - 1) {
      await finishOnboarding();
      return;
    }

    setSaveError('');
    setSaving(true);
    try {
      await persistProfile(false);
      setStepIndex((current) => current + 1);
    } catch {
      setSaveError('We could not save this step. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardFooterLayout>
        <View style={styles.topBar}>
          <FairBackButton onPress={goBack} />
          <Text style={styles.stepCount}>{stepIndex + 1} / {steps.length}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <FormScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.eyebrow}>{step.eyebrow}</Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>

          {step.type === 'choices' ? (
            <View style={styles.choiceList}>
              {step.choices?.map((choice) => {
                const isSelected = selected.includes(choice)
                  || (choice === 'Both' && selected.includes('Reentry & record relief') && selected.includes('Veteran transition'));
                return (
                  <Pressable
                    key={choice}
                    accessibilityRole="button"
                    accessibilityLabel={choice}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => toggleChoice(choice)}
                    style={[styles.choice, isSelected && styles.choiceSelected]}
                  >
                    <View style={[styles.choiceMark, isSelected && styles.choiceMarkSelected]}>
                      <Text style={styles.choiceMarkText}>{isSelected ? '✓' : ''}</Text>
                    </View>
                    <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.inputWrap}>
              <TextInput
                value={textAnswers[stepIndex] ?? ''}
                onChangeText={(value) => setTextAnswers((current) => ({ ...current, [stepIndex]: value }))}
                placeholder={step.placeholder}
                placeholderTextColor="#666C66"
                autoCapitalize="words"
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => void goNext()}
              />
              <Text style={styles.privacyNote}>Used for matching. Never shown publicly by default.</Text>
            </View>
          )}
        </FormScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving your FairPath' : buttonLabel}
            onPress={() => void goNext()}
            disabled={!canContinue || saving}
            style={[styles.primaryButton, (!canContinue || saving) && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving your FairPath…' : buttonLabel}</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          {stepIndex === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish setup later and browse FairPath"
              onPress={() => void finishLater()}
              disabled={saving}
              style={styles.skipLink}
            >
              <Text style={styles.skipLinkText}>Finish later — browse jobs and housing first</Text>
            </Pressable>
          ) : null}
          <Text style={styles.footerNote}>You stay in control of what FairPath uses to personalize your experience.</Text>
        </View>
        </KeyboardFooterLayout>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
  },
  stepCount: { color: '#777D77', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  progressTrack: { height: 3, backgroundColor: '#202320', marginHorizontal: 24, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: LIME, borderRadius: 99 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 54, paddingBottom: 28 },
  eyebrow: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 15 },
  title: { color: '#F7F8F6', fontSize: 42, lineHeight: 46, fontWeight: '800', letterSpacing: -1.8, maxWidth: 540 },
  body: { color: MUTED, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 520 },
  choiceList: { gap: 12, marginTop: 38 },
  choice: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  choiceSelected: { borderColor: LIME, backgroundColor: '#182014' },
  choiceMark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#4A4F4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceMarkSelected: { backgroundColor: LIME, borderColor: LIME },
  choiceMarkText: { color: BLACK, fontSize: 15, fontWeight: '900' },
  choiceText: { color: '#D7DAD6', fontSize: 16, fontWeight: '700', flex: 1 },
  choiceTextSelected: { color: '#F7F8F6' },
  inputWrap: { marginTop: 38 },
  input: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    color: '#F7F8F6',
    fontSize: 17,
    paddingHorizontal: 18,
  },
  privacyNote: { color: '#6F756F', fontSize: 12, lineHeight: 18, marginTop: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 },
  primaryButton: {
    minHeight: 60,
    borderRadius: 18,
    backgroundColor: LIME,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonDisabled: { opacity: 0.32 },
  primaryButtonText: { color: BLACK, fontSize: 17, fontWeight: '900' },
  arrow: { color: BLACK, fontSize: 25 },
  errorText: { color: '#FF8A8A', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12, paddingHorizontal: 14 },
  footerNote: { color: '#626762', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 11, paddingHorizontal: 14 },
  skipLink: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  skipLinkText: { color: MUTED, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
