import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { ACADEMY_HONESTY_BANNER, ACADEMY_ROUTES } from '@/core/academy/catalog';
import { loadAcademyWorkspace, saveStartupBudget } from '@/core/academy/workspace-store';
import {
  PLAN_DISCLAIMER,
  addBudgetLine as addLine,
  parseBudgetAmount,
  removeBudgetLine as removeLine,
  setExpectedMonthlyRevenue,
  summarizeBudget,
  updateBudgetLine as patchLine,
  type BudgetLine,
  type StartupBudget,
} from '@/core/entrepreneurship/business-plan';

type Load = 'loading' | 'ready' | 'error';
type BudgetListKey = 'oneTimeCosts' | 'monthlyCosts';

const AUTOSAVE_MS = 450;

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function patchBudgetList(budget: StartupBudget, key: BudgetListKey, lines: BudgetLine[]): StartupBudget {
  return key === 'oneTimeCosts' ? { ...budget, oneTimeCosts: lines } : { ...budget, monthlyCosts: lines };
}

export default function AcademyStartupBudgetScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [load, setLoad] = useState<Load>('loading');
  const [budget, setBudget] = useState<StartupBudget>({ oneTimeCosts: [], monthlyCosts: [], expectedMonthlyRevenue: 0 });
  const [revenueText, setRevenueText] = useState('');
  const [saveNote, setSaveNote] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const budgetRef = useRef(budget);
  budgetRef.current = budget;

  useEffect(() => {
    let alive = true;
    loadAcademyWorkspace(AsyncStorage)
      .then((ws) => {
        if (alive) {
          setBudget(ws.budget);
          setRevenueText(ws.budget.expectedMonthlyRevenue ? String(ws.budget.expectedMonthlyRevenue) : '');
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

  const flushSave = useCallback(async (next: StartupBudget) => {
    setSaveNote('saving');
    const ok = await saveStartupBudget(AsyncStorage, next);
    setSaveNote(ok ? 'saved' : 'error');
  }, []);

  const scheduleSave = useCallback(
    (next: StartupBudget) => {
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

  function applyBudget(next: StartupBudget) {
    setBudget(next);
    scheduleSave(next);
  }

  const summary = summarizeBudget(budget);

  function renderLines(title: string, key: BudgetListKey) {
    const lines = budget[key];
    return (
      <View style={s.block}>
        <Text style={s.sectionTitle}>{title}</Text>
        {lines.map((line, index) => (
          <View key={`${key}-${index}`} style={s.lineRow}>
            <TextInput
              style={[s.input, s.labelInput]}
              value={line.label}
              onChangeText={(label) => {
                const b = budgetRef.current;
                const nextLines = patchLine(b[key], index, { label, monthlyUsd: line.monthlyUsd });
                applyBudget(patchBudgetList(b, key, nextLines));
              }}
              placeholder="Label"
              placeholderTextColor={tokens.textMuted}
              accessibilityLabel={`${title} label ${index + 1}`}
            />
            <TextInput
              style={[s.input, s.amountInput]}
              value={line.monthlyUsd ? String(line.monthlyUsd) : ''}
              onChangeText={(raw) => {
                const b = budgetRef.current;
                const nextLines = patchLine(b[key], index, { monthlyUsd: parseBudgetAmount(raw) });
                applyBudget(patchBudgetList(b, key, nextLines));
              }}
              placeholder="0"
              placeholderTextColor={tokens.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel={`${title} amount ${index + 1}`}
            />
            <Pressable
              style={s.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${title} line ${index + 1}`}
              onPress={() => {
                const b = budgetRef.current;
                applyBudget(patchBudgetList(b, key, removeLine(b[key], index)));
              }}
            >
              <Text style={s.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          style={s.secondary}
          accessibilityRole="button"
          onPress={() => {
            const b = budgetRef.current;
            applyBudget(patchBudgetList(b, key, addLine(b[key])));
          }}
        >
          <Text style={s.secondaryText}>Add line</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="STARTUP ACADEMY" title="Startup budget" backTo={ACADEMY_ROUTES.home} />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Member-entered numbers only</Text>
          <Text style={s.body}>{ACADEMY_HONESTY_BANNER}</Text>
          <Text style={s.body}>{PLAN_DISCLAIMER}</Text>
        </View>

        {load === 'loading' ? <Text style={s.body}>Loading your budget…</Text> : null}
        {load === 'error' ? (
          <Text style={s.error} accessibilityRole="alert">
            Your budget could not be loaded on this device.
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
            {renderLines('One-time startup costs', 'oneTimeCosts')}
            {renderLines('Monthly costs', 'monthlyCosts')}
            <View style={s.block}>
              <Text style={s.sectionTitle}>Expected monthly revenue</Text>
              <TextInput
                style={s.input}
                value={revenueText}
                onChangeText={(raw) => {
                  setRevenueText(raw);
                  applyBudget(setExpectedMonthlyRevenue(budgetRef.current, parseBudgetAmount(raw)));
                }}
                placeholder="0"
                placeholderTextColor={tokens.textMuted}
                keyboardType="decimal-pad"
                accessibilityLabel="Expected monthly revenue"
              />
            </View>
            <View style={s.summary}>
              <Text style={s.sectionTitle}>Summary (your numbers)</Text>
              <Text style={s.body}>One-time total: {formatUsd(summary.totalOneTimeUsd)}</Text>
              <Text style={s.body}>Monthly costs: {formatUsd(summary.totalMonthlyCostsUsd)}</Text>
              <Text style={s.body}>Monthly net after costs: {formatUsd(summary.monthlyNetUsd)}</Text>
              <Text style={s.body}>
                {summary.monthsToCoverStartupCosts === null
                  ? 'Months to cover startup costs: not enough positive monthly net to estimate.'
                  : `Months to cover startup costs (estimate): ${summary.monthsToCoverStartupCosts}`}
              </Text>
            </View>
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
  block: { gap: 8 },
  sectionTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  lineRow: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, flexWrap: 'wrap' as const },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.input,
    color: t.text,
    fontSize: 15,
    padding: 10,
  },
  labelInput: { flex: 1, minWidth: 120 },
  amountInput: { width: 96 },
  removeBtn: { minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: 8 },
  removeText: { color: t.textSecondary, fontSize: 14 },
  secondary: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  secondaryText: { color: t.text, fontWeight: '600' as const, fontSize: 14 },
  summary: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
});
