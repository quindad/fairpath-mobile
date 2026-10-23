import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { OpportunityResultsList } from '@/components/opportunity/OpportunityResultsList';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadHomePersonalization } from '@/core/profile/home-personalization';
import type { InterpretedOpportunity, OpportunityLocation, StructuredNeed } from '@/core/opportunity/needs-model';
import { interpretOpportunityQuery } from '@/core/opportunity/intent-parser';
import { searchOpportunities } from '@/core/opportunity/orchestrator';
import type { OpportunitySearchOutcome } from '@/core/opportunity/types';
import { markPlanFromSearch } from '@/core/opportunity/plan-store';

export default function HelpNowScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q?.trim() ?? '');
  const [location, setLocation] = useState<OpportunityLocation>({ missing: true });
  const [interpretation, setInterpretation] = useState<InterpretedOpportunity | null>(null);
  const [needs, setNeeds] = useState<StructuredNeed[]>([]);
  const [outcome, setOutcome] = useState<OpportunitySearchOutcome | null>(null);
  const [phase, setPhase] = useState<'input' | 'confirm' | 'results'>('input');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadHomePersonalization().then((p) => {
      if (!p?.locationText) return;
      const parts = p.locationText.split(',').map((x) => x.trim());
      setLocation({
        city: parts[0] ?? null,
        state: parts[1]?.slice(0, 2).toUpperCase() ?? null,
        zip: /\d{5}/.test(p.locationText) ? p.locationText.match(/\d{5}/)?.[0] ?? null : null,
        missing: false,
      });
    });
  }, []);

  function onInterpret() {
    const interp = interpretOpportunityQuery(query, location);
    setInterpretation(interp);
    setNeeds(interp.needs);
    setPhase('confirm');
  }

  async function onSearch() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await searchOpportunities({ needs, location, rawQuery: query });
      setOutcome(result);
      setPhase('results');
      await markPlanFromSearch(query, needs.map((n) => n.label));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="OPPORTUNITY ENGINE" title="Help now" backTo="/community" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={s.lead}>Describe your situation in everyday language. FairPath shows what it understood — edit before searching. No AI required.</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={s.input}
          multiline
          placeholder="Example: My family needs groceries tonight and we don't have transportation."
          placeholderTextColor={C.muted}
        />
        <View style={s.locRow}>
          <TextInput value={location.city ?? ''} onChangeText={(v) => setLocation((l) => ({ ...l, city: v, missing: !v && !l.state && !l.zip }))} style={[s.input, s.loc]} placeholder="City" placeholderTextColor={C.muted} />
          <TextInput value={location.state ?? ''} onChangeText={(v) => setLocation((l) => ({ ...l, state: v.toUpperCase().slice(0, 2), missing: !l.city && !v && !l.zip }))} style={[s.input, s.state]} placeholder="ST" placeholderTextColor={C.muted} />
          <TextInput value={location.zip ?? ''} onChangeText={(v) => setLocation((l) => ({ ...l, zip: v.replace(/\D/g, '').slice(0, 5), missing: !l.city && !l.state && !v }))} style={[s.input, s.state]} placeholder="ZIP" placeholderTextColor={C.muted} keyboardType="number-pad" />
        </View>
        {location.missing ? <Text style={s.hint}>Add city, state, or ZIP so FairPath can search nearby options.</Text> : null}

        {phase === 'input' ? (
          <Pressable style={s.primary} onPress={onInterpret} disabled={query.trim().length < 4}>
            <Text style={s.primaryText}>REVIEW WHAT FAIRPATH UNDERSTOOD</Text>
          </Pressable>
        ) : null}

        {phase === 'confirm' && interpretation ? (
          <View style={s.confirm}>
            <Text style={s.confirmTitle}>FairPath interpreted</Text>
            <Text style={s.pillar}>Focus: {interpretation.pillar.replace('_', ' ')}</Text>
            {needs.map((n, i) => (
              <View key={n.localId} style={s.needRow}>
                <Text style={s.needLabel}>{i + 1}. {n.label}</Text>
                <Text style={s.needMeta}>Urgency: {n.urgency.replace('_', ' ')}{n.constraints.noPersonalTransport ? ' · No personal transportation' : ''}</Text>
              </View>
            ))}
            <Pressable style={s.primary} onPress={() => void onSearch()} disabled={busy}>
              <Text style={s.primaryText}>{busy ? 'SEARCHING…' : 'SEARCH RESOURCES & COMMUNITY OFFERS'}</Text>
            </Pressable>
            <Pressable onPress={() => setPhase('input')}><Text style={s.link}>Edit wording</Text></Pressable>
          </View>
        ) : null}

        {phase === 'results' && outcome ? (
          <>
            <Text style={s.resultsHead}>{outcome.interpretedSummary}</Text>
            <OpportunityResultsList results={outcome.results} fallbacks={outcome.fallbacks} sourceErrors={outcome.sourceErrors} />
            <Pressable style={s.outline} onPress={() => router.push('/community/need-help/new' as never)}>
              <Text style={s.outlineText}>POST A COMMUNITY REQUEST</Text>
            </Pressable>
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const s = {
  content: { padding: L.mobileGutter, paddingBottom: 48, gap: 10 },
  lead: { color: C.mutedStrong, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 88, borderWidth: 1, borderColor: C.borderStrong, color: C.white, padding: 12, fontSize: 12, textAlignVertical: 'top' as const },
  locRow: { flexDirection: 'row' as const, gap: 6 },
  loc: { flex: 1, minHeight: 44 },
  state: { width: 64, minHeight: 44 },
  hint: { color: C.mutedStrong, fontSize: 12 },
  primary: { minHeight: 48, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 16 },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 13, textAlign: 'center' as const },
  outline: { minHeight: 44, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 8, paddingHorizontal: 12 },
  outlineText: { color: C.white, fontFamily: F.extraBold, fontSize: 13 },
  confirm: { borderWidth: 1, borderColor: C.borderStrong, padding: 14, backgroundColor: '#0A0C0A', gap: 8 },
  confirmTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 13 },
  pillar: { color: C.white, fontFamily: F.semiBold, fontSize: 13 },
  needRow: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  needLabel: { color: C.white, fontSize: 12, fontFamily: F.extraBold },
  needMeta: { color: C.mutedStrong, fontSize: 12, marginTop: 4 },
  link: { color: C.lime, fontSize: 12, marginTop: 4 },
  resultsHead: { color: C.white, fontFamily: F.extraBold, fontSize: 14, marginTop: 8 },
};
