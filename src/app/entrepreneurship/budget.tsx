import { Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { ACADEMY_HONESTY_BANNER, ACADEMY_ROUTES } from '@/core/academy/catalog';

export default function AcademyStartupBudgetScreen() {
  const s = useThemedStyles(styles);
  return (
    <ScreenFrame>
      <PageHeader eyebrow="STARTUP ACADEMY" title="Startup budget" backTo={ACADEMY_ROUTES.home} />
      <FormScrollView contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Member-entered numbers only</Text>
          <Text style={s.body}>{ACADEMY_HONESTY_BANNER}</Text>
        </View>
        <Text style={s.body}>
          The interactive budget worksheet (one-time costs, monthly costs, and revenue you enter yourself) ships in the next academy release. FairPath never invents financial figures for you.
        </Text>
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 8 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
});
