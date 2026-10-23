import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

const LINKS = [
  { title: 'Marketplace claims', body: 'Track pickup status and messages for items you claimed.', route: '/marketplace-claims' },
  { title: 'My listings', body: 'Manage free items you are offering.', route: '/marketplace-my-listings' },
  { title: 'My community requests', body: 'Requests you posted for essentials and help.', route: '/community/need-help' },
  { title: 'Saved resources', body: 'Services and programs you bookmarked.', route: '/saved-resources' },
];

export default function MyExchangesScreen() {
  return (
    <ScreenFrame>
      <PageHeader eyebrow="MY EXCHANGES" title="Community activity" backTo="/community" />
      <ScreenScroll contentContainerStyle={s.content}>
        {LINKS.map((l) => (
          <Pressable key={l.route} style={s.card} onPress={() => router.push(l.route as never)}>
            <Text style={s.title}>{l.title}</Text>
            <Text style={s.body}>{l.body}</Text>
          </Pressable>
        ))}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, gap: 10, paddingBottom: 40 },
  card: { borderWidth: 1, borderColor: C.borderStrong, padding: 14, backgroundColor: '#0A0C0A' },
  title: { color: C.white, fontFamily: F.extraBold, fontSize: 13 },
  body: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, marginTop: 4 },
};
