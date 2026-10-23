import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { OpportunityAction, OpportunityResult } from '@/core/opportunity/types';
import { notify } from '@/core/ui/notify';

const AVAIL: Record<OpportunityResult['availability'], string> = {
  confirmed_active: 'Active offer',
  listed_unverified: 'Listed — confirm availability',
  eligibility_unknown: 'Check eligibility',
  contact_required: 'Contact provider to confirm',
  pending_backend: 'Pending FairPath rollout',
  no_match: 'Unavailable',
};

type Props = {
  results: OpportunityResult[];
  fallbacks?: OpportunityAction[];
  sourceErrors?: Partial<Record<string, string>>;
};

function runAction(a: OpportunityAction) {
  if (a.disabledReason) {
    notify('Not available yet', a.disabledReason);
    return;
  }
  if (a.phone) {
    void Linking.openURL(`tel:${a.phone.replace(/\D/g, '')}`);
    return;
  }
  if (a.url) {
    void Linking.openURL(a.url);
    return;
  }
  if (a.route) router.push(a.route as never);
}

export function OpportunityResultsList({ results, fallbacks = [], sourceErrors }: Props) {
  return (
    <View style={s.wrap}>
      {Object.entries(sourceErrors ?? {}).map(([src, msg]) => (
        <Text key={src} style={s.warn}>{src} search had a problem — other results still shown. ({(msg ?? '').slice(0, 80)})</Text>
      ))}
      {results.map((r) => (
        <View key={r.dedupeKey} style={s.card}>
          <Text style={s.source}>{r.source.replace('_', ' ').toUpperCase()}</Text>
          <Text style={s.title}>{r.title}</Text>
          {r.subtitle ? <Text style={s.sub}>{r.subtitle}</Text> : null}
          <Text style={s.avail}>{AVAIL[r.availability]}</Text>
          {r.freshness === 'stale' ? <Text style={s.stale}>Verification may be out of date</Text> : null}
          <Text style={s.reason}>{r.reason}</Text>
          <Pressable style={s.primary} onPress={() => runAction(r.primaryAction)}>
            <Text style={s.primaryText}>{r.primaryAction.label.toUpperCase()}</Text>
          </Pressable>
          {r.secondaryActions.length ? (
            <View style={s.row}>
              {r.secondaryActions.slice(0, 2).map((a) => (
                <Pressable key={a.label} style={s.secondary} onPress={() => runAction(a)}>
                  <Text style={s.secondaryText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {fallbacks.length ? (
        <View style={s.fallback}>
          <Text style={s.fallbackTitle}>Next steps</Text>
          {fallbacks.map((f) => (
            <Pressable key={f.label} onPress={() => runAction(f)}>
              <Text style={s.fallbackLink}>{f.label} →</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = {
  wrap: { gap: 10 },
  warn: { color: C.mutedStrong, fontSize: 9, lineHeight: 13, borderLeftWidth: 2, borderLeftColor: '#526F2B', paddingLeft: 8 },
  card: { borderWidth: 1, borderColor: C.borderStrong, backgroundColor: '#0A0C0A', padding: 12 },
  source: { color: C.lime, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 0.8 },
  title: { color: C.white, fontFamily: F.extraBold, fontSize: 13, marginTop: 4 },
  sub: { color: C.mutedStrong, fontSize: 10, marginTop: 2 },
  avail: { color: C.white, fontFamily: F.semiBold, fontSize: 9, marginTop: 6 },
  stale: { color: '#c9a227', fontSize: 9, marginTop: 2 },
  reason: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  primary: { height: 40, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 10 },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 8 },
  row: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
  secondary: { flex: 1, borderWidth: 1, borderColor: C.borderStrong, paddingVertical: 8, alignItems: 'center' as const },
  secondaryText: { color: C.white, fontSize: 9 },
  fallback: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderStrong },
  fallbackTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 8, marginBottom: 6 },
  fallbackLink: { color: C.mutedStrong, fontSize: 11, paddingVertical: 6 },
};
