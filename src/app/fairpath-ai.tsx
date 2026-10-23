import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SharpChip } from '@/components/ProductChrome';
import { BodyText, Field, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { gateway, deleteAiHistory, logInteraction } from '@/core/ai/gateway';
import { SUGGESTIONS } from '@/core/ai/intents';
import { NO_MODEL, answer, type AiResponse, type Basis } from '@/core/ai/orchestrator';
import { getFocusGuidance, getResourceGuidance } from '@/core/ai/signal';
import { mergeSignalText, shouldEnrichWithSignal, signalStatusMessage } from '@/core/ai/signal-enrich';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';
import { SIGNAL_ASSISTANT_NOTE } from '@/core/product/member-facing-copy';
import { loadAiCreditBalance } from '@/core/ai/ai-credits';
import { catalogByCategory } from '@/core/ai/signal-catalog';

const BASIS_LABEL: Record<Basis, string> = { rule: 'RULE', member: 'YOU', extracted: 'FROM A FILE', app_state: 'YOUR FAIRPATH DATA', ai: 'AI WORDING' };
type Turn = { id: number; user: string; response: AiResponse | null };

export default function FairPathAssistant() {
  const s = useThemedStyles(styles);
  const { q, item } = useLocalSearchParams<{ q?: string; item?: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [openProv, setOpenProv] = useState<Record<number, boolean>>({});
  const [credits, setCredits] = useState<number | null | undefined>(undefined);
  const seq = useRef(0);
  const asked = useRef(false);

  useFocusEffect(useCallback(() => {
    let live = true;
    loadAiCreditBalance().then((b) => { if (live) setCredits(b); });
    return () => { live = false; };
  }, []));

  async function ask(question: string) {
    const t = question.trim();
    if (!t || busy) return;
    const id = ++seq.current;
    setBusy(true);
    setText('');
    setTurns((cur) => [...cur, { id, user: t, response: null }]);
    let response = await answer(t, gateway, { adapter: NO_MODEL, routeHint: item ? { kind: 'credit_item', id: item } : null });
    if (shouldEnrichWithSignal(response.intent) && (await gateway.signedIn())) {
      const sig =
        response.intent === 'next_steps'
          ? await getFocusGuidance()
          : await getResourceGuidance(t);
      if (sig.status === 'ok') response = mergeSignalText(response, sig.text);
      else {
        const note = signalStatusMessage(sig.status);
        if (note) response = { ...response, parts: [...response.parts, { text: note, basis: 'app_state' }] };
      }
    }
    setTurns((cur) => cur.map((x) => (x.id === id ? { ...x, response } : x)));
    setBusy(false);
    void logInteraction(response.provenance); // provenance only (ids, versions, sources); never the conversation
  }

  useEffect(() => {
    if (q && !asked.current) { asked.current = true; void ask(q); }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScreenFrame>
      <PageHeader eyebrow="SIGNAL" title="Assistant" backTo="/home" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 36 }}>
        <Panel tone="accent">
          <BodyText strong>Built-in guidance</BodyText>
          <BodyText muted>{SIGNAL_ASSISTANT_NOTE} Each part shows how it was made.</BodyText>
          {credits === undefined ? null : credits === null ? (
            <BodyText muted>Sign in to use Signal credits on personalized help.</BodyText>
          ) : (
            <BodyText muted>Signal credits available: {credits}. Each tool below typically uses 1–2 credits when the server AI runs.</BodyText>
          )}
        </Panel>

        {turns.length === 0 ? (
          <>
            <Text style={s.label}>TRY ASKING</Text>
            <View style={s.chips}>{SUGGESTIONS.map((sug) => <SharpChip key={sug} label={sug} onPress={() => void ask(sug)} />)}</View>

            <Text style={s.label}>SIGNAL TOOLS (WHERE TO TAP)</Text>
            <BodyText muted>These use server AI on the screen listed — open the route, then use the Signal button there.</BodyText>
            {catalogByCategory().map((group) => (
              <View key={group.category} style={{ marginTop: 14 }}>
                <Text style={s.groupTitle}>{group.label.toUpperCase()}</Text>
                {group.items.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    style={s.catalogRow}
                    onPress={() => {
                      if (item.assistantPrompt) void ask(item.assistantPrompt);
                      else if (item.route) router.push(item.route as never);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.catalogTitle}>{item.title}</Text>
                      <Text style={s.catalogBody}>{item.description}</Text>
                      {item.route ? <Text style={s.catalogMeta}>Open {item.route} · ~{item.creditCost} credit{item.creditCost === 1 ? '' : 's'}</Text> : null}
                    </View>
                    <Text style={s.catalogGo}>→</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {turns.map((t) => (
          <View key={t.id} style={s.turn}>
            <View style={s.userBubble}><Text style={s.userText}>{t.user}</Text></View>
            {t.response ? (
              <View style={s.card}>
                <Text style={s.title}>{t.response.title}</Text>
                {t.response.parts.map((p, k) => (
                  <View key={k} style={s.part}>
                    <Text style={s.basis}>{BASIS_LABEL[p.basis]}</Text>
                    <Text style={s.partText}>{p.text}</Text>
                  </View>
                ))}
                <View style={s.actions}>
                  {t.response.actions.map((a) => (a.primary ? <PrimaryButton key={a.label + a.route} label={a.label.toUpperCase()} onPress={() => router.push(a.route as never)} /> : <SecondaryButton key={a.label + a.route} label={a.label.toUpperCase()} onPress={() => router.push(a.route as never)} />))}
                </View>
                <TextButton label={openProv[t.id] ? 'HIDE HOW I GOT THIS' : 'HOW I GOT THIS'} onPress={() => setOpenProv((o) => ({ ...o, [t.id]: !o[t.id] }))} />
                {openProv[t.id] ? (
                  <View style={s.prov}>
                    <BodyText muted>Engine: {t.response.provenance.engine === 'model' ? 'AI model wording plus fixed rules' : 'built-in rules (no AI model)'} · Task: {t.response.provenance.task.replace(/_/g, ' ')} · Confidence: {t.response.provenance.confidence}</BodyText>
                    {t.response.provenance.sourceRefs.length ? <BodyText muted>Based on your: {[...new Set(t.response.provenance.sourceRefs.map((r) => r.kind.replace(/_/g, ' ')))].join(', ')}</BodyText> : <BodyText muted>No personal records were used.</BodyText>}
                    {t.response.provenance.ruleVersions.map((r) => <BodyText key={r.rule_key} muted>Rule {r.rule_key} version {r.rule_version}</BodyText>)}
                    {t.response.provenance.officialSources.map((o) => <Pressable key={o.url} accessibilityRole="link" onPress={() => void Linking.openURL(o.url)}><Text style={s.link}>OFFICIAL SOURCE: {o.label.toUpperCase()} →</Text></Pressable>)}
                    <BodyText muted>Only ids, rule versions and sources are logged for this answer, never your question or the contents of your records.</BodyText>
                  </View>
                ) : null}
              </View>
            ) : <StatusLine tone="muted">Looking at your FairPath information…</StatusLine>}
          </View>
        ))}

        <Field label="ASK ABOUT FINDING HELP, YOUR PROFILE, CREDIT, RECORD RELIEF OR DOCUMENTS" value={text} onChangeText={setText} placeholder="I need somewhere to stay tonight" maxLength={300} />
        <PrimaryButton label="ASK" onPress={() => void ask(text)} busy={busy} disabled={text.trim().length < 2} />
        {turns.length ? <SecondaryButton label="START OVER" onPress={() => setTurns([])} /> : null}
        <View style={{ marginTop: 18 }}>
          <TextButton tone="danger" label="DELETE MY ASSISTANT HISTORY" onPress={() => notify('Delete assistant history?', 'This removes the record of which sources past answers used. It does not change any of your FairPath information.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteAiHistory().then((n) => notify('Deleted', `${n} record(s) removed.`)).catch(() => notify('Could not delete', 'Please try again. You may need to sign in.')) }])} />
        </View>
      </FormScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  label: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.3, marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 7 },
  turn: { marginTop: 18 },
  userBubble: { alignSelf: 'flex-end' as const, backgroundColor: t.inverse, paddingHorizontal: 12, paddingVertical: 9, maxWidth: '86%' as const },
  userText: { color: t.onInverse, fontFamily: F.medium, fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, padding: 14, marginTop: 10 },
  title: { color: t.text, fontFamily: F.black, fontSize: 18, lineHeight: 22, marginBottom: 8 },
  part: { marginBottom: 10 },
  basis: { color: t.accentText, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 1.1, marginBottom: 2 },
  partText: { color: t.textSecondary, fontSize: 14, lineHeight: 21 },
  actions: { marginTop: 4 },
  prov: { borderTopWidth: 1, borderTopColor: t.border, marginTop: 6, paddingTop: 8 },
  link: { color: t.accentText, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.6, marginTop: 6 },
  groupTitle: { color: t.accentText, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 1.2, marginBottom: 6 },
  catalogRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 11, gap: 8 },
  catalogTitle: { color: t.text, fontFamily: F.bold, fontSize: 13 },
  catalogBody: { color: t.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  catalogMeta: { color: t.textMuted, fontFamily: F.semiBold, fontSize: 9, marginTop: 4 },
  catalogGo: { color: t.accentText, fontSize: 18 },
});
