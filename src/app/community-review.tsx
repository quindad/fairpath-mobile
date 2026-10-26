import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
  adminListCommunityContributions,
  adminReviewCommunityContribution,
  communityContributionsBackendReady,
  contributionActionMessage,
  type CommunityContributionRow,
} from '@/core/community/community-contributions';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

/** Minimal FairPath admin queue — server enforces is_fairpath_admin(); no client-side admin flag. */
export default function CommunityReviewScreen() {
  const s = useThemedStyles(styles);
  const [ready, setReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<CommunityContributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const list = await adminListCommunityContributions('pending');
      setRows(list);
    } catch (e) {
      setError(contributionActionMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    communityContributionsBackendReady().then(setReady).catch(() => setReady(false));
    void refresh();
  }, []);

  async function review(id: string, status: 'approved' | 'rejected' | 'needs_more_info') {
    try {
      await adminReviewCommunityContribution(id, status, status === 'approved' ? 'Approved for catalog ops follow-up' : 'Reviewed');
      await refresh();
    } catch (e) {
      notify('Review failed', contributionActionMessage(e));
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="INTERNAL" title="Community queue" backTo="/home" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        {ready === false ? <Text style={s.meta}>Queue unavailable until the contributions migration is applied.</Text> : null}
        {loading ? <ActivityIndicator style={s.spinner} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        {!loading && !error && rows.length === 0 ? <Text style={s.body}>No pending contributions.</Text> : null}
        {rows.map((r) => (
          <View key={r.id} style={s.card}>
            <Text style={s.kind}>{r.kind.replace(/_/g, ' ')}</Text>
            <Text style={s.body}>{JSON.stringify(r.payload).slice(0, 280)}</Text>
            <View style={s.actions}>
              <Pressable accessibilityRole="button" style={s.btn} onPress={() => void review(r.id, 'approved')}>
                <Text style={s.btnText}>APPROVE</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={s.btn} onPress={() => void review(r.id, 'needs_more_info')}>
                <Text style={s.btnText}>NEEDS INFO</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={s.btn} onPress={() => void review(r.id, 'rejected')}>
                <Text style={s.btnText}>REJECT</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 36 },
  meta: { color: t.warning, fontSize: 12, marginTop: 12 },
  spinner: { marginTop: 24 },
  error: { color: t.error, fontSize: 13, marginTop: 12 },
  body: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderColor: t.border, padding: 12, marginTop: 12 },
  kind: { color: t.text, fontFamily: F.extraBold, fontSize: 12, marginBottom: 6 },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 10 },
  btn: { borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 10, paddingVertical: 8 },
  btnText: { color: t.text, fontFamily: F.bold, fontSize: 9, letterSpacing: 0.5 },
});
