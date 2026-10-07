import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { AI_ACTION_CREDITS, tierMayUse, TIERS, type TierId } from '@/core/membership/frozen-v1';
import { paydownToTarget, utilization, utilizationBand } from '@/core/credit-studio/utilization';
import { usePlusStatus } from '@/core/membership/plus-access';

type Row = { id: number; name: string; balance: string; limit: string };

const MAX_ROWS = 6;

export default function CreditStudioScreen() {
  const s = useThemedStyles(styles);
  const [rows, setRows] = useState<Row[]>([{ id: 1, name: 'Card 1', balance: '', limit: '' }]);
  const [nextId, setNextId] = useState(2);
  const { status: plusStatus, loading: tierLoading } = usePlusStatus();
  // The server's FairPath+ status is active/inactive only; it does not yet distinguish Plus from Premium.
  // Until that distinction exists server-side, an active member is treated as Plus, the honest ceiling we can
  // prove today. Premium-only actions (dispute drafting, full analysis) stay locked until Premium is a real signal.
  const tier: TierId = plusStatus.active ? 'plus' : 'free';

  const accounts = useMemo(
    () =>
      rows
        .filter((r) => r.limit.trim() !== '' || r.balance.trim() !== '')
        .map((r) => ({
          name: r.name.trim() || 'Account',
          balanceUsd: Number(r.balance.replace(/[$,]/g, '')) || 0,
          limitUsd: Number(r.limit.replace(/[$,]/g, '')) || 0,
        })),
    [rows],
  );
  const result = useMemo(() => utilization(accounts), [accounts]);

  const update = (id: number, field: 'name' | 'balance' | 'limit', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, { id: nextId, name: `Card ${nextId}`, balance: '', limit: '' }]);
    setNextId((n) => n + 1);
  };

  const disputeAllowed = tierMayUse(tier, 'dispute_letter_draft');

  return (
    <ScreenFrame>
      <PageHeader eyebrow="CREDIT STUDIO" title="Credit Studio" backTo="/explore" />
      <FormScrollView contentContainerStyle={s.content}>
        <View style={s.banner} accessibilityRole="summary">
          <Text style={s.bannerTitle}>Enter your numbers</Text>
          <Text style={s.body}>
            This calculator works from numbers you enter; it does not read your report. To upload and review your actual credit report, with disputes and AI extraction, use Credit Builder.
          </Text>
          <Pressable style={s.secondary} accessibilityRole="link" onPress={() => router.push('/credit' as never)}>
            <Text style={s.secondaryText}>Open Credit Builder</Text>
          </Pressable>
        </View>

        <SectionTitle>Revolving accounts</SectionTitle>
        {rows.map((r) => (
          <View key={r.id} style={s.card}>
            <Text style={s.label} nativeID={`name-${r.id}`}>Account name</Text>
            <TextInput
              style={s.input}
              value={r.name}
              onChangeText={(v) => update(r.id, 'name', v)}
              accessibilityLabel={`Account name, row ${r.id}`}
              accessibilityLabelledBy={`name-${r.id}`}
            />
            <Text style={s.label}>Current balance (USD)</Text>
            <TextInput
              style={s.input}
              value={r.balance}
              onChangeText={(v) => update(r.id, 'balance', v)}
              keyboardType="decimal-pad"
              accessibilityLabel={`Current balance for ${r.name || 'account'}`}
              placeholder="0"
              placeholderTextColor={s.placeholder.color}
            />
            <Text style={s.label}>Credit limit (USD)</Text>
            <TextInput
              style={s.input}
              value={r.limit}
              onChangeText={(v) => update(r.id, 'limit', v)}
              keyboardType="decimal-pad"
              accessibilityLabel={`Credit limit for ${r.name || 'account'}`}
              placeholder="0"
              placeholderTextColor={s.placeholder.color}
            />
          </View>
        ))}
        {rows.length < MAX_ROWS ? (
          <Pressable style={s.secondary} accessibilityRole="button" onPress={addRow}>
            <Text style={s.secondaryText}>Add another account</Text>
          </Pressable>
        ) : null}

        <SectionTitle>Utilization</SectionTitle>
        {result.status === 'no_accounts' ? (
          <Text style={s.body}>Add an account to see utilization.</Text>
        ) : result.status === 'missing_limits' ? (
          <Text style={s.body}>Add a credit limit for {result.accounts.join(', ')} to calculate utilization.</Text>
        ) : (
          <View style={s.card} accessibilityLabel={`Overall utilization ${result.overallPercent} percent, ${utilizationBand(result.overallPercent)}`}>
            <Text style={s.big}>{result.overallPercent}%</Text>
            <Text style={s.body}>
              Overall use of your limits: {utilizationBand(result.overallPercent)}. This describes the numbers you entered. It is not a credit score.
            </Text>
            {result.perAccount.map((a) => (
              <Text key={a.name} style={s.body}>{a.name}: {a.percent}%</Text>
            ))}
            {result.overallPercent >= 30 ? (
              <Text style={s.body}>
                Hypothetical: lowering your total balance by about ${paydownToTarget(
                  accounts.reduce((sum, a) => sum + a.balanceUsd, 0),
                  accounts.reduce((sum, a) => sum + a.limitUsd, 0),
                  30,
                ).toFixed(2)} would bring overall use to 30%. Scores vary, so this is not a prediction.
              </Text>
            ) : null}
          </View>
        )}

        <SectionTitle>AI tools</SectionTitle>
        {tierLoading ? <Text style={s.body} accessibilityLiveRegion="polite">Checking your plan…</Text> : null}
        <View style={s.card}>
          <Text style={s.cardTitle}>Full credit-report analysis</Text>
          <Text style={s.body}>Costs {AI_ACTION_CREDITS.full_credit_report_analysis} AI credits. Premium members get it included, subject to credit balance. Upload your report in Credit Builder to use this.</Text>
        </View>
        <View style={s.card} accessibilityLabel={disputeAllowed ? 'Dispute letter drafting available' : 'Dispute letter drafting is a Premium feature'}>
          <Text style={s.cardTitle}>Dispute letter drafting</Text>
          <Text style={s.body}>
            {disputeAllowed
              ? `Available on your plan. Costs ${AI_ACTION_CREDITS.dispute_letter_draft} AI credits. You review every letter before you send it.`
              : `Premium feature (${TIERS.premium.label}). Drafts are reviewed by you before anything is sent. FairPath does not send disputes for you.`}
          </Text>
        </View>
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  label: { color: t.textSecondary, fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, paddingHorizontal: 12, fontSize: 16 },
  placeholder: { color: t.textMuted },
  big: { color: t.accent, fontSize: 32, fontWeight: '700' as const },
  secondary: { minHeight: 48, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: t.accent },
  secondaryText: { color: t.accent, fontWeight: '700' as const },
});
