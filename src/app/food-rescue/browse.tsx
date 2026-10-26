import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FOOD_RESCUE_HOME, foodRescueItemRoute } from '@/core/community/food-rescue-nav';
import { loadMemberSearchLocation } from '@/core/location/member-search-location';
import { browseFoodRescue, toggleFoodRescueSaved, type FoodRescueBrowseRow } from '@/core/food-rescue/food-rescue-service';
import { pickupWindowClosesIn } from '@/core/food-rescue/pickup-window';
import { FOOD_RESCUE_STATUS_LABEL } from '@/core/food-rescue/status';

export default function FoodRescueBrowseScreen() {
  const [location, setLocation] = useState('');
  const [closingSoonOnly, setClosingSoonOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [items, setItems] = useState<FoodRescueBrowseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const locationPrefilled = useRef(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(
        await browseFoodRescue({
          location,
          closingSoonOnly,
          savedOnly,
        }),
      );
    } catch {
      setItems([]);
      setError('Food Rescue could not load. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [location, closingSoonOnly, savedOnly]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        let locStr = location;
        if (!locationPrefilled.current) {
          const shared = await loadMemberSearchLocation().catch(() => null);
          if (shared?.zip) {
            locStr = shared.zip;
            setLocation(shared.zip);
            locationPrefilled.current = true;
          }
        }
        setLoading(true);
        setError('');
        try {
          setItems(
            await browseFoodRescue({
              location: locStr,
              closingSoonOnly,
              savedOnly,
            }),
          );
        } catch {
          setItems([]);
          setError('Food Rescue could not load. Check your connection and try again.');
        } finally {
          setLoading(false);
        }
      })();
    }, [location, closingSoonOnly, savedOnly]),
  );

  async function onToggleSave(item: FoodRescueBrowseRow) {
    try {
      const next = await toggleFoodRescueSaved(item.id, item.saved);
      setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, saved: next } : r)));
    } catch {
      router.push(('/sign-up?returnTo=' + encodeURIComponent('/food-rescue/browse')) as never);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FOOD RESCUE" title="Browse now" backTo={FOOD_RESCUE_HOME} />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Surplus food from neighbors and local businesses — sorted by pickup windows closing soon.</Text>

        <View style={s.searchRow}>
          <Lucide name="map-pin" color={C.mutedStrong} size={15} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            onSubmitEditing={() => void run()}
            style={s.input}
            placeholder="City, state or ZIP"
            placeholderTextColor={C.muted}
          />
          <Pressable accessibilityRole="button" onPress={() => void run()}>
            <Lucide name="search" color={C.lime} size={16} />
          </Pressable>
        </View>

        <View style={s.filters}>
          <Pressable
            accessibilityRole="button"
            style={[s.filterChip, closingSoonOnly && s.filterChipOn]}
            onPress={() => setClosingSoonOnly((v) => !v)}
          >
            <Lucide name="clock" color={closingSoonOnly ? C.black : C.mutedStrong} size={12} />
            <Text style={[s.filterText, closingSoonOnly && s.filterTextOn]}>CLOSING SOON</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.filterChip, savedOnly && s.filterChipOn]}
            onPress={() => setSavedOnly((v) => !v)}
          >
            <Lucide name="bookmark" color={savedOnly ? C.black : C.mutedStrong} size={12} />
            <Text style={[s.filterText, savedOnly && s.filterTextOn]}>SAVED</Text>
          </Pressable>
        </View>

        <View style={s.resultsHead}>
          <Text style={s.results}>{loading ? 'LOADING' : `${items.length} AVAILABLE NOW`}</Text>
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {!loading && !error && items.length === 0 ? (
          <View style={s.empty}>
            <Lucide name="utensils" color={C.mutedStrong} size={26} />
            <Text style={s.emptyTitle}>Nothing listed right now.</Text>
            <Text style={s.emptyBody}>
              {savedOnly
                ? 'Save listings from browse to see them here.'
                : closingSoonOnly
                  ? 'No pickups closing in the next two hours — try turning off Closing soon.'
                  : 'Check back later — donors post surplus food here as it becomes available.'}
            </Text>
          </View>
        ) : null}

        {items.map((item) => {
          const photo = item.marketplace_media?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? '';
          const close = pickupWindowClosesIn(item.pickup_window_end);
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              style={s.card}
              onPress={() => router.push(foodRescueItemRoute(item.id) as never)}
            >
              <View style={s.media}>
                {photo ? (
                  <Image source={{ uri: photo }} style={s.photo} />
                ) : (
                  <View style={s.noPhoto}>
                    <Lucide name="utensils" color={C.mutedStrong} size={22} />
                  </View>
                )}
              </View>
              <View style={s.cardBody}>
                <View style={s.topline}>
                  <Text style={[s.closesText, close.urgent && s.closesUrgent]}>{close.text}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={(e) => {
                      e.stopPropagation?.();
                      void onToggleSave(item);
                    }}
                  >
                    <Lucide
                      name={item.saved ? 'bookmark-check' : 'bookmark'}
                      color={item.saved ? C.lime : C.mutedStrong}
                      size={16}
                    />
                  </Pressable>
                </View>
                <Text style={s.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={s.location}>{item.pickup_area || `${item.city}, ${item.state}`}</Text>
                {item.best_by_note ? <Text style={s.bestBy}>{item.best_by_note}</Text> : null}
                <Text style={s.status}>{FOOD_RESCUE_STATUS_LABEL[item.memberStatus].toUpperCase()}</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={s.safety}>
          <Lucide name="shield" color={C.lime} size={17} />
          <View style={{ flex: 1 }}>
            <Text style={s.safetyTitle}>VERIFIED PICKUP</Text>
            <Text style={s.safetyBody}>
              Exact pickup details stay private until a claim is approved. Pickup is verified with a code so both sides know the handoff happened.
            </Text>
          </View>
        </View>
      </FormScrollView>
    </ScreenFrame>
  );
}

const s = {
  page: { paddingHorizontal: L.mobileGutter, paddingBottom: 40 },
  intro: {
    color: C.mutedStrong,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderStrong,
  },
  searchRow: {
    height: 46,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: '#0A0C0A',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 11,
    marginTop: 14,
  },
  input: { flex: 1, color: C.white, fontSize: 11, paddingVertical: 0 },
  filters: { flexDirection: 'row' as const, gap: 8, marginTop: 10, flexWrap: 'wrap' as const },
  filterChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: C.borderStrong,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  filterChipOn: { backgroundColor: C.lime, borderColor: C.lime },
  filterText: { color: C.mutedStrong, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 0.6 },
  filterTextOn: { color: C.black },
  resultsHead: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10 },
  results: { color: C.white, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  error: { color: C.danger, fontSize: 10, paddingVertical: 12 },
  empty: { paddingVertical: 34, alignItems: 'flex-start' as const },
  emptyTitle: { color: C.white, fontFamily: F.black, fontSize: 19, marginTop: 10 },
  emptyBody: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 5, maxWidth: 320 },
  card: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  media: {
    width: 72,
    height: 72,
    backgroundColor: '#0A0C0A',
    borderWidth: 1,
    borderColor: C.borderStrong,
    overflow: 'hidden' as const,
  },
  photo: { width: '100%' as const, height: '100%' as const },
  noPhoto: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  cardBody: { flex: 1, minWidth: 0 },
  topline: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  closesText: { color: C.lime, fontFamily: F.extraBold, fontSize: 10 },
  closesUrgent: { color: '#FF8A6B' },
  itemTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 13, lineHeight: 16, marginTop: 5 },
  location: { color: C.mutedStrong, fontSize: 9, marginTop: 5 },
  bestBy: { color: C.muted, fontSize: 8, marginTop: 4, fontStyle: 'italic' as const },
  status: { color: C.muted, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 0.7, marginTop: 6 },
  safety: {
    borderWidth: 1,
    borderColor: '#526F2B',
    backgroundColor: '#0F150B',
    padding: 13,
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 18,
  },
  safetyTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 0.9 },
  safetyBody: { color: C.mutedStrong, fontSize: 9, lineHeight: 14, marginTop: 5 },
};
