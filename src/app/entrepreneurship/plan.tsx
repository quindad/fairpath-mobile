import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { ACADEMY_HONESTY_BANNER, ACADEMY_ROUTES } from '@/core/academy/catalog';
import { loadAcademyWorkspace, saveBusinessPlan } from '@/core/academy/workspace-store';
import { PLAN_DISCLAIMER, updateSection, type PlanSection } from '@/core/entrepreneurship/business-plan';

type Load = 'loading' | 'ready' | 'error';

const AUTOSAVE_MS = 450;

export default function AcademyBusinessPlanScreen() {
  const { section: rawSection } = useLocalSearchParams<{ section?: string }>();
  const focusSection = Array.isArray(rawSection) ? rawSection[0] : rawSection;
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [load, setLoad] = useState<Load>('loading');
  const [plan, setPlan] = useState<PlanSection[]>([]);
  const [saveNote, setSaveNote] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    let alive = true;
    loadAcademyWorkspace(AsyncStorage)
      .then((ws) => {
        if (alive) {
          setPlan(ws.plan);
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

  const flushSave = useCallback(async (next: PlanSection[]) => {
    setSaveNote('saving');
    const ok = await saveBusinessPlan(AsyncStorage, next);
    setSaveNote(ok ? 'saved' : 'error');
  }, []);

  const scheduleSave = useCallback(
    (next: PlanSection[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(next);
      }, AUTOSAVE_MS);
    },
    [flushSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function onSectionChange(id: string, content: string) {
    const next = updateSection(planRef.current, id, content);
    setPlan(next);
    scheduleSave(next);
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="STARTUP ACADEMY" title="Business plan" backTo={ACADEMY_ROUTES.home} />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Your words, your business</Text>
          <Text style={s.body}>{ACADEMY_HONESTY_BANNER}</Text>
          <Text style={s.body}>{PLAN_DISCLAIMER}</Text>
        </View>

        {load === 'loading' ? <Text style={s.body}>Loading your plan…</Text> : null}
        {load === 'error' ? (
          <Text style={s.error} accessibilityRole="alert">
            Your plan could not be loaded on this device.
          </Text>
        ) : null}

        {load === 'ready' ? (
          <>
            <Text style={s.meta} accessibilityLiveRegion="polite">
              {saveNote === 'saving'
                ? 'Saving…'
                : saveNote === 'saved'
                  ? 'Saved on this device.'
                  : saveNote === 'error'
                    ? 'Could not save — check storage and try again.'
                    : 'Edits autosave on this device.'}
            </Text>
            {plan.map((section) => {
              const highlighted = focusSection === section.id;
              return (
                <View
                  key={section.id}
                  style={[s.sectionCard, highlighted && s.sectionCardFocus]}
                  accessibilityLabel={section.title}
                >
                  <Text style={s.sectionTitle}>{section.title}</Text>
                  <Text style={s.prompt}>{section.prompt}</Text>
                  <TextInput
                    style={s.input}
                    value={section.content}
                    onChangeText={(t) => onSectionChange(section.id, t)}
                    placeholder="Write here…"
                    placeholderTextColor={tokens.textMuted}
                    multiline
                    accessibilityLabel={section.title}
                  />
                </View>
              );
            })}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 8 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  meta: { color: t.textMuted, fontSize: 13 },
  sectionCard: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  sectionCardFocus: { borderColor: t.accent, borderLeftWidth: 3 },
  sectionTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  prompt: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.input,
    color: t.text,
    fontSize: 15,
    padding: 10,
    textAlignVertical: 'top' as const,
  },
});
