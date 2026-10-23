import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { communityCategoryLabel } from '@/core/community/categories';
import {
  communityHelpBackendReady,
  loadCommunityHelpBoard,
  type CommunityHelpBoardRow,
} from '@/core/community/community-help-service';

export default function OpenCommunityRequestsScreen() {
  const [rows, setRows] = useState<CommunityHelpBoardRow[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      const backend = await communityHelpBackendReady();
      if (!live) return;
      setReady(backend);
      if (!backend) {
        setLoading(false);
        return;
      }
      try {
        const list = await loadCommunityHelpBoard();
        if (live) setRows(list);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <ScreenFrame>
      <PageHeader eyebrow="I CAN HELP" title="Open requests" backTo="/community/can-help" />
      <ScreenScroll contentContainerStyle={s.content}>
        {ready === false ? (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Open requests unavailable</Text>
            <Text style={s.panelBody}>
              The community help board is not available on this environment yet. You can still donate goods on Marketplace or food through Food Rescue.
            </Text>
            <Pressable style={s.btn} onPress={() => router.push('/marketplace' as never)}>
              <Text style={s.btnText}>BROWSE MARKETPLACE</Text>
            </Pressable>
          </View>
        ) : null}
        {ready ? (
          <>
            <Text style={s.lead}>
              These are open asks from members in your area. Tap one to read details and offer help — only approximate city and category are shown.
            </Text>
            {loading ? <Text style={s.muted}>Loading open requests…</Text> : null}
            {!loading && rows.length === 0 ? (
              <Text style={s.muted}>No open requests right now. Check back later or list free items to help neighbors.</Text>
            ) : null}
            {rows.map((r) => (
              <Pressable
                key={r.id}
                style={s.row}
                accessibilityRole="button"
                onPress={() => router.push(('/community/need-help/' + r.id) as never)}
              >
                <Text style={s.rowTitle}>{communityCategoryLabel(r.category)}</Text>
                <Text style={s.rowBody} numberOfLines={3}>{r.description}</Text>
                <Text style={s.rowMeta}>
                  {r.urgency.replace('_', ' ')} · {r.city}, {r.state}
                  {r.pickup_ok ? ' · Pickup OK' : ''}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 48, gap: 12 },
  lead: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
  muted: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
  row: { borderWidth: 1, borderColor: C.borderStrong, padding: 14, backgroundColor: '#0A0C0A' },
  rowTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 12 },
  rowBody: { color: C.white, fontFamily: F.semiBold, fontSize: 14, marginTop: 6, lineHeight: 20 },
  rowMeta: { color: C.mutedStrong, fontSize: 12, marginTop: 8 },
  panel: { borderWidth: 1, borderColor: C.borderStrong, padding: 14, backgroundColor: '#0A0C0A', gap: 8 },
  panelTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 14 },
  panelBody: { color: C.mutedStrong, fontSize: 11, lineHeight: 16 },
  btn: { height: 42, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 4 },
  btnText: { color: C.black, fontFamily: F.extraBold, fontSize: 13 },
};
