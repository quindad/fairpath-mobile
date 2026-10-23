import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
  CAN_HELP_DONATE_GOODS,
  CAN_HELP_OPEN_REQUESTS,
  CAN_HELP_VOLUNTEER,
  FOOD_RESCUE_DONATE,
} from '@/core/community/food-rescue-nav';

const ACTIONS = [
  {
    id: 'respond',
    title: 'Respond to requests',
    body: 'See open community asks nearby and offer help.',
    icon: 'life-buoy',
    route: CAN_HELP_OPEN_REQUESTS,
  },
  {
    id: 'goods',
    title: 'Donate goods',
    body: 'List free household items, clothes, and gear on Marketplace.',
    icon: 'package',
    route: CAN_HELP_DONATE_GOODS,
  },
  {
    id: 'food',
    title: 'Donate food',
    body: 'Share surplus food with a real pickup window today.',
    icon: 'utensils',
    route: FOOD_RESCUE_DONATE,
  },
  {
    id: 'volunteer',
    title: 'Volunteer & drives',
    body: 'Community hub, coordination, and local drives.',
    icon: 'users',
    route: CAN_HELP_VOLUNTEER,
  },
] as const;

export default function CanHelpScreen() {
  return (
    <ScreenFrame>
      <PageHeader eyebrow="I CAN HELP" title="Choose how to help" backTo="/community" />
      <ScreenScroll contentContainerStyle={s.content}>
        <Text style={s.lead}>Pick one path — you can switch anytime from Community.</Text>
        <View style={s.group}>
          {ACTIONS.map((a, index) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              style={[s.row, index === ACTIONS.length - 1 && s.rowLast]}
              onPress={() => router.push(a.route as never)}
            >
              <View style={s.iconWrap}>
                <Lucide name={a.icon as never} color={C.lime} size={18} />
              </View>
              <View style={s.copy}>
                <Text style={s.title}>{a.title}</Text>
                <Text style={s.body} numberOfLines={2}>{a.body}</Text>
              </View>
              <Lucide name="chevron-right" color={C.mutedStrong} size={18} />
            </Pressable>
          ))}
        </View>
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 48, gap: 12 },
  lead: { color: C.mutedStrong, fontSize: 13, lineHeight: 19 },
  group: { borderWidth: 1, borderColor: C.borderStrong, backgroundColor: '#0A0C0A' },
  row: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: C.borderStrong,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
  },
  copy: { flex: 1, minWidth: 0, paddingRight: 8 },
  title: { color: C.white, fontFamily: F.extraBold, fontSize: 16 },
  body: { color: C.mutedStrong, fontSize: 13, lineHeight: 19, marginTop: 4 },
};
