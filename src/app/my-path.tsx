import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

const PLANNED = [
  'Applications and interviews across jobs and housing',
  'Academy courses and progress',
  'Referrals and case-manager tasks, with consent',
  'Documents and milestones',
  'Entrepreneurship milestones',
  'Food Rescue and Marketplace activity',
];

export default function MyPathScreen() {
  const s = useThemedStyles(styles);
  return (
    <ScreenFrame>
      <PageHeader eyebrow="MY PATH" title="My Path" onBack={false} />
      <View style={s.content}>
        <View style={s.banner} accessibilityRole="summary">
          <Text style={s.bannerTitle}>My Path is in development</Text>
          <Text style={s.body}>
            Your plan will bring together applications, learning, referrals and tasks in one place. You will own your plan. AI can suggest steps, but it will not change official records without your confirmation.
          </Text>
        </View>
        <SectionTitle>Coming to My Path</SectionTitle>
        {PLANNED.map((item) => (
          <Text key={item} style={s.item}>• {item}</Text>
        ))}
        <Pressable style={s.button} accessibilityRole="button" onPress={() => router.push('/explore' as never)}>
          <Text style={s.buttonText}>Explore opportunities</Text>
        </Pressable>
      </View>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  item: { color: t.text, fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent, marginTop: 8 },
  buttonText: { color: t.onAccent, fontWeight: '700' as const },
});
