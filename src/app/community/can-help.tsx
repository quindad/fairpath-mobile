import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { communityCategoryLabel } from '@/core/community/categories';
import { communityHelpBackendReady, loadCommunityHelpBoard, type CommunityHelpBoardRow } from '@/core/community/community-help-service';

export default function CanHelpScreen() {
  const [board, setBoard] = useState<CommunityHelpBoardRow[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const ok = await communityHelpBackendReady();
      if (!live) return;
      setReady(ok);
      if (ok) {
        const rows = await loadCommunityHelpBoard();
        if (live) setBoard(rows);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <ScreenFrame>
      <PageHeader eyebrow="I CAN HELP" title="Help nearby" backTo="/community" />
      <ScreenScroll contentContainerStyle={s.content}>
        <Pressable style={s.primary} onPress={() => router.push('/marketplace-list-item' as never)}>
          <Text style={s.primaryText}>LIST A FREE ITEM (GIVE)</Text>
        </Pressable>
        <Pressable style={s.outline} onPress={() => router.push('/food-rescue' as never)}>
          <Text style={s.outlineText}>FOOD RESCUE LISTINGS</Text>
        </Pressable>
        <Text style={s.help}>Only completed Marketplace pickups count toward monthly claim limits. Declined, expired, or cancelled attempts do not.</Text>

        <Text style={s.section}>Open community requests</Text>
        {ready === null ? <Text style={s.muted}>Loading community requests…</Text> : null}
        {ready === false ? (
          <Text style={s.muted}>Community requests are temporarily unavailable. You can still list free items.</Text>
        ) : null}
        {board.length === 0 && ready ? <Text style={s.muted}>No open requests right now. Check back or browse Marketplace.</Text> : null}
        {board.map((r) => (
          <Pressable key={r.id} style={s.card} onPress={() => router.push(('/community/need-help/' + r.id) as never)}>
            <Text style={s.tag}>{communityCategoryLabel(r.category)} · {r.urgency.replace('_', ' ')}</Text>
            <Text style={s.body} numberOfLines={3}>{r.description}</Text>
            <Text style={s.meta}>{r.city}, {r.state}{r.pickup_ok ? ' · Pickup OK' : ''}</Text>
          </Pressable>
        ))}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 40, gap: 10 },
  primary: { height: 48, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12 },
  outline: { height: 44, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const },
  outlineText: { color: C.white, fontFamily: F.extraBold, fontSize: 12 },
  help: { color: C.muted, fontSize: 12, lineHeight: 18 },
  section: { color: C.lime, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.9, marginTop: 12 },
  muted: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderColor: C.borderStrong, padding: 12, backgroundColor: '#0A0C0A' },
  tag: { color: C.lime, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.4 },
  body: { color: C.white, fontFamily: F.semiBold, fontSize: 14, marginTop: 6 },
  meta: { color: C.mutedStrong, fontSize: 12, marginTop: 6 },
};
