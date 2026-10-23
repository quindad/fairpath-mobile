import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { InlineBadge, PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FOOD_RESCUE_BROWSE, foodRescueClaimRoute } from '@/core/community/food-rescue-nav';
import { foodRescueErrorMessage } from '@/core/food-rescue/errors';
import {
  loadFoodRescueItemDetail,
  reserveFoodRescueListing,
  toggleFoodRescueSaved,
} from '@/core/food-rescue/food-rescue-service';
import { formatPickupWindowRange } from '@/core/food-rescue/pickup-window';
import { FOOD_RESCUE_STATUS_LABEL, type FoodRescueStatus } from '@/core/food-rescue/status';
import type { MarketplaceItem } from '@/core/marketplace/marketplace-service';
import { notify } from '@/core/ui/notify';

export default function FoodRescueItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [memberStatus, setMemberStatus] = useState<FoodRescueStatus>('available');
  const [saved, setSaved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [blockedReserve, setBlockedReserve] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setBlockedReserve(false);
    try {
      const detail = await loadFoodRescueItemDetail(id);
      setItem(detail.item);
      setMemberStatus(detail.memberStatus);
      setSaved(detail.viewer.saved);
      setIsOwner(detail.viewer.isOwner);
      setClaimId(detail.viewer.claim?.id ?? null);
      setClaimStatus(detail.viewer.claim?.status ?? null);
    } catch (e) {
      setItem(null);
      if (e instanceof Error && e.message === 'NOT_FOOD_RESCUE') {
        setError('This listing is not part of Food Rescue.');
      } else {
        setError('This Food Rescue listing could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onToggleSave() {
    if (!item) return;
    try {
      setSaved(await toggleFoodRescueSaved(item.id, saved));
    } catch {
      router.push(('/sign-up?returnTo=' + encodeURIComponent('/food-rescue/item/' + item.id)) as never);
    }
  }

  async function onReserve() {
    if (!item || claiming) return;
    setClaiming(true);
    try {
      const created = await reserveFoodRescueListing(item.id);
      setClaimId(created.id);
      setClaimStatus(created.status);
      setMemberStatus('reserved');
      notify(
        'Claim requested',
        'Your request is anonymous until the donor selects you. If approved, private pickup details and your code unlock in My claim.',
        [{ text: 'Open claim', onPress: () => router.push(foodRescueClaimRoute(created.id) as never) }],
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : 'UNKNOWN';
      if (code === 'SIGNED_OUT') {
        router.push(('/sign-up?returnTo=' + encodeURIComponent('/food-rescue/item/' + item.id)) as never);
        return;
      }
      if (code === 'RESERVE_RPC_BLOCKED') setBlockedReserve(true);
      const msg = foodRescueErrorMessage(code);
      notify(msg.title, msg.body);
    } finally {
      setClaiming(false);
    }
  }

  const photo = item?.marketplace_media?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? '';
  const canRequest =
    item &&
    !isOwner &&
    !claimId &&
    memberStatus === 'available' &&
    item.status === 'available' &&
    !blockedReserve;

  return (
    <ScreenFrame>
      <PageHeader
        eyebrow="FOOD RESCUE"
        title="Listing"
        backTo={FOOD_RESCUE_BROWSE}
        trailing={
          item && !isOwner ? (
            <Pressable accessibilityRole="button" onPress={() => void onToggleSave()}>
              <Lucide name={saved ? 'bookmark-check' : 'bookmark'} color={saved ? C.lime : C.white} size={18} />
            </Pressable>
          ) : undefined
        }
      />
      <ScreenScroll contentContainerStyle={s.content}>
        {loading ? <Text style={s.muted}>Loading…</Text> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {item ? (
          <>
            <View style={s.badges}>
              <InlineBadge tone="lime">FREE</InlineBadge>
              <InlineBadge tone="lime">FOOD RESCUE</InlineBadge>
              <InlineBadge>{FOOD_RESCUE_STATUS_LABEL[memberStatus].toUpperCase()}</InlineBadge>
            </View>

            {photo ? (
              <Image source={{ uri: photo }} style={s.photo} />
            ) : (
              <View style={s.noPhoto}>
                <Lucide name="utensils" color={C.mutedStrong} size={28} />
              </View>
            )}

            <Text style={s.title}>{item.title}</Text>
            <Text style={s.meta}>
              {[item.quantity > 1 ? `Qty ${item.quantity}` : null, item.pickup_area || `${item.city}, ${item.state}`]
                .filter(Boolean)
                .join(' · ')}
            </Text>

            <View style={s.section}>
              <Text style={s.sectionLabel}>PICKUP WINDOW TODAY</Text>
              <Text style={s.sectionBody}>{formatPickupWindowRange(item.pickup_window_start, item.pickup_window_end)}</Text>
              {item.best_by_note ? <Text style={s.note}>{item.best_by_note}</Text> : null}
            </View>

            {item.description ? (
              <View style={s.section}>
                <Text style={s.sectionLabel}>ABOUT THIS FOOD</Text>
                <Text style={s.body}>{item.description}</Text>
              </View>
            ) : null}

            <View style={s.privacy}>
              <Lucide name="eye-off" color={C.lime} size={16} />
              <Text style={s.privacyBody}>Exact pickup address stays private until your claim is approved.</Text>
            </View>

            {blockedReserve ? (
              <View style={s.blocked}>
                <Text style={s.blockedTitle}>CLAIMING BLOCKED</Text>
                <Text style={s.blockedBody}>
                  This environment cannot run Food Rescue claims yet. You can still browse listings; claiming will work once the server is updated.
                </Text>
              </View>
            ) : null}

            {isOwner ? (
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={() => router.push(('/marketplace-manage/' + item.id) as never)}
              >
                <Text style={s.primaryText}>MANAGE DONATION</Text>
              </Pressable>
            ) : claimId ? (
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={() => router.push(foodRescueClaimRoute(claimId) as never)}
              >
                <Text style={s.primaryText}>
                  {claimStatus === 'picked_up' ? 'VIEW PICKUP' : 'OPEN MY CLAIM'}
                </Text>
              </Pressable>
            ) : memberStatus === 'expired' || memberStatus === 'cancelled' ? (
              <View style={s.unavailable}>
                <Text style={s.unavailableTitle}>{FOOD_RESCUE_STATUS_LABEL[memberStatus].toUpperCase()}</Text>
                <Text style={s.unavailableBody}>This listing is no longer accepting new claims.</Text>
              </View>
            ) : canRequest ? (
              <Pressable
                accessibilityRole="button"
                style={[s.primary, claiming && s.disabled]}
                disabled={claiming}
                onPress={() => void onReserve()}
              >
                <Text style={s.primaryText}>{claiming ? 'REQUESTING…' : 'REQUEST PICKUP'}</Text>
              </Pressable>
            ) : item.status !== 'available' ? (
              <View style={s.unavailable}>
                <Text style={s.unavailableTitle}>NOT ACCEPTING CLAIMS</Text>
                <Text style={s.unavailableBody}>Someone else may have reserved this food.</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 40, gap: 12 },
  muted: { color: C.mutedStrong, fontSize: 12 },
  error: { color: C.danger, fontSize: 12 },
  badges: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  photo: { width: '100%' as const, height: 180, backgroundColor: '#050605' },
  noPhoto: { height: 120, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#0A0C0A' },
  title: { color: C.white, fontFamily: F.black, fontSize: 22 },
  meta: { color: C.mutedStrong, fontSize: 12 },
  section: { borderWidth: 1, borderColor: C.borderStrong, padding: 12, backgroundColor: '#0A0C0A', gap: 6 },
  sectionLabel: { color: C.lime, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 0.8 },
  sectionBody: { color: C.white, fontFamily: F.semiBold, fontSize: 14 },
  note: { color: C.muted, fontSize: 11, fontStyle: 'italic' as const },
  body: { color: C.white, fontSize: 13, lineHeight: 20 },
  privacy: { flexDirection: 'row' as const, gap: 8, alignItems: 'flex-start' as const },
  privacyBody: { flex: 1, color: C.mutedStrong, fontSize: 11, lineHeight: 16 },
  blocked: { borderWidth: 1, borderColor: C.danger, padding: 12, gap: 6 },
  blockedTitle: { color: C.danger, fontFamily: F.extraBold, fontSize: 11 },
  blockedBody: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
  primary: {
    minHeight: 48,
    backgroundColor: C.lime,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12 },
  disabled: { opacity: 0.55 },
  unavailable: { borderWidth: 1, borderColor: C.borderStrong, padding: 12, gap: 4 },
  unavailableTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 11 },
  unavailableBody: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
};
