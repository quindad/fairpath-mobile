import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';

const PILLARS: { label: string; route: string; primary?: boolean }[] = [
  { label: 'I need help', route: '/community/help-now', primary: true },
  { label: 'I want to grow', route: '/community/help-now?q=I+want+to+get+my+GED' },
  { label: 'I can help', route: '/community/can-help' },
];

/** Single Home entry to Opportunity Engine + community exchange (no duplicate Home search bar). */
export function CommunityHelpPanel() {
  return (
    <View style={s.wrap}>
      <Text style={s.eyebrow}>HOW CAN FAIRPATH HELP TODAY?</Text>
      <Text style={s.title}>Help, growth, and giving</Text>
      <View style={s.row}>
        {PILLARS.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            style={[s.chip, a.primary && s.chipPrimary]}
            onPress={() => router.push(a.route as never)}
          >
            <Text style={[s.chipText, a.primary && s.chipTextPrimary]}>{a.label.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="link" onPress={() => router.push('/community' as never)}>
        <Text style={s.more}>COMMUNITY EXCHANGE →</Text>
      </Pressable>
    </View>
  );
}

const s = {
  wrap: { marginTop: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.borderStrong },
  eyebrow: { color: C.lime, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.8 },
  title: { color: C.white, fontFamily: F.extraBold, fontSize: 17, marginTop: 6, marginBottom: 12 },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.borderStrong, justifyContent: 'center' as const },
  chipPrimary: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { color: C.white, fontFamily: F.extraBold, fontSize: 11 },
  chipTextPrimary: { color: C.black },
  more: { color: C.lime, fontFamily: F.extraBold, fontSize: 12, marginTop: 14 },
};
