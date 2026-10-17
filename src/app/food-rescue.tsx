import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { MarketplaceItem, isMarketplaceItemSaved, loadMarketplace, saveMarketplaceItem, unsaveMarketplaceItem } from '@/core/marketplace/marketplace-service';

function closesIn(iso: string | null): { text: string; urgent: boolean; closed: boolean } {
  if (!iso) return { text: 'No pickup window listed', urgent: false, closed: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: 'Pickup window ended', urgent: false, closed: true };
  const mins = Math.round(ms / 60000);
  if (mins < 60) return { text: `Closes in ${mins} min`, urgent: true, closed: false };
  const hrs = Math.floor(mins / 60);
  return { text: `Closes in ${hrs}h ${mins % 60}m`, urgent: hrs < 2, closed: false };
}

export default function FoodRescueScreen() {
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await loadMarketplace({ location, foodRescueOnly: true });
      setItems(rows.filter((r) => !closesIn(r.pickup_window_end).closed));
      const checks = await Promise.all(rows.map((r) => isMarketplaceItemSaved(r.id).catch(() => false)));
      setSaved(Object.fromEntries(rows.map((r, i) => [r.id, checks[i]])));
    } catch {
      setItems([]);
      setError('Food Rescue could not load. Check your connection and try again.');
    } finally { setLoading(false); }
  }, [location]);

  useFocusEffect(useCallback(() => { void run(); }, [run]));

  async function toggleSave(item: MarketplaceItem) {
    const current = Boolean(saved[item.id]);
    try {
      if (current) await unsaveMarketplaceItem(item.id); else await saveMarketplaceItem(item.id);
      setSaved((v) => ({ ...v, [item.id]: !current }));
    } catch { router.push(('/sign-up?returnTo=' + encodeURIComponent('/food-rescue')) as never); }
  }

  return <ScreenFrame>
    <PageHeader eyebrow="FAIRPATH" title="Food Rescue" backTo="/marketplace" />
    <FormScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
      <View style={s.hero}>
        <Text style={s.heroTitle}>Good food. Going to waste. Go get it.</Text>
        <Text style={s.heroBody}>Real surplus food from local businesses and neighbors, free, with a real pickup window today. Sorted by what's closing soonest.</Text>
      </View>

      <View style={s.searchRow}>
        <Lucide name="map-pin" color={C.mutedStrong} size={15} />
        <TextInput value={location} onChangeText={setLocation} onSubmitEditing={() => void run()} style={s.input} placeholder="City, state or ZIP" placeholderTextColor={C.muted} />
        <Pressable accessibilityRole="button" onPress={() => void run()}><Lucide name="search" color={C.lime} size={16} /></Pressable>
      </View>

      <View style={s.resultsHead}><Text style={s.results}>{loading ? 'LOADING' : items.length + ' AVAILABLE NOW'}</Text></View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {!loading && !error && items.length === 0 ? (
        <View style={s.empty}>
          <Lucide name="utensils" color={C.mutedStrong} size={26} />
          <Text style={s.emptyTitle}>Nothing listed right now.</Text>
          <Text style={s.emptyBody}>Check back later — local businesses post surplus food here as it becomes available.</Text>
        </View>
      ) : null}

      {items.map((item) => {
        const photo = item.marketplace_media?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? '';
        const close = closesIn(item.pickup_window_end);
        return (
          <Pressable accessibilityRole="button" key={item.id} style={s.card} onPress={() => router.push(('/market-item/' + item.id) as never)}>
            <View style={s.media}>
              {photo ? <Image source={{ uri: photo }} style={s.photo} /> : <View style={s.noPhoto}><Lucide name="utensils" color={C.mutedStrong} size={22} /></View>}
            </View>
            <View style={s.cardBody}>
              <View style={s.topline}>
                <Text style={[s.closesText, close.urgent && s.closesUrgent]}>{close.text}</Text>
                <Pressable accessibilityRole="button" onPress={(e) => { e.stopPropagation?.(); void toggleSave(item); }}>
                  <Lucide name={saved[item.id] ? 'bookmark-check' : 'bookmark'} color={saved[item.id] ? C.lime : C.mutedStrong} size={16} />
                </Pressable>
              </View>
              <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={s.location}>{item.pickup_area || item.city + ', ' + item.state}</Text>
              {item.best_by_note ? <Text style={s.bestBy}>{item.best_by_note}</Text> : null}
            </View>
          </Pressable>
        );
      })}

      <View style={s.safety}>
        <Lucide name="shield" color={C.lime} size={17} />
        <View style={{ flex: 1 }}><Text style={s.safetyTitle}>SAME SAFETY AS MARKETPLACE</Text><Text style={s.safetyBody}>Exact pickup details stay private until a claim is approved, and pickup is verified with a code — same proven system as the rest of FairPath Marketplace.</Text></View>
      </View>
    </FormScrollView>
  </ScreenFrame>;
}

const s = {
  page: { paddingHorizontal: L.mobileGutter, paddingBottom: 40 },
  hero: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.borderStrong },
  heroTitle: { color: C.white, fontFamily: F.black, fontSize: 24, letterSpacing: -0.6 },
  heroBody: { color: C.mutedStrong, fontSize: 10, lineHeight: 16, marginTop: 7, maxWidth: 520 },
  searchRow: { height: 46, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: '#0A0C0A', flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 11, marginTop: 14 },
  input: { flex: 1, color: C.white, fontSize: 11, paddingVertical: 0 },
  resultsHead: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10 },
  results: { color: C.white, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  error: { color: C.danger, fontSize: 10, paddingVertical: 12 },
  empty: { paddingVertical: 34, alignItems: 'flex-start' as const },
  emptyTitle: { color: C.white, fontFamily: F.black, fontSize: 19, marginTop: 10 },
  emptyBody: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 5, maxWidth: 320 },
  card: { flexDirection: 'row' as const, gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  media: { width: 72, height: 72, backgroundColor: '#0A0C0A', borderWidth: 1, borderColor: C.borderStrong, overflow: 'hidden' as const },
  photo: { width: '100%' as const, height: '100%' as const },
  noPhoto: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  cardBody: { flex: 1, minWidth: 0 },
  topline: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 8 },
  closesText: { color: C.lime, fontFamily: F.extraBold, fontSize: 10 },
  closesUrgent: { color: '#FF8A6B' },
  itemTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 13, lineHeight: 16, marginTop: 5 },
  location: { color: C.mutedStrong, fontSize: 9, marginTop: 5 },
  bestBy: { color: C.muted, fontSize: 8, marginTop: 4, fontStyle: 'italic' as const },
  safety: { borderWidth: 1, borderColor: '#526F2B', backgroundColor: '#0F150B', padding: 13, flexDirection: 'row' as const, gap: 10, marginTop: 18 },
  safetyTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 0.9 },
  safetyBody: { color: C.mutedStrong, fontSize: 9, lineHeight: 14, marginTop: 5 },
};
