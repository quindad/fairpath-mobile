import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FOOD_RESCUE_BROWSE } from '@/core/community/food-rescue-nav';
import { loadMarketplaceItem, type MarketplaceItem } from '@/core/marketplace/marketplace-service';

export default function FoodRescueItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setItem(await loadMarketplaceItem(id));
    } catch {
      setItem(null);
      setError('This Food Rescue listing could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const photo = item?.marketplace_media?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? '';

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FOOD RESCUE" title="Listing" backTo={FOOD_RESCUE_BROWSE} />
      <ScreenScroll contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Standalone Food Rescue detail in progress</Text>
          <Text style={s.bannerBody}>
            You are in the new Food Rescue experience. Claiming and messaging will live here soon; until then you can
            finish pickup using the proven Marketplace claim flow for this listing.
          </Text>
        </View>

        {loading ? <Text style={s.muted}>Loading…</Text> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {item ? (
          <View style={s.card}>
            {photo ? (
              <Image source={{ uri: photo }} style={s.photo} />
            ) : (
              <View style={s.noPhoto}>
                <Lucide name="utensils" color={C.mutedStrong} size={28} />
              </View>
            )}
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.meta}>{item.pickup_area || `${item.city}, ${item.state}`}</Text>
            {item.best_by_note ? <Text style={s.note}>{item.best_by_note}</Text> : null}
            {item.description ? <Text style={s.body}>{item.description}</Text> : null}
          </View>
        ) : null}

        {item ? (
          <Pressable
            accessibilityRole="button"
            style={s.primary}
            onPress={() => router.push(('/market-item/' + item.id) as never)}
          >
            <Text style={s.primaryText}>CONTINUE TO CLAIM</Text>
          </Pressable>
        ) : null}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 40, gap: 14 },
  banner: {
    borderWidth: 1,
    borderColor: '#526F2B',
    backgroundColor: '#0F150B',
    padding: 12,
    gap: 6,
  },
  bannerTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.4 },
  bannerBody: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
  muted: { color: C.mutedStrong, fontSize: 12 },
  error: { color: C.danger, fontSize: 12 },
  card: { borderWidth: 1, borderColor: C.borderStrong, padding: 12, backgroundColor: '#0A0C0A', gap: 8 },
  photo: { width: '100%' as const, height: 180, backgroundColor: '#050605' },
  noPhoto: { height: 120, alignItems: 'center' as const, justifyContent: 'center' as const },
  title: { color: C.white, fontFamily: F.black, fontSize: 20, marginTop: 4 },
  meta: { color: C.mutedStrong, fontSize: 12 },
  note: { color: C.muted, fontSize: 11, fontStyle: 'italic' as const },
  body: { color: C.white, fontSize: 13, lineHeight: 20, marginTop: 4 },
  primary: {
    minHeight: 48,
    backgroundColor: C.lime,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12 },
};
