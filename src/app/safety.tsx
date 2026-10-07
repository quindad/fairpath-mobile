import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { EMERGENCY_RESOURCES } from '@/core/safety/resources';

// Public, no sign-in required. No account data is read or written on this screen.
export default function SafetyScreen() {
  const s = useThemedStyles(styles);

  const quickExit = () => {
    // Leaves this screen immediately. This does NOT clear browser or device history — the UI says so plainly
    // rather than implying a privacy guarantee it cannot keep.
    router.replace('/' as never);
  };

  return (
    <ScreenFrame showNav={false}>
      <PageHeader eyebrow="SAFETY & RECOVERY" title="You're not alone" onBack={false} />
      <ScrollView contentContainerStyle={s.content}>
        <Pressable style={s.exit} accessibilityRole="button" accessibilityLabel="Quick exit this screen" onPress={quickExit}>
          <Text style={s.exitText}>Quick exit →</Text>
        </Pressable>
        <Text style={s.exitNote}>
          This leaves the screen right away. It does not clear your browser or device history. If you are worried about someone seeing your activity, close the app or browser afterward too.
        </Text>

        <View style={s.banner}>
          <Text style={s.bannerTitle}>If you are in immediate danger, call 911.</Text>
        </View>

        {EMERGENCY_RESOURCES.map((r) => (
          <Pressable
            key={r.id}
            style={s.card}
            accessibilityRole="button"
            accessibilityLabel={`Call ${r.name} at ${r.number}`}
            onPress={() => Linking.openURL(`tel:${r.number}`)}
          >
            <Text style={s.cardTitle}>{r.name}</Text>
            <Text style={s.cardNumber}>{r.number}</Text>
            <Text style={s.body}>{r.availability} · {r.note}</Text>
          </Pressable>
        ))}

        <View style={s.banner}>
          <Text style={s.bannerTitle}>Your privacy here</Text>
          <Text style={s.body}>
            This pathway is planned for a full private experience inside FairPath. What you look at here is never shown to employers, housing providers or donors, and nothing about using this page is shared automatically with anyone.
          </Text>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  exit: { minHeight: 48, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  exitText: { color: t.onAccent, fontWeight: '700' as const, fontSize: 16 },
  exitNote: { color: t.textMuted, fontSize: 13, lineHeight: 18 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 4 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  cardNumber: { color: t.accent, fontWeight: '700' as const, fontSize: 22 },
});
