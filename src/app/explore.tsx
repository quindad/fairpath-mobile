import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  justiceToolsEnabled,
  loadMemberCapabilities,
  veteranToolsEnabled,
  type MemberCapabilities,
} from '@/core/profile/member-capabilities';
import { effectiveExploreStatus } from '@/core/explore/explore-readiness';
import { Lucide } from '@react-native-vector-icons/lucide';
import { CommunityHelpPanel } from '@/components/CommunityHelpPanel';
import { PageHeader, ScreenFrame, ScreenScroll, SectionTitle } from '@/components/ProductChrome';
import { FairPathFonts as F } from '@/constants/fairpath';
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
      { id: 'community', title: 'Community hub', body: 'Need help, offer help, and track exchanges.', icon: 'handshake', route: '/community', status: 'live' },
      { id: 'community-need', title: 'I need help', body: 'Request groceries, essentials, or other permitted items.', icon: 'life-buoy', route: '/community/need-help', status: 'live' },
      { id: 'community-give', title: 'I can help', body: 'Give items or respond to nearby requests.', icon: 'gift', route: '/community/can-help', status: 'in_development' },
    ],
  },
  {
    title: 'Work and housing',
    items: [
      { id: 'jobs', title: 'Jobs', body: 'Fair-chance search and applications.', icon: 'briefcase', route: '/find-jobs', status: 'live' },
      { id: 'housing', title: 'Housing', body: 'Listings, filters, and applications.', icon: 'house', route: '/find-housing', status: 'live' },
      { id: 'opportunities', title: 'Opportunities', body: 'Grants, scholarships, and assistance matched to you.', icon: 'sparkles', route: '/opportunities', status: 'in_development' },
    ],
  },
  {
    title: 'Learn and grow',
    items: [
      { id: 'v1-pathways', title: 'Opportunity pathways', body: 'Ten guided paths for skills, work, health, and more.', icon: 'route', route: '/grow', status: 'in_development' },
      { id: 'academy', title: 'Academy', body: 'Free and affordable courses for your goals.', icon: 'graduation-cap', route: '/academy', status: 'in_development' },
      { id: 'entrepreneurship', title: 'Startup Academy', body: 'Practical steps to start a business.', icon: 'briefcase', route: '/entrepreneurship', status: 'in_development' },
      { id: 'veterans', title: 'Veterans', body: 'Benefits links, translation, and veteran orgs.', icon: 'flag', route: '/veterans', status: 'live' },
      { id: 'food', title: 'Food Rescue', body: 'Free surplus food sorted by pickup time.', icon: 'gift', route: '/food-rescue', status: 'in_development' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'resources', title: 'Resources', body: 'Emergency help and local services.', icon: 'life-buoy', route: '/resources', status: 'live' },
      { id: 'record-relief', title: 'Record Relief', body: 'Relief paths and filing steps for your record.', icon: 'scale', route: '/record-relief', status: 'in_development' },
      { id: 'market', title: 'Free Marketplace', body: 'Claim free goods with your monthly allowance.', icon: 'store', route: '/marketplace', status: 'live' },
      { id: 'signal', title: 'Signal', body: 'Guidance on jobs, housing, credit, and next steps.', icon: 'bot', route: '/fairpath-ai', status: 'in_development' },
      { id: 'plus', title: 'FairPath+', body: 'Extra marketplace claims and Signal credits.', icon: 'crown', route: '/plus', status: 'live' },
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
  const [caps, setCaps] = useState<MemberCapabilities | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMemberCapabilities()
        .then((c) => setCaps(c))
        .catch(() => setCaps(null));
    }, []),
  );

  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.id === 'record-relief' && !justiceToolsEnabled(caps)) return false;
          if (item.id === 'veterans' && !veteranToolsEnabled(caps)) return false;
          return true;
        }),
      })).filter((section) => section.items.length > 0),
    [caps],
  );

  return (
    <ScreenFrame>
      <PageHeader eyebrow="DISCOVER" title="Explore" onBack={false} />
      <ScreenScroll contentContainerStyle={s.content}>
        <Text style={s.lead}>Everything FairPath offers beyond the five tabs — pick a destination.</Text>
        <CommunityHelpPanel />
        {sections.map((section) => (
          <View key={section.title} style={s.section}>
            <SectionTitle>{section.title}</SectionTitle>
            <View style={s.group}>
              {section.items.map((item, index) => {
                const status = effectiveExploreStatus(item.id, item.status);
                const open = item.route !== null && status !== 'planned';
                const last = index === section.items.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole={open ? 'link' : 'text'}
                    accessibilityLabel={`${item.title}. ${status !== 'live' ? STATUS_LABEL[status] + '. ' : ''}${item.body}`}
                    accessibilityState={{ disabled: !open }}
                    disabled={!open}
                    onPress={() => {
                      if (item.route) router.push(item.route as never);
                    }}
                    style={[s.row, !open && s.rowMuted, last && s.rowLast]}
                  >
                    <View style={s.iconWrap}>
                      <Lucide name={item.icon as never} color={tokens.accentText} size={17} />
                    </View>
                    <View style={s.copy}>
                      <Text style={s.rowTitle}>{item.title}</Text>
                      <Text style={s.rowBody} numberOfLines={2}>{item.body}</Text>
                      {status !== 'live' ? <Text style={s.status}>{STATUS_LABEL[status]}</Text> : null}
                    </View>
                    {open ? <Lucide name="chevron-right" color={tokens.textMuted} size={18} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28, gap: 18 },
  lead: { color: t.textSecondary, fontFamily: F.medium, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  section: { gap: 8 },
  group: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  row: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowMuted: { opacity: 0.55 },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.background,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 15, lineHeight: 19 },
  rowBody: { color: t.textSecondary, fontFamily: F.medium, fontSize: 12, lineHeight: 17 },
  status: { color: t.accentText, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.3, marginTop: 2 },
});
