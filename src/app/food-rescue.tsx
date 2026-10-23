import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FOOD_RESCUE_BROWSE, FOOD_RESCUE_DONATE } from '@/core/community/food-rescue-nav';

export default function FoodRescueHomeScreen() {
  return (
    <ScreenFrame>
      <PageHeader eyebrow="FOOD RESCUE" title="Free surplus food" backTo="/explore" />
      <ScreenScroll contentContainerStyle={s.content}>
        <View style={s.hero}>
          <Lucide name="utensils" color={C.lime} size={28} />
          <Text style={s.heroTitle}>Good food. Real pickup windows.</Text>
          <Text style={s.heroBody}>
            Food Rescue is its own FairPath experience — browse what is available near you, sorted by what closes soonest.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={s.primary}
          onPress={() => router.push(FOOD_RESCUE_BROWSE as never)}
        >
          <Text style={s.primaryText}>BROWSE AVAILABLE FOOD</Text>
          <Lucide name="arrow-right" color={C.black} size={16} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={s.secondary}
          onPress={() => router.push(FOOD_RESCUE_DONATE as never)}
        >
          <Text style={s.secondaryText}>DONATE SURPLUS FOOD</Text>
        </Pressable>

        <Text style={s.note}>
          Pickup stays private until a claim is approved, with verified pickup codes — the same trust model FairPath uses for free exchanges.
        </Text>
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 48, gap: 14 },
  hero: { gap: 8, paddingVertical: 8 },
  heroTitle: { color: C.white, fontFamily: F.black, fontSize: 24, letterSpacing: -0.5, marginTop: 4 },
  heroBody: { color: C.mutedStrong, fontSize: 13, lineHeight: 20, maxWidth: 420 },
  primary: {
    minHeight: 52,
    backgroundColor: C.lime,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.6 },
  secondary: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryText: { color: C.white, fontFamily: F.extraBold, fontSize: 12 },
  note: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
};
