import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { CAN_HELP_DONATE_GOODS, FOOD_RESCUE_HOME } from '@/core/community/food-rescue-nav';

export default function FoodRescueDonateScreen() {
  return (
    <ScreenFrame>
      <PageHeader eyebrow="FOOD RESCUE" title="Donate surplus food" backTo={FOOD_RESCUE_HOME} />
      <ScreenScroll contentContainerStyle={s.content}>
        <View style={s.panel}>
          <Lucide name="info" color={C.lime} size={20} />
          <Text style={s.panelTitle}>Standalone donor flow coming soon</Text>
          <Text style={s.panelBody}>
            Food Rescue is growing into its own product. For now, list food through FairPath Marketplace and turn on
            {' '}
            <Text style={s.em}>Show in Food Rescue</Text>
            {' '}
            so neighbors see it on the browse screen.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={s.primary}
          onPress={() => router.push(CAN_HELP_DONATE_GOODS as never)}
        >
          <Text style={s.primaryText}>OPEN FOOD LISTING FORM</Text>
        </Pressable>
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 40, gap: 16 },
  panel: {
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: '#0A0C0A',
    padding: 14,
    gap: 8,
  },
  panelTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 15, marginTop: 4 },
  panelBody: { color: C.mutedStrong, fontSize: 13, lineHeight: 20 },
  em: { color: C.lime, fontFamily: F.semiBold },
  primary: {
    minHeight: 48,
    backgroundColor: C.lime,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12 },
};
