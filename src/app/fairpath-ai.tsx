import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SharpChip } from '@/components/ProductChrome';
import { BodyText, Field, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { gateway, deleteAiHistory, logInteraction } from '@/core/ai/gateway';
import { SUGGESTIONS } from '@/core/ai/intents';
import { NO_MODEL, answer, type AiResponse, type Basis } from '@/core/ai/orchestrator';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

const BASIS_LABEL: Record<Basis, string> = { rule: 'RULE', member: 'YOU', extracted: 'FROM A FILE', app_state: 'YOUR FAIRPATH DATA', ai: 'AI WORDING' };
type Turn = { id: number; user: string; response: AiResponse | null };

export default function FairPathAssistant() {
  const s = useThemedStyles(styles);
  const { q, item } = useLocalSearchParams<{ q?: string; item?: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [openProv, setOpenProv] = useState<Record<number, boolean>>({});
  const seq = useRef(0);
  const asked = useRef(false);

  async function ask(question: string) {
    const t = question.trim();
    if (!t || busy) return;
    const id = ++seq.current;
    setBusy(true);
    setText('');
    setTurns((cur) => [...cur, { id, user: t, response: null }]);
    const response = await answer(t, gateway, { adapter: NO_MODEL, routeHint: item ? { kind: 'credit_item', id: item } : null });
    setTurns((cur) => cur.map((x) => (x.id === id ? { ...x, response } : x)));
    setBusy(false);
    void logInteraction(response.provenance); // provenance only (ids, versions, sources); never the conversation
  }

  useEffect(() => {
    if (q && !asked.current) { asked.current = true; void ask(q); }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScreenFrame>
      <PageHeader eyebrow="ASK FAIRPATH" title="Assistant" backTo="/home" />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 36 }}>
        <Panel tone="accent">
          <BodyText strong>Built-in guidance</BodyText>
          <BodyText muted>No AI model is connected right now. Every answer comes from your own FairPath information, verified sources and fixed rules, and each one shows how it was made. The assistant only opens FairPath tools: it never changes your records for you.</BodyText>
        </Panel>

        {turns.length === 0 ? (
          <>
            <Text style={s.label}>TRY ASKING</Text>
            <View style={s.chips}>{SUGGESTIONS.map((sug) => <SharpChip key={sug} label={sug} onPress={() => void ask(sug)} />)}</View>
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
});
