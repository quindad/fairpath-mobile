import { ScrollView, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { InlineBadge, PageHeader, ScreenFrame, SectionTitle, SharpChip } from '@/components/ProductChrome';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { AppearanceMode, ThemeTokens } from '@/core/theme/tokens';

const OPTIONS: { mode: AppearanceMode; label: string; body: string }[] = [
  { mode: 'dark', label: 'Dark', body: 'The FairPath default.' },
  { mode: 'light', label: 'Light', body: 'Bright surfaces for daytime use.' },
  { mode: 'system', label: 'System', body: 'Follow your phone’s setting.' },
];

export default function Screen() {
  const s = useThemedStyles(styles);
  const { mode, setMode, tokens } = useFairPathTheme();
  return (
    <ScreenFrame>
      <PageHeader eyebrow="YOUR ACCOUNT" title="Appearance" backTo="/me" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.intro}>Choose how FairPath looks. Some screens are still being updated and stay dark until they are.</Text>
        <SectionTitle>MODE</SectionTitle>
        <View style={s.list}>
          {OPTIONS.map((o) => {
            const selected = mode === o.mode;
            return (
              <Pressable key={o.mode} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setMode(o.mode)} style={[s.option, selected && s.optionSelected]}>
                <View style={s.copy}>
                  <Text style={s.optionTitle}>{o.label}</Text>
                  <Text style={s.optionBody}>{o.body}</Text>
                </View>
                <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.previewHead}><SectionTitle>PREVIEW · {tokens.scheme.toUpperCase()}</SectionTitle></View>
        <View style={s.preview}>
          <View style={s.previewRow}>
            <InlineBadge tone="lime">VERIFIED</InlineBadge>
            <InlineBadge>FREE</InlineBadge>
          </View>
          <Text style={s.previewTitle}>Sample resource title</Text>
          <Text style={s.previewBody}>Body copy sits on the surface color with strong contrast in both modes.</Text>
          <Text style={s.previewMuted}>Muted detail text · Updated recently</Text>
          <View style={s.chips}>
            <SharpChip label="Selected" active />
            <SharpChip label="Option" />
          </View>
          <View style={s.cta}><Text style={s.ctaText}>PRIMARY ACTION</Text></View>
          <View style={s.statusRow}>
            <Text style={[s.status, { color: tokens.success }]}>Success</Text>
            <Text style={[s.status, { color: tokens.warning }]}>Warning</Text>
            <Text style={[s.status, { color: tokens.error }]}>Error</Text>
            <Text style={[s.status, { color: tokens.info }]}>Info</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 28 },
  intro: { color: t.textSecondary, fontSize: 14, lineHeight: 21, paddingVertical: 18 },
  list: { marginBottom: 8 },
  option: { minHeight: 68, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, marginBottom: 8 },
  optionSelected: { borderColor: t.accentBorder, backgroundColor: t.accentSubtle },
  copy: { flex: 1, paddingRight: 12 },
  optionTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 16 },
  optionBody: { color: t.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  radio: { width: 20, height: 20, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const },
  radioOn: { borderColor: t.accentText },
  radioDot: { width: 10, height: 10, backgroundColor: t.accent },
  previewHead: { marginTop: 18 },
  preview: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 16 },
  previewRow: { flexDirection: 'row' as const, gap: 6, marginBottom: 12 },
  previewTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 18 },
  previewBody: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  previewMuted: { color: t.textMuted, fontSize: 11, marginTop: 8 },
  chips: { flexDirection: 'row' as const, gap: 7, marginTop: 14 },
  cta: { height: 46, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 16 },
  ctaText: { color: t.onAccent, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  statusRow: { flexDirection: 'row' as const, gap: 14, marginTop: 14 },
  status: { fontFamily: F.bold, fontSize: 12 },
});
