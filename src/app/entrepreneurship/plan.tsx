import { Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { ACADEMY_HONESTY_BANNER, ACADEMY_ROUTES } from '@/core/academy/catalog';
import { PLAN_DISCLAIMER } from '@/core/entrepreneurship/business-plan';

export default function AcademyBusinessPlanScreen() {
  const s = useThemedStyles(styles);
  return (
    <ScreenFrame>
      <PageHeader eyebrow="STARTUP ACADEMY" title="Business plan" backTo={ACADEMY_ROUTES.home} />
      <FormScrollView contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Your words, your business</Text>
          <Text style={s.body}>{ACADEMY_HONESTY_BANNER}</Text>
          <Text style={s.body}>{PLAN_DISCLAIMER}</Text>
        </View>
        <Text style={s.body}>
          The section-by-section editor autosaves on this device in a later academy release. You can still work through lessons and use Signal on the academy home while this screen is being wired up.
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
