import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import {PageHeader, ScreenFrame, SectionTitle, ScreenScroll } from '@/components/ProductChrome';
// ScreenScroll added for iOS scroll above tab bar
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { V1_PATHWAYS } from '@/core/opportunity/v1-pathways';

export default function GrowPathwaysScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const grow = V1_PATHWAYS.filter((p) => p.pillar === 'want_to_grow');
  const help = V1_PATHWAYS.filter((p) => p.pillar === 'need_help');
  const give = V1_PATHWAYS.filter((p) => p.pillar === 'can_help');

  const Section = ({ title, items }: { title: string; items: typeof V1_PATHWAYS }) => (
    <View style={s.section}>
      <SectionTitle>{title}</SectionTitle>
      {items.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.title}. ${p.subtitle}`}
          style={s.card}
          onPress={() => {
            router.push(p.primaryRoute as never);
          }}
        >
          <View style={s.iconWrap}>
            <Lucide name="sparkles" color={tokens.accentText} size={18} />
          </View>
          <View style={s.copy}>
            <Text style={s.cardTitle}>{p.title}</Text>
            <Text style={s.cardBody}>{p.subtitle}</Text>
            <Text style={s.note}>{p.coverageNote}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenFrame>
      <PageHeader eyebrow="I WANT TO GROW" title="Opportunity pathways" onBack />
      <ScreenScroll contentContainerStyle={s.content}>
        <Text style={s.lead}>
          One search engine across Resources, Academy, jobs, and community — real providers only, with honest next steps.
        </Text>
        <Section title="Grow" items={grow} />
        <Section title="Also supports I need help" items={help} />
        <Section title="Also supports I can help" items={give} />
        <Pressable accessibilityRole="button" style={s.helpNow} onPress={() => router.push('/community/help-now' as never)}>
          <Text style={s.helpNowText}>Search everything in Help now</Text>
        </Pressable>
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 20, paddingBottom: 24 },
  lead: { color: t.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  section: { gap: 10 },
  card: {
    flexDirection: 'row' as const,
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center' as const,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: t.accentBorder,
    backgroundColor: t.accentSubtle,
  },
  copy: { flex: 1, gap: 4 },
  cardTitle: { color: t.text, fontSize: 16, fontWeight: '700' as const },
  cardBody: { color: t.textSecondary, fontSize: 13, lineHeight: 18 },
  note: { color: t.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4, fontStyle: 'italic' as const },
  helpNow: {
    marginTop: 8,
    padding: 14,
    backgroundColor: t.accent,
    alignItems: 'center' as const,
  },
  helpNowText: { color: t.onAccent, fontWeight: '700' as const, fontSize: 15 },
});
