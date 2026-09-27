import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { FilterStrip, PageHeader, ScreenFrame, SharpChip } from '@/components/ProductChrome';
import { ResourceCard } from '@/components/ResourceCard';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
  loadResourceCategories,
  loadResourceCounts,
  loadResourceProgress,
  loadSavedResources,
  resourceActionMessage,
  setResourceProgress,
  unsaveResource,
  type SavedResourceRow,
  type ResourceSummary,
} from '@/core/resources/resources-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

type Tab = 'saved' | 'started' | 'completed';
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'saved', label: 'Saved' },
  { tab: 'started', label: 'I started' },
  { tab: 'completed', label: 'I finished' },
];

export default function SavedResourcesScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [tab, setTab] = useState<Tab>('saved');
  const [rows, setRows] = useState<SavedResourceRow[]>([]);
  const [counts, setCounts] = useState({ saved: 0, started: 0, completed: 0 });
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    setError('');
    try {
      const [list, c] = await Promise.all([
        which === 'saved' ? loadSavedResources() : loadResourceProgress(which),
        loadResourceCounts(),
      ]);
      setRows(list.rows);
      setCounts(c);
    } catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) {
        router.replace(('/sign-in?returnTo=' + encodeURIComponent('/saved-resources')) as never);
        return;
      }
      setError('We could not load your resources. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResourceCategories().then((c) => setLabels(Object.fromEntries(c.map((x) => [x.slug, x.label])))).catch(() => {});
  }, []);
  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const countFor = useMemo(() => ({ saved: counts.saved, started: counts.started, completed: counts.completed }), [counts]);

  async function remove(id: string) {
    try {
      if (tab === 'saved') await unsaveResource(id);
      else await setResourceProgress(id, 'cleared');
      await load(tab);
    } catch (e) {
      notify('Could not update', resourceActionMessage(e));
    }
  }

  const emptyText =
    tab === 'saved'
      ? 'Save resources you want to come back to. They are private to you.'
      : tab === 'started'
        ? 'Mark a resource “I started this” to keep track of what you are working on.'
        : 'Resources you mark “I finished this” show up here. These are marked by you, not verified by FairPath.';

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RESOURCES" title="Your resources" backTo="/resources" />
      <View style={s.tabs}>
        <FilterStrip>
          {TABS.map((t) => (
            <SharpChip key={t.tab} label={`${t.label} · ${countFor[t.tab]}`} active={tab === t.tab} onPress={() => setTab(t.tab)} />
          ))}
        </FilterStrip>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {tab !== 'saved' ? <Text style={s.note}>Marked by you. FairPath does not verify started or finished.</Text> : null}
        {tab === 'saved' && rows.some((r) => r.available) ? (
          <View style={s.exportRow}>
            <Text style={s.exportText}>Take these with you</Text>
            <Pressable accessibilityRole="button" style={s.exportBtn} onPress={() => router.push('/documents/create?type=saved_resources_list' as never)}><Text style={s.exportBtnText}>LIST</Text></Pressable>
            <Pressable accessibilityRole="button" style={s.exportBtn} onPress={() => router.push('/documents/create?type=resource_contact_sheet' as never)}><Text style={s.exportBtnText}>CONTACT SHEET</Text></Pressable>
            <Pressable accessibilityRole="button" style={s.exportBtn} onPress={() => router.push('/documents/create?type=resource_required_documents' as never)}><Text style={s.exportBtnText}>WHAT TO BRING</Text></Pressable>
          </View>
        ) : null}
        {loading ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {!loading && !error && rows.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyBody}>{emptyText}</Text>
            <Pressable accessibilityRole="button" style={s.cta} onPress={() => router.push('/resources' as never)}>
              <Text style={s.ctaText}>FIND RESOURCES</Text>
            </Pressable>
          </View>
        ) : null}

        {rows.map((row) =>
          row.available ? (
            <ResourceCard
              key={row.resource.id}
              resource={{ ...(row.resource as ResourceSummary), distance_miles: null }}
              categoryLabels={labels}
              saved={tab === 'saved' ? true : undefined}
              progress={row.progress}
              onToggleSave={tab === 'saved' ? () => void remove(row.resource.id) : undefined}
            />
          ) : (
            <View key={row.resource.id} style={s.gone}>
              <Text style={s.goneTitle}>No longer available</Text>
              <Text style={s.goneBody}>This resource was removed or is waiting to be re-verified, so FairPath is not showing it.</Text>
              <Pressable accessibilityRole="button" style={s.removeBtn} onPress={() => void remove(row.resource.id)}>
                <Text style={s.removeText}>REMOVE</Text>
              </Pressable>
            </View>
          ),
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  tabs: { borderBottomWidth: 1, borderBottomColor: t.border },
  content: { paddingHorizontal: L.mobileGutter, paddingTop: 16, paddingBottom: 32 },
  note: { color: t.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  spinner: { marginTop: 24 },
  exportRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 8, marginBottom: 14, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentSubtle, padding: 10 },
  exportText: { color: t.text, fontFamily: F.extraBold, fontSize: 12, marginRight: 4 },
  exportBtn: { minHeight: 34, paddingHorizontal: 10, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  exportBtnText: { color: t.text, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 0.8 },
  error: { color: t.error, fontSize: 13, lineHeight: 19 },
  empty: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 16 },
  emptyTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 16 },
  emptyBody: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  cta: { height: 46, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 14 },
  ctaText: { color: t.onAccent, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  gone: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, marginBottom: 10 },
  goneTitle: { color: t.textSecondary, fontFamily: F.extraBold, fontSize: 14 },
  goneBody: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  removeBtn: { height: 40, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 10 },
  removeText: { color: t.textSecondary, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1 },
});
