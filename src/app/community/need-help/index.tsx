import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { communityCategoryLabel } from '@/core/community/categories';
import { communityHelpBackendReady, loadMyCommunityHelpRequests, type CommunityHelpRequestRow } from '@/core/community/community-help-service';

export default function NeedHelpHomeScreen() {
  const [rows, setRows] = useState<CommunityHelpRequestRow[]>([]);
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
        const list = await loadMyCommunityHelpRequests();
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
      <PageHeader eyebrow="I NEED HELP" title="Community requests" backTo="/community" trailing={(
        <Pressable accessibilityRole="button" onPress={() => router.push('/community/need-help/new' as never)}>
          <Lucide name="plus" color={C.black} size={16} />
        </Pressable>
      )} />
      <ScreenScroll contentContainerStyle={s.content}>
        {ready === false ? (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Community requests unavailable</Text>
            <Text style={s.panelBody}>
              FairPath could not reach the community help service. You can still use Resources, Marketplace, and Food Rescue.
            </Text>
            <Pressable style={s.btn} onPress={() => router.push('/resources' as never)}>
              <Text style={s.btnText}>FIND RESOURCES</Text>
            </Pressable>
            <Pressable style={s.link} onPress={() => router.push('/marketplace' as never)}>
              <Text style={s.linkText}>FREE MARKETPLACE →</Text>
            </Pressable>
          </View>
        ) : null}
        {ready ? (
          <>
            <Pressable style={s.primary} onPress={() => router.push('/community/need-help/new' as never)}>
              <Text style={s.primaryText}>POST A REQUEST</Text>
            </Pressable>
            {loading ? <Text style={s.muted}>Loading your requests…</Text> : null}
            {!loading && rows.length === 0 ? (
              <Text style={s.muted}>No requests yet. Describe what you need — category, urgency, and approximate area only.</Text>
            ) : null}
            {rows.map((r) => (
              <Pressable key={r.id} style={s.row} onPress={() => router.push(('/community/need-help/' + r.id) as never)}>
                <Text style={s.rowTitle}>{communityCategoryLabel(r.category)}</Text>
                <Text style={s.rowBody} numberOfLines={2}>{r.description}</Text>
                <Text style={s.rowMeta}>{r.status.toUpperCase()} · {r.city}, {r.state}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 40, gap: 12 },
  primary: { height: 48, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 13 },
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
  link: { paddingVertical: 8 },
  linkText: { color: C.lime, fontFamily: F.extraBold, fontSize: 12 },
};
