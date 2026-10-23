import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, ScreenScroll, SectionTitle } from '@/components/ProductChrome';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

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
    title: 'Community exchange',
    items: [
      { id: 'community', title: 'FairPath Exchange', body: 'I need help, I can help, resources, and your exchanges — practical community infrastructure.', icon: 'handshake', route: '/community', status: 'live' },
      { id: 'community-need', title: 'I need help', body: 'Request groceries, essentials, or other permitted necessities without public hardship proof.', icon: 'life-buoy', route: '/community/need-help', status: 'live' },
      { id: 'community-give', title: 'I can help', body: 'Give free items and respond to nearby community requests.', icon: 'gift', route: '/community/can-help', status: 'live' },
    ],
  },
  {
    title: 'Work and housing',
    items: [
      { id: 'jobs', title: 'Jobs', body: 'Fair-chance job search and applications.', icon: 'briefcase', route: '/find-jobs', status: 'live' },
      { id: 'housing', title: 'Housing', body: 'Listings, filters and applications.', icon: 'house', route: '/find-housing', status: 'live' },
      { id: 'opportunities', title: 'Opportunities', body: 'Grants, scholarships and financial assistance matched to you.', icon: 'sparkles', route: '/opportunities', status: 'live' },
    ],
  },
  {
    title: 'Learn & grow',
    items: [
      { id: 'v1-pathways', title: 'V1 opportunity pathways', body: 'Ten approved paths — skills, business, education, family, benefits, health, mentorship, transport, volunteering, and drives.', icon: 'route', route: '/grow', status: 'live' },
      { id: 'academy', title: 'Academy', body: 'Free and affordable courses, matched to your goals.', icon: 'graduation-cap', route: '/academy', status: 'live' },
      { id: 'entrepreneurship', title: 'Startup Academy', body: '15 practical steps to start a business, open to everyone.', icon: 'briefcase', route: '/entrepreneurship', status: 'live' },
    ],
  },
  {
    title: 'Pathways',
    items: [
      { id: 'veterans', title: 'Veterans', body: 'Occupation translation, VA benefits links and veteran community organizations.', icon: 'flag', route: '/veterans', status: 'live' },
      { id: 'food', title: 'Food Rescue', body: 'Free surplus food nearby, sorted by pickup time.', icon: 'gift', route: '/food-rescue', status: 'live' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'resources', title: 'Resources', body: 'Emergency help and local services. Free, no sign-up.', icon: 'life-buoy', route: '/resources', status: 'live' },
      { id: 'record-relief', title: 'Record Relief', body: 'Check possible relief paths and filing steps.', icon: 'scale', route: '/record-relief', status: 'live' },
      { id: 'market', title: 'Free Marketplace', body: 'Free goods, claimed with your monthly allowance.', icon: 'store', route: '/marketplace', status: 'live' },
      { id: 'signal', title: 'Signal', body: 'Assistant plus optional AI help on jobs, housing, credit, and next steps.', icon: 'bot', route: '/fairpath-ai', status: 'live' },
      { id: 'plus', title: 'FairPath+', body: 'More Marketplace claims and member Signal credits. Core tools stay free.', icon: 'crown', route: '/plus', status: 'live' },
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
  const { tokens } = useFairPathTheme();
  return (
    <ScreenFrame>
      <PageHeader eyebrow="DISCOVER" title="Explore" onBack={false} />
      <ScreenScroll contentContainerStyle={s.content}>
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
                    <Lucide name={item.icon as never} color={tokens.accentText} size={18} />
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
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 20, paddingBottom: 24 },
  section: { gap: 10 },
  card: { flexDirection: 'row' as const, gap: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, alignItems: 'center' as const },
  cardMuted: { opacity: 0.6 },
  iconWrap: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentSubtle },
  copy: { flex: 1, gap: 2 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  cardBody: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  status: { color: t.accentText, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.4, marginTop: 2 },
});
