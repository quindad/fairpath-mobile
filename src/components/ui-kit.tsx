import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { FairPathFonts as F } from '@/constants/fairpath';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

/** Shared themed primitives for forms and lists (semantic tokens only; sharp corners). */

export function Field({ label, value, onChangeText, placeholder, error, hint, multiline, keyboardType, maxLength, optional, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; error?: string; hint?: string;
  multiline?: boolean; keyboardType?: KeyboardTypeOptions; maxLength?: number; optional?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  return (
    <View style={s.fieldWrap}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {optional ? <Text style={s.tag}>OPTIONAL</Text> : null}
      </View>
      <TextInput
        style={[s.input, multiline && s.multiline, error ? s.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        accessibilityLabel={label}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ChipGroup({ label, options, selected, onChange, single, hint }: {
  label?: string; options: { value: string; label: string }[]; selected: string[]; onChange: (next: string[]) => void; single?: boolean; hint?: string;
}) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.chips}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={{ selected: on, checked: on }}
              style={[s.chip, on && s.chipOn]}
              onPress={() => onChange(single ? (on ? [] : [o.value]) : on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const off = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }} disabled={off} style={[s.primary, off && s.primaryOff]} onPress={onPress}>
      {busy ? <ActivityIndicator color={tokens.onAccent} /> : <Text style={s.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, tone }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'danger' }) {
  const s = useThemedStyles(styles);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} style={[s.secondary, tone === 'danger' && s.secondaryDanger, disabled && s.primaryOff]} onPress={onPress}>
      <Text style={[s.secondaryText, tone === 'danger' && s.secondaryTextDanger]}>{label}</Text>
    </Pressable>
  );
}

export function Panel({ children, tone }: { children: React.ReactNode; tone?: 'accent' | 'warning' }) {
  const s = useThemedStyles(styles);
  return <View style={[s.panel, tone === 'accent' && s.panelAccent, tone === 'warning' && s.panelWarning]}>{children}</View>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export function StatusLine({ tone, children }: { tone: 'error' | 'success' | 'warning' | 'muted'; children: React.ReactNode }) {
  const s = useThemedStyles(styles);
  return <Text style={[s.status, tone === 'error' && s.statusError, tone === 'success' && s.statusSuccess, tone === 'warning' && s.statusWarning, tone === 'muted' && s.statusMuted]}>{children}</Text>;
}

export function ListRow({ title, body, meta, onPress, trailing }: { title: string; body?: string; meta?: string; onPress?: () => void; trailing?: React.ReactNode }) {
  const s = useThemedStyles(styles);
  const inner = (
    <>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{title}</Text>
        {body ? <Text style={s.rowBody}>{body}</Text> : null}
        {meta ? <Text style={s.rowMeta}>{meta}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Text style={s.rowArrow}>→</Text> : null)}
    </>
  );
  return onPress ? <Pressable accessibilityRole="button" style={s.row} onPress={onPress}>{inner}</Pressable> : <View style={s.row}>{inner}</View>;
}

const styles = (t: ThemeTokens) => StyleSheet.create({
  fieldWrap: { marginTop: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.2, marginBottom: 6 },
  tag: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 0.8 },
  input: { minHeight: 46, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, fontFamily: F.medium, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  inputError: { borderColor: t.error },
  error: { color: t.error, fontSize: 12, lineHeight: 17, marginTop: 5 },
  hint: { color: t.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: t.inverse, borderColor: t.inverse },
  chipText: { color: t.textSecondary, fontFamily: F.bold, fontSize: 12 },
  chipTextOn: { color: t.onInverse },
  primary: { height: 48, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryOff: { opacity: 0.5 },
  primaryText: { color: t.onAccent, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  secondary: { height: 46, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryDanger: { borderColor: t.error },
  secondaryText: { color: t.text, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1 },
  secondaryTextDanger: { color: t.error },
  panel: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, marginTop: 12 },
  panelAccent: { borderColor: t.accentBorder, backgroundColor: t.accentSubtle },
  panelWarning: { borderColor: t.warning },
  empty: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 16, marginTop: 12 },
  emptyTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 16 },
  emptyBody: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  status: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  statusError: { color: t.error },
  statusSuccess: { color: t.success },
  statusWarning: { color: t.warning },
  statusMuted: { color: t.textMuted },
  row: { minHeight: 64, borderBottomWidth: 1, borderBottomColor: t.border, flexDirection: 'row', alignItems: 'center' },
  rowCopy: { flex: 1, paddingRight: 12, paddingVertical: 10 },
  rowTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 15 },
  rowBody: { color: t.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowMeta: { color: t.textMuted, fontSize: 11, marginTop: 3 },
  rowArrow: { color: t.accentText, fontSize: 18 },
});

export function BodyText({ children, muted, strong }: { children: React.ReactNode; muted?: boolean; strong?: boolean }) {
  const s = useThemedStyles(styles2);
  return <Text style={[s.body, muted && s.muted, strong && s.strong]}>{children}</Text>;
}

export function TextButton({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'danger' }) {
  const s = useThemedStyles(styles2);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={s.textBtn}>
      <Text style={[s.textBtnText, tone === 'danger' && s.textBtnDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles2 = (t: ThemeTokens) => StyleSheet.create({
  body: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
  muted: { color: t.textMuted, fontSize: 12, lineHeight: 17 },
  strong: { color: t.text, fontFamily: F.bold },
  textBtn: { paddingVertical: 8, paddingHorizontal: 6 },
  textBtnText: { color: t.accentText, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1 },
  textBtnDanger: { color: t.error },
});
