import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { FairPathColors as C } from '@/constants/fairpath';

type Destination = {
  id: string;
  title: string;
  body: string;
  icon: string;
  route: string | null;
  status: 'live' | 'in_development' | 'planned';
};

const SECTIONS: { title: string; items: Destination[] }[] = [
  {
    title: 'Work and housing',
    items: [
      { id: 'jobs', title: 'Jobs', body: 'Fair-chance job search and applications.', icon: 'briefcase', route: '/find-jobs', status: 'live' },
      { id: 'housing', title: 'Housing', body: 'Listings, filters and applications.', icon: 'house', route: '/find-housing', status: 'live' },
    ],
  },
  {
    title: 'Learn',
    items: [
      { id: 'academy', title: 'Academy', body: 'Free and affordable courses, matched to your goals.', icon: 'graduation-cap', route: '/academy', status: 'in_development' },
    ],
  },
  {
    title: 'Pathways',
    items: [
      { id: 'veterans', title: 'Veterans', body: 'Transition, careers, housing and benefits navigation.', icon: 'flag', route: '/veterans', status: 'in_development' },
      { id: 'food', title: 'Food & Essentials', body: 'Free and discounted food near you.', icon: 'gift', route: null, status: 'planned' },
      { id: 'giving', title: 'Giving & Community Support', body: 'Verified needs and community support.', icon: 'gift', route: null, status: 'planned' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'resources', title: 'Resources', body: 'Emergency help and local services. Free, no sign-up.', icon: 'life-buoy', route: '/resources', status: 'live' },
      { id: 'record-relief', title: 'Record Relief', body: 'Check possible relief paths and filing steps.', icon: 'scale', route: '/record-relief', status: 'live' },
      { id: 'market', title: 'Free Marketplace', body: 'Free goods, claimed with your monthly allowance.', icon: 'store', route: '/marketplace', status: 'live' },
    ],
  },
];

const STATUS_LABEL: Record<Destination['status'], string> = {
  live: 'Available',
  in_development: 'In development',
  planned: 'Planned, not open',
};

export default function ExploreScreen() {
  const s = useThemedStyles(styles);
  return (
    <ScreenFrame>
      <PageHeader eyebrow="DISCOVER" title="Explore" onBack={false} />
      <View style={s.content}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <SectionTitle>{section.title}</SectionTitle>
            {section.items.map((item) => {
              const open = item.route !== null && item.status !== 'planned';
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole={open ? 'link' : 'text'}
                  accessibilityLabel={`${item.title}. ${STATUS_LABEL[item.status]}. ${item.body}`}
                  accessibilityState={{ disabled: !open }}
                  disabled={!open}
                  onPress={() => {
                    if (item.route) router.push(item.route as never);
                  }}
                  style={[s.card, !open && s.cardMuted]}
                >
                  <View style={s.iconWrap}>
                    <Lucide name={item.icon as never} color={C.lime} size={18} />
                  </View>
                  <View style={s.copy}>
                    <Text style={s.cardTitle}>{item.title}</Text>
                    <Text style={s.cardBody}>{item.body}</Text>
                    <Text style={s.status}>{STATUS_LABEL[item.status]}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 20, paddingBottom: 120 },
  section: { gap: 10 },
  card: { flexDirection: 'row' as const, gap: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, alignItems: 'center' as const },
  cardMuted: { opacity: 0.6 },
  iconWrap: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: t.accent },
  copy: { flex: 1, gap: 2 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  cardBody: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  status: { color: t.accent, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.4, marginTop: 2 },
});
