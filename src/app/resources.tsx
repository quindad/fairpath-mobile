import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { FilterStrip, PageHeader, ScreenFrame, SectionTitle, SharpChip } from '@/components/ProductChrome';
import { ResourceCard } from '@/components/ResourceCard';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadLocationSettings } from '@/core/profile/location-service';
import { isZip5, radiusOptions } from '@/core/resources/resource-format';
import { useResourceMemberState } from '@/core/resources/use-resource-states';
import {
  RESOURCE_PAGE_SIZE,
  loadResourceCategories,
  loadResourceNeeds,
  resolveResourceNeeds,
  searchResources,
  type ResourceCategory,
  type ResourceNeed,
  type ResourceSummary,
} from '@/core/resources/resources-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type Search = {
  query: string;
  zip: string;
  radius: number;
  category: string | null;
  freeOnly: boolean;
  onlineOnly: boolean;
  urgent: boolean;
};
const EMPTY: Search = { query: '', zip: '', radius: 25, category: null, freeOnly: false, onlineOnly: false, urgent: false };

export default function ResourcesScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();

  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [needs, setNeeds] = useState<ResourceNeed[]>([]);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftZip, setDraftZip] = useState('');
  const [search, setSearch] = useState<Search>(EMPTY);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<ResourceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [matchedNeeds, setMatchedNeeds] = useState<ResourceNeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zipHint, setZipHint] = useState('');
  const requestId = useRef(0);
  const member = useResourceMemberState('/resources');
  const refreshStates = member.refresh;

  const categoryLabels = useMemo(() => Object.fromEntries(categories.map((c) => [c.slug, c.label])), [categories]);

  // Taxonomy and the member's saved ZIP (guests simply have no saved ZIP).
  useEffect(() => {
    let active = true;
    loadResourceCategories().then((c) => active && setCategories(c)).catch(() => {});
    loadResourceNeeds().then((n) => active && setNeeds(n)).catch(() => {});
    loadLocationSettings()
      .then((l) => {
        if (!active) return;
        if (l.zip_code && isZip5(l.zip_code)) {
          setDraftZip(l.zip_code);
          setSearch((cur) => ({ ...cur, zip: l.zip_code as string, radius: l.search_radius_miles }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const run = useCallback(async (next: Search, append = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const offset = append ? results.length : 0;
      const [page, matched] = await Promise.all([
        searchResources({
          query: next.query,
          zip: next.zip,
          radiusMiles: next.radius,
          category: next.category,
          freeOnly: next.freeOnly,
          urgent: next.urgent,
          delivery: next.onlineOnly ? ['virtual', 'phone'] : undefined,
          offset,
          limit: RESOURCE_PAGE_SIZE,
        }),
        append ? Promise.resolve(matchedNeeds) : resolveResourceNeeds(next.query),
      ]);
      if (id !== requestId.current) return;
      setResults((cur) => (append ? [...cur, ...page.resources] : page.resources));
      setTotal(page.total);
      setHasMore(page.hasMore);
      if (!append) setMatchedNeeds(matched);
      setSearched(true);
      void refreshStates(page.resources.map((r) => r.id));
    } catch {
      if (id === requestId.current) setError('We could not load resources right now. Check your connection and try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [results.length, matchedNeeds, refreshStates]);

  function submit(overrides: Partial<Search> = {}) {
    const zip = draftZip.trim();
    if (zip && !isZip5(zip)) {
      setZipHint('Enter a 5-digit ZIP code, or leave it blank to see everything.');
      return;
    }
    setZipHint('');
    const next: Search = { ...search, query: draftQuery.trim(), zip, ...overrides };
    setSearch(next);
    void run(next);
  }

  function startNeed(need: ResourceNeed) {
    setDraftQuery(need.label);
    submit({ query: need.label, category: null, urgent: false });
  }
  function startUrgent() {
    setDraftQuery('');
    submit({ query: '', category: null, urgent: true });
  }
  function startCategory(slug: string) {
    setDraftQuery('');
    submit({ query: '', category: slug, urgent: false });
  }
  function toggle(patch: Partial<Search>) {
    const next = { ...search, ...patch };
    setSearch(next);
    void run(next);
  }
  function reset() {
    requestId.current++;
    setSearch({ ...EMPTY, zip: search.zip, radius: search.radius });
    setDraftQuery('');
    setSearched(false);
    setResults([]);
    setMatchedNeeds([]);
    setError('');
    setLoading(false);
  }

  const activeCategory = search.category ? categoryLabels[search.category] ?? search.category : null;
  const headline = search.urgent ? 'Help today' : activeCategory ?? (search.query ? `“${search.query}”` : 'All resources');

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RESOURCES" title="Find help" backTo="/home" onBack={searched ? reset : true} />
      <FormScrollView contentContainerStyle={s.content}>
        {!searched ? (
          <Pressable accessibilityRole="button" accessibilityLabel="I need help today" style={s.urgent} onPress={startUrgent}>
            <View style={s.urgentCopy}>
              <Text style={s.urgentTitle}>I NEED HELP TODAY</Text>
              <Text style={s.urgentBody}>Food, shelter, utilities, safety and other same-day help, verified recently.</Text>
            </View>
            <Text style={s.urgentArrow}>→</Text>
          </Pressable>
        ) : null}

        <View style={s.searchBox}>
          <Text style={s.label}>WHAT DO YOU NEED?</Text>
          <TextInput
            style={s.input}
            value={draftQuery}
            onChangeText={setDraftQuery}
            placeholder="Food, a place to stay, ID, a ride…"
            placeholderTextColor={tokens.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => submit()}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="What do you need"
          />
          <Text style={[s.label, s.labelGap]}>NEAR ZIP CODE</Text>
          <TextInput
            style={s.input}
            value={draftZip}
            onChangeText={(v) => setDraftZip(v.replace(/[^0-9]/g, '').slice(0, 5))}
            placeholder="Optional · 5-digit ZIP"
            placeholderTextColor={tokens.textMuted}
            keyboardType="number-pad"
            returnKeyType="search"
            onSubmitEditing={() => submit()}
            accessibilityLabel="ZIP code"
          />
          {zipHint ? <Text style={s.error}>{zipHint}</Text> : null}
          <Pressable accessibilityRole="button" style={s.searchButton} onPress={() => submit()}>
            <Text style={s.searchButtonText}>SEARCH RESOURCES</Text>
          </Pressable>
        </View>

        {!searched ? (
          <>
            <View style={s.block}>
              <SectionTitle>I NEED…</SectionTitle>
              <View style={s.needWrap}>
                {needs.map((n) => (
                  <SharpChip key={n.need_slug} label={n.label} onPress={() => startNeed(n)} />
                ))}
              </View>
            </View>
            <View style={s.block}>
              <SectionTitle>BROWSE BY CATEGORY</SectionTitle>
              {categories.map((c) => (
                <Pressable key={c.slug} accessibilityRole="button" style={s.catRow} onPress={() => startCategory(c.slug)}>
                  <View style={s.catCopy}>
                    <Text style={s.catTitle}>{c.label}</Text>
                    {c.description ? <Text style={s.catBody}>{c.description}</Text> : null}
                  </View>
                  <Text style={s.arrow}>→</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.block}>
              <SectionTitle>YOUR RESOURCES</SectionTitle>
              <Pressable accessibilityRole="button" style={s.catRow} onPress={() => router.push('/saved-resources' as never)}>
                <View style={s.catCopy}>
                  <Text style={s.catTitle}>Saved and in-progress</Text>
                  <Text style={s.catBody}>Resources you saved or marked as started or finished</Text>
                </View>
                <Text style={s.arrow}>→</Text>
              </Pressable>
            </View>
            <View style={s.block}>
              <SectionTitle>MORE FROM FAIRPATH</SectionTitle>
              {[
                ['Record relief check', 'Find out where expungement or sealing may apply', '/record-relief'],
                ['Find jobs', 'Search jobs near you', '/find-jobs'],
                ['Find housing', 'Search homes and apply', '/find-housing'],
              ].map(([title, body, route]) => (
                <Pressable key={title} accessibilityRole="button" style={s.catRow} onPress={() => router.push(route as never)}>
                  <View style={s.catCopy}>
                    <Text style={s.catTitle}>{title}</Text>
                    <Text style={s.catBody}>{body}</Text>
                  </View>
                  <Text style={s.arrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={s.block}>
            <Text style={s.resultsTitle}>{headline}</Text>
            {matchedNeeds.length ? (
              <Text style={s.matched}>Showing help for: {matchedNeeds.map((n) => n.label).join(', ')}</Text>
            ) : null}
            <Text style={s.count}>
              {loading && !results.length ? 'Searching…' : `${total} verified ${total === 1 ? 'result' : 'results'}`}
              {search.zip ? ` near ${search.zip}` : ''}
            </Text>

            <View style={s.strip}><FilterStrip>
              <SharpChip label="Free only" active={search.freeOnly} onPress={() => toggle({ freeOnly: !search.freeOnly })} />
              <SharpChip label="Online / phone" active={search.onlineOnly} onPress={() => toggle({ onlineOnly: !search.onlineOnly })} />
              <SharpChip label="Help today" active={search.urgent} onPress={() => toggle({ urgent: !search.urgent })} />
              {search.category ? <SharpChip label={`${activeCategory} ✕`} active onPress={() => toggle({ category: null })} /> : null}
            </FilterStrip></View>
            {search.zip ? (
              <View style={s.strip}><FilterStrip>
                {radiusOptions().map((r) => (
                  <SharpChip key={r} label={`${r} mi`} active={search.radius === r} onPress={() => toggle({ radius: r })} />
                ))}
              </FilterStrip></View>
            ) : null}

            {error ? <Text style={s.error}>{error}</Text> : null}
            {results.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                categoryLabels={categoryLabels}
                saved={member.states[r.id]?.is_saved}
                progress={member.states[r.id]?.progress}
                onToggleSave={() => void member.toggleSave(r.id)}
              />
            ))}

            {!loading && !error && total === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No verified resources match yet</Text>
                <Text style={s.emptyBody}>
                  FairPath only lists resources that have been checked. Try a wider radius, turn off a filter, or
                  search a different need. New resources are added as they are verified.
                </Text>
                <Pressable accessibilityRole="button" style={s.secondary} onPress={reset}>
                  <Text style={s.secondaryText}>START OVER</Text>
                </Pressable>
              </View>
            ) : null}

            {loading ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
            {hasMore && !loading ? (
              <Pressable accessibilityRole="button" style={s.secondary} onPress={() => void run(search, true)}>
                <Text style={s.secondaryText}>LOAD MORE</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 32 },
  urgent: { marginTop: 16, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentSubtle, flexDirection: 'row' as const, alignItems: 'center' as const, padding: 16 },
  urgentCopy: { flex: 1, paddingRight: 12 },
  urgentTitle: { color: t.accentText, fontFamily: F.black, fontSize: 15, letterSpacing: 0.8 },
  urgentBody: { color: t.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  urgentArrow: { color: t.accentText, fontSize: 22 },
  searchBox: { marginTop: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14 },
  label: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.3, marginBottom: 6 },
  labelGap: { marginTop: 12 },
  input: { height: 46, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, fontFamily: F.medium, fontSize: 15, paddingHorizontal: 12 },
  searchButton: { height: 46, marginTop: 14, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  searchButtonText: { color: t.onAccent, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  block: { marginTop: 22 },
  needWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 7 },
  catRow: { minHeight: 64, borderBottomWidth: 1, borderBottomColor: t.border, flexDirection: 'row' as const, alignItems: 'center' as const },
  catCopy: { flex: 1, paddingRight: 12, paddingVertical: 10 },
  catTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 15 },
  catBody: { color: t.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  arrow: { color: t.accentText, fontSize: 18 },
  resultsTitle: { color: t.text, fontFamily: F.black, fontSize: 22, letterSpacing: -0.4 },
  matched: { color: t.accentText, fontFamily: F.semiBold, fontSize: 12, marginTop: 6 },
  count: { color: t.textMuted, fontSize: 12, marginTop: 6, marginBottom: 4 },
  error: { color: t.error, fontSize: 12, lineHeight: 18, marginTop: 8 },
  empty: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 16, marginTop: 8 },
  emptyTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 16 },
  emptyBody: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  secondary: { height: 44, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 12 },
  secondaryText: { color: t.textSecondary, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1 },
  spinner: { marginVertical: 16 },
  strip: { marginHorizontal: -L.mobileGutter },
});
