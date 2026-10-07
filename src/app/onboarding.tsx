import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView, KeyboardFooterLayout } from '@/components/FormScrollView';
import { FairBackButton } from '@/components/ProductChrome';
import { SafeAreaView } from 'react-native-safe-area-context';

const LIME = '#A8F32C';
const BLACK = '#090A09';
const CARD = '#151715';
const BORDER = '#303330';
const MUTED = '#909690';

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  type: 'choices' | 'text';
  choices?: string[];
  placeholder?: string;
  optional?: boolean;
};

const steps: Step[] = [
  {
    eyebrow: 'START WITH YOU',
    title: 'What do you want to move forward?',
    body: 'Pick every area that matters right now. FairPath uses this to shape your home screen and next steps — not to put you in a box.',
    type: 'choices',
    choices: ['Work & income', 'Housing', 'Food & essentials', 'Reentry', 'Veteran transition', 'Safety & recovery', 'Give or help someone', 'Learn new skills', 'Build a business'],
  },
  {
    eyebrow: 'YOUR LOCATION',
    title: 'Where should FairPath look first?',
    body: 'Enter your city, state or ZIP. We use location to find nearby jobs, housing, resources and jurisdiction-specific tools. It is not shared publicly by default.',
    type: 'text',
    placeholder: 'Columbus, OH or 43215',
  },
  {
    eyebrow: 'PRIVATE REENTRY SETUP',
    title: 'Should FairPath turn on reentry tools for you?',
    body: 'This can unlock fair-chance job help, record-relief tools and reentry resources. Your answer stays private and is never used as an employer label.',
    type: 'choices',
    choices: ['Yes — turn on reentry tools', 'No', 'Not right now'],
  },
  {
    eyebrow: 'VETERANS',
    title: 'Should FairPath turn on veteran tools?',
    body: 'Veteran tools can help translate military experience, organize transition goals and find civilian opportunities. Service history is not shared with employers unless you choose to share it.',
    type: 'choices',
    choices: ['Yes — turn on veteran tools', 'No', 'Not right now'],
  },
  {
    eyebrow: 'WORK',
    title: 'How do you want to work?',
    body: 'Direct hire and FairPath Staffing can live in the same job experience. Pick everything you would consider.',
    type: 'choices',
    choices: ['Direct hire', 'Temporary staffing', 'Contract work', 'Temp-to-hire', 'Part-time', 'Remote', 'Open to anything'],
  },
  {
    eyebrow: 'HOUSING',
    title: 'What housing should we prioritize?',
    body: 'Choose what fits today. Emergency and stability resources stay separate from ordinary rental browsing so urgent needs do not get buried.',
    type: 'choices',
    choices: ['Apartment', 'House', 'Room', 'Transitional housing', 'Emergency housing', 'Housing stability help', 'Not looking right now'],
  },
  {
    eyebrow: 'HELP TODAY',
    title: 'Anything you need help with right now?',
    body: 'These choices help FairPath bring practical resources forward. Choosing one does not automatically share the need with another organization.',
    type: 'choices',
    choices: ['Food', 'Transportation', 'Identification documents', 'Benefits', 'Legal help', 'Safety support', 'Recovery support', 'Nothing urgent'],
  },
  {
    eyebrow: 'YOUR NEXT MOVE',
    title: 'What should FairPath put first?',
    body: 'This controls what rises to the top of your experience. You can change it anytime.',
    type: 'choices',
    choices: ['Jobs & staffing', 'Housing', 'Resources', 'Record relief', 'Academy', 'Entrepreneurship', 'Marketplace', 'My plan'],
  },
  {
    eyebrow: 'FAIRPATH AI',
    title: 'Choose how AI can help.',
    body: 'AI can help you do the work, but it does not make hiring, housing, legal or eligibility decisions. Nothing is submitted or changed without your action.',
    type: 'choices',
    choices: ['Job matching help', 'Résumé help', 'Interview prep', 'Resource guidance', 'Personal plan', 'Record-relief explanations', 'Do not personalize AI yet'],
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
    [stepIndex]
  );

  function toggleChoice(choice: string) {
    const singleChoice = stepIndex === 2 || stepIndex === 3;
    setAnswers((current) => {
      const currentSelected = current[stepIndex] ?? [];
      const next = singleChoice
        ? [choice]
        : currentSelected.includes(choice)
          ? currentSelected.filter((item) => item !== choice)
          : [...currentSelected, choice];
      return { ...current, [stepIndex]: next };
    });
  }

  function goBack() {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStepIndex((current) => current - 1);
  }

  async function finishOnboarding() {
    if (saving) return;

    setSaving(true);
    setSaveError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSaveError('Your session expired. Sign in again so FairPath can securely save your setup.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          goals: Array.from(new Set([...(answers[0] ?? []), ...(answers[3]?.[0]?.startsWith('Yes') ? ['Veteran transition'] : [])])),
          location_text: textAnswers[1]?.trim() ?? '',
          justice_impacted: answers[2]?.[0]?.startsWith('Yes') ? 'Yes' : answers[2]?.[0] === 'No' ? 'No' : 'Prefer not to say',
          opportunity_priorities: [...(answers[6] ?? []), ...(answers[7] ?? [])],
          work_preferences: answers[4] ?? [],
          housing_preferences: answers[5] ?? [],
          ai_preferences: answers[8] ?? [],
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        setSaveError('We could not save your setup. Your answers are still here — try again.');
        return;
      }

      router.replace('/home');
    } catch {
      setSaveError('We could not save your setup. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    if (!canContinue || saving) return;

    if (stepIndex === steps.length - 1) {
      void finishOnboarding();
      return;
    }

    setSaveError('');
    setStepIndex((current) => current + 1);
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
                const isSelected = selected.includes(choice);
                return (
                  <Pressable
                    key={choice}
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
                onSubmitEditing={goNext}
              />
              <Text style={styles.privacyNote}>Used for matching. Never shown publicly by default.</Text>
            </View>
          )}
        </FormScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={goNext}
            disabled={!canContinue || saving}
            style={[styles.primaryButton, (!canContinue || saving) && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving your FairPath…' : buttonLabel}</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: '#F6F7F5', fontSize: 23, lineHeight: 25 },
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
});