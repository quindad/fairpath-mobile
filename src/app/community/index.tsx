import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

const ACTIONS = [
  { id: 'engine', title: 'Help now', body: 'Tell us what you need — we search local options.', icon: 'sparkles', route: '/community/help-now' },
  { id: 'need', title: 'I need help', body: 'Post a request for essentials.', icon: 'life-buoy', route: '/community/need-help' },
  { id: 'give', title: 'I can help', body: 'Respond to requests or list free items.', icon: 'gift', route: '/community/can-help' },
  { id: 'resources', title: 'Find resources', body: 'Food, transit, benefits, and services.', icon: 'map-pin', route: '/resources' },
  { id: 'exchanges', title: 'My exchanges', body: 'Your requests and marketplace activity.', icon: 'repeat', route: '/community/exchanges' },
] as const;

export default function CommunityHubScreen() {
  return (
    <ScreenFrame>
      <PageHeader eyebrow="Community" title="Get help or lend a hand" backTo="/explore" />
      <View style={s.content}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="link"
            style={s.card}
            onPress={() => router.push(a.route as never)}
          >
            <View style={s.iconWrap}>
              <Lucide name={a.icon as never} color={C.lime} size={20} />
            </View>
            <View style={s.copy}>
              <Text style={s.title}>{a.title}</Text>
              <Text style={s.body}>{a.body}</Text>
            </View>
            <Lucide name="chevron-right" color={C.mutedStrong} size={18} />
          </Pressable>
        ))}
        <Text style={s.note}>
          You do not need to share a criminal record or proof of hardship to use resources or ask for help.
        </Text>
      </View>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 48, gap: 10 },
  card: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: '#0A0C0A',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  copy: { flex: 1, minWidth: 0, paddingRight: 8 },
  title: { color: C.white, fontFamily: F.extraBold, fontSize: 16 },
  body: { color: C.mutedStrong, fontSize: 13, lineHeight: 19, marginTop: 4 },
  note: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, marginTop: 8 },
};
