import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import {
  recomputeReviewComplete, reviewField, usableValue, type ExtractedField,
} from '@/core/documents/extraction-contract';
import { DEV_REVIEW_FIELDS } from '@/core/documents/review-fixtures';

// Extracted values are proposals. Nothing is treated as verified until the member confirms it here.
export default function DocumentReviewScreen() {
  const s = useThemedStyles(styles);
  const [fields, setFields] = useState<ExtractedField[]>(DEV_REVIEW_FIELDS);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const reviewComplete = recomputeReviewComplete(fields);
  const pending = fields.filter((f) => f.status === 'proposed').length;

  const decide = (key: string, decision: Parameters<typeof reviewField>[1]) =>
    setFields((prev) => prev.map((f) => (f.key === key ? reviewField(f, decision) : f)));

  return (
    <ScreenFrame>
      <PageHeader eyebrow="DOCUMENT REVIEW" title="Review extracted details" backTo="/documents" />
      <FormScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Review before you use it</Text>
          <Text style={s.body}>
            These details were read from your document automatically. They may contain mistakes. Confirm what is correct, correct what is not, and reject anything that does not belong. Nothing is shared until you finish.
          </Text>
          <Text style={s.body} accessibilityLiveRegion="polite">
            {reviewComplete ? 'Review complete.' : `${pending} ${pending === 1 ? 'detail' : 'details'} still to review.`}
          </Text>
        </View>

        {fields.length === 0 ? (
          <Text style={s.body}>No details were found. You can enter them manually later.</Text>
        ) : null}

        {fields.map((f) => {
          const value = usableValue(f);
          return (
            <View key={f.key} style={s.card} accessibilityLabel={`${f.key}: ${f.value}, ${f.status}`}>
              <Text style={s.label}>{f.key.replace(/_/g, ' ')}</Text>
              <Text style={s.value}>{f.correctedValue ?? f.value}</Text>
              <Text style={s.meta}>
                From page {f.sourcePage} · confidence {f.confidence} · {statusLabel(f.status)}
              </Text>
              <Text style={s.snippet}>"{f.sourceSnippet}"</Text>
              {editing === f.key ? (
                <View style={s.row}>
                  <TextInput
                    style={s.input}
                    value={draft}
                    onChangeText={setDraft}
                    accessibilityLabel={`Corrected ${f.key.replace(/_/g, ' ')}`}
                    autoFocus
                  />
                  <Pressable
                    style={s.primary}
                    accessibilityRole="button"
                    accessibilityLabel="Save correction"
                    onPress={() => {
                      if (draft.trim()) decide(f.key, { action: 'correct', value: draft.trim() });
                      setEditing(null);
                    }}
                  >
                    <Text style={s.primaryText}>Save</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={s.row}>
                  <ActionButton label="Confirm" onPress={() => decide(f.key, { action: 'confirm' })} active={f.status === 'confirmed'} />
                  <ActionButton label="Correct" onPress={() => { setDraft(value ?? f.value); setEditing(f.key); }} active={f.status === 'corrected'} />
                  <ActionButton label="Reject" onPress={() => decide(f.key, { action: 'reject' })} active={f.status === 'rejected'} />
                </View>
              )}
            </View>
          );
        })}

        <View style={s.banner}>
          <Text style={s.bannerTitle}>Upload is not connected yet</Text>
          <Text style={s.body}>
            Secure document storage and automatic reading are not connected in this build. The details above are sample data for testing.
          </Text>
        </View>
      </FormScrollView>
    </ScreenFrame>
  );
}

function statusLabel(status: ExtractedField['status']): string {
  switch (status) {
    case 'confirmed': return 'confirmed by you';
    case 'corrected': return 'corrected by you';
    case 'rejected': return 'rejected';
    default: return 'not reviewed yet';
  }
}

function ActionButton({ label, onPress, active }: { label: string; onPress: () => void; active: boolean }) {
  const s = useThemedStyles(styles);
  return (
    <Pressable style={active ? s.primary : s.secondary} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress}>
      <Text style={active ? s.primaryText : s.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  label: { color: t.textSecondary, fontSize: 13, textTransform: 'capitalize' as const },
  value: { color: t.text, fontSize: 17, fontWeight: '700' as const },
  meta: { color: t.textMuted, fontSize: 13 },
  snippet: { color: t.textSecondary, fontSize: 13, fontStyle: 'italic' as const },
  row: { flexDirection: 'row' as const, gap: 8, flexWrap: 'wrap' as const },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, paddingHorizontal: 12, fontSize: 16 },
  primary: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' as const, backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
  secondary: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' as const, borderWidth: 1, borderColor: t.accent },
  secondaryText: { color: t.accent, fontWeight: '700' as const },
});
