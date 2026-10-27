import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormScrollView, SignalKeyboardFooterLayout, useSignalKeyboardInset } from '@/components/FormScrollView';
import { FairBackButton, ScreenColumn, ScreenFrame, SharpChip } from '@/components/ProductChrome';
import { fetchFairpathGatewayPlan } from '@/core/ai/fairpath-ai-gateway-client';
import { SignalTurn } from '@/components/signal/SignalMessageBubble';
import { TextButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { gateway, deleteAiHistory, logInteraction } from '@/core/ai/gateway';
import { NO_MODEL, answer, type AiResponse } from '@/core/ai/orchestrator';
import { getFocusGuidance, getResourceGuidance } from '@/core/ai/signal';
import { signalQuickTools } from '@/core/ai/signal-catalog';
import { loadMemberSearchLocation } from '@/core/location/member-search-location';
import { mergeSignalText, shouldEnrichWithSignal } from '@/core/ai/signal-enrich';
import { noteForAskFailure, noteForSignalResult } from '@/core/signal/signal-member-context';
import { loadAiCreditBalance } from '@/core/ai/ai-credits';
import { loadSignalSuggestions } from '@/core/signal/signal-suggestions';
import {
  deleteConversation,
  loadActiveConversation,
  saveActiveConversation,
  startNewConversation,
  type ConversationThreadMeta,
} from '@/core/signal/signal-conversation-store';
import { detectWriteToolRequest, enrichWithReadTools, loadingMessageForPhase } from '@/core/signal/signal-orchestrator';
import { looksLikePromptInjection } from '@/core/signal/signal-prompt-guard';
import { mergeResponseActions } from '@/core/signal/signal-result-actions';
import { nearMeLocationNudgePart, nearMeRequiresZip, shouldKeepResourceResult } from '@/core/signal/signal-resource-relevance';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';

type Turn = { id: number; user: string; response: AiResponse | null };

export default function FairPathAssistant() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const { q, item } = useLocalSearchParams<{ q?: string; item?: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [openProv, setOpenProv] = useState<Record<number, boolean>>({});
  const [credits, setCredits] = useState<number | null | undefined>(undefined);
  const [starters, setStarters] = useState<string[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [threadMeta, setThreadMeta] = useState<ConversationThreadMeta | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | undefined>();
  const [activeTurnId, setActiveTurnId] = useState<number | null>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const seq = useRef(0);
  const asked = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<import('react-native').ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadAiCreditBalance().then((b) => {
        if (live) setCredits(b);
      });
      loadSignalSuggestions().then((x) => {
        if (live) setStarters(x);
      });
      loadMemberSearchLocation().then((loc) => {
        if (!live) return;
        if (loc.zip) setLocationHint(`Searching near ZIP ${loc.zip} (${loc.radiusMiles} mi)`);
        else if (loc.source === 'device') setLocationHint('Using your device location for nearby results');
        else setLocationHint('Add a ZIP for distance-sorted results');
      });
      loadActiveConversation().then((active) => {
        if (!live || !active) return;
        setThreadMeta(active.meta);
        setTurns(active.turns);
        seq.current = active.turns.reduce((m, t) => Math.max(m, t.id), 0);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  useEffect(() => {
    if (turns.length) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [turns, busy]);

  async function persistThread(nextTurns: Turn[], meta: ConversationThreadMeta) {
    await saveActiveConversation(meta, nextTurns);
  }

  async function ask(question: string) {
    const t = question.trim();
    if (!t || busy) return;

    const writeTool = detectWriteToolRequest(t);
    if (writeTool) {
      notify(
        writeTool.title,
        `${writeTool.summary} Open that workflow so you can review everything before anything is submitted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open workflow',
            onPress: () => {
              if (writeTool.route) router.push(writeTool.route as never);
            },
          },
        ],
      );
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const id = ++seq.current;
    setBusy(true);
    setActiveTurnId(id);
    setLoadingStatus(loadingMessageForPhase('routing'));
    setText('');

    let meta = threadMeta;
    if (!meta) {
      meta = await startNewConversation(t);
      setThreadMeta(meta);
    }

    setTurns((cur) => [...cur, { id, user: t, response: null }]);

    try {
      if (looksLikePromptInjection(t)) {
        const blocked: AiResponse = {
          intent: 'help',
          title: 'I stay on FairPath workflows',
          modelAssisted: false,
          parts: [
            {
              text: 'I cannot change my rules from a message. Ask about jobs, housing, credit, record relief, or your next steps and I will route you to real tools.',
              basis: 'rule',
            },
          ],
          actions: [{ label: 'What Signal can do', route: '/fairpath-ai', primary: true }],
          provenance: {
            task: 'navigation',
            intent: 'help',
            engine: 'deterministic_router',
            route: '/fairpath-ai',
            sourceRefs: [],
            ruleVersions: [],
            officialSources: [],
            confidence: 'deterministic',
          },
        };
        setTurns((cur) => {
          const next = cur.map((x) => (x.id === id ? { ...x, response: blocked } : x));
          void persistThread(next, meta!);
          return next;
        });
        return;
      }

      setLoadingStatus(loadingMessageForPhase('routing'));
      let response = await answer(t, gateway, { adapter: NO_MODEL, routeHint: item ? { kind: 'credit_item', id: item } : null });
      if (ac.signal.aborted) return;

      setLoadingStatus(loadingMessageForPhase('tools', planToolHint(response.intent)));
      const enriched = await enrichWithReadTools(response, t, gateway, ac.signal);
      response = enriched.response;

      const searchLoc = await loadMemberSearchLocation(t);
      if (nearMeRequiresZip(t, searchLoc.zip)) {
        const nudge = nearMeLocationNudgePart();
        if (!response.parts.some((p) => p.text.includes(nudge.text.slice(0, 40)))) {
          response = {
            ...response,
            parts: [...response.parts, nudge],
            actions: mergeResponseActions(response.actions, [
              { label: 'Set location (ZIP)', route: '/location-setup', primary: !response.actions.some((a) => a.primary) },
            ]),
          };
        }
      }

      if (await gateway.signedIn()) {
        const gwPlan = await fetchFairpathGatewayPlan(t);
        if (gwPlan?.resultCards?.length) {
          const seen = new Set((response.resultCards ?? []).map((c) => c.route));
          const merged = [...(response.resultCards ?? [])];
          for (const card of gwPlan.resultCards) {
            if (seen.has(card.route)) continue;
            if (card.kind === 'resource' && !shouldKeepResourceResult(card.title, [], t)) continue;
            seen.add(card.route);
            merged.push(card);
          }
          response = { ...response, resultCards: merged.slice(0, 6) };
        }
      }

      if (shouldEnrichWithSignal(response.intent) && (await gateway.signedIn())) {
        setLoadingStatus(loadingMessageForPhase('enrich'));
        const sig =
          response.intent === 'next_steps' ? await getFocusGuidance() : await getResourceGuidance(t);
        if (ac.signal.aborted) return;
        if (sig.status === 'ok') response = mergeSignalText(response, sig.text);
        else {
          const note = noteForSignalResult(sig);
          if (note) response = { ...response, parts: [...response.parts, { text: note, basis: 'app_state' }] };
        }
      }

      setTurns((cur) => {
        const next = cur.map((x) => (x.id === id ? { ...x, response } : x));
        void persistThread(next, meta!);
        return next;
      });
      void logInteraction(response.provenance);
    } catch (e) {
      if (ac.signal.aborted) return;
      const failed: AiResponse = {
        intent: 'help',
        title: 'Something went wrong',
        modelAssisted: false,
        parts: [{ text: noteForAskFailure(e), basis: 'app_state' }],
        actions: [{ label: 'Explore FairPath', route: '/explore', primary: true }],
        provenance: {
          task: 'navigation',
          intent: 'help',
          engine: 'deterministic_router',
          route: '/explore',
          sourceRefs: [],
          ruleVersions: [],
          officialSources: [],
          confidence: 'unavailable',
        },
      };
      setTurns((cur) => {
        const next = cur.map((x) => (x.id === id ? { ...x, response: failed } : x));
        void persistThread(next, meta!);
        return next;
      });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setBusy(false);
      setLoadingStatus(undefined);
      setActiveTurnId(null);
    }
  }

  function planToolHint(intent: import('@/core/ai/intents').IntentId): string | undefined {
    if (intent === 'find_jobs') return 'search_jobs';
    if (intent === 'find_housing') return 'search_housing';
    if (intent === 'next_steps') return 'my_path';
    return undefined;
  }

  function cancelAsk() {
    abortRef.current?.abort();
    setBusy(false);
    setLoadingStatus(undefined);
    setActiveTurnId(null);
  }

  async function newConversation() {
    abortRef.current?.abort();
    setBusy(false);
    setTurns([]);
    setOpenProv({});
    const meta = await startNewConversation();
    setThreadMeta(meta);
  }

  useEffect(() => {
    if (q && !asked.current) {
      asked.current = true;
      void ask(q);
    }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function confirmDeleteHistory() {
    notify('Delete assistant history?', 'This removes logged source metadata for past answers. It does not change your FairPath records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void deleteAiHistory()
            .then((n) => notify('Deleted', `${n} record(s) removed.`))
            .catch(() => notify('Could not delete', 'Please try again. You may need to sign in.')),
      },
    ]);
  }

  const showEmpty = turns.length === 0 && !busy;

  return (
    <ScreenFrame>
      <View style={s.header}>
        <FairBackButton onPress={() => router.replace('/home' as never)} />
        <View style={s.headerCopy}>
          <Text style={s.brand}>FairPath Signal</Text>
          <Text style={s.subtitle}>Conversation</Text>
        </View>
        <View style={s.headerActions}>
          {credits != null ? (
            <View style={s.creditPill}>
              <Text style={s.creditText}>{credits} credits</Text>
            </View>
          ) : credits === null ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in?returnTo=/fairpath-ai' as never)}>
              <Text style={s.signInLink}>Sign in</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Specialized tools" hitSlop={8} onPress={() => setToolsOpen(true)}>
            <Lucide name="layout-grid" color={tokens.textSecondary} size={20} />
          </Pressable>
        </View>
      </View>

      <SignalKeyboardFooterLayout chatScrollRef={scrollRef}>
        <ScreenColumn>
          <FormScrollView
            footerScroll
            ref={scrollRef}
            style={s.chatScroll}
            contentContainerStyle={s.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {locationHint ? <Text style={s.locHint}>{locationHint}</Text> : null}
            {showEmpty ? (
              <View style={s.welcome}>
                <Text style={s.welcomeTitle}>What do you need help with?</Text>
                <Text style={s.welcomeBody}>
                  Ask in plain language — Signal searches verified jobs, housing, and resources near your saved ZIP or device
                  location, then opens the right FairPath screen. Tap &quot;How I got this&quot; for sources and basis. Built-in guidance
                  runs on your phone; no AI model is connected unless optional cloud enrichment is configured and you have credits.
                </Text>
                <TextButton label="Set or update location (ZIP)" onPress={() => router.push('/location-setup' as never)} />
                <View style={s.chips}>
                  {starters.map((sug) => (
                    <SharpChip key={sug} label={sug} onPress={() => void ask(sug)} />
                  ))}
                </View>
              </View>
            ) : null}

            {turns.map((t) => (
              <SignalTurn
                key={t.id}
                user={t.user}
                response={t.response}
                loading={!t.response && activeTurnId === t.id}
                loadingStatus={!t.response && activeTurnId === t.id ? loadingStatus : undefined}
                provOpen={Boolean(openProv[t.id])}
                onToggleProv={() => setOpenProv((o) => ({ ...o, [t.id]: !o[t.id] }))}
                onAction={(route) => router.push(route as never)}
              />
            ))}

            {turns.length ? (
              <View style={s.footerRow}>
                <TextButton label="New conversation" onPress={() => void newConversation()} />
                <TextButton
                  label="Delete this chat"
                  onPress={() =>
                    notify('Delete this conversation?', 'Removes this chat from this device only.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          void (async () => {
                            if (threadMeta) await deleteConversation(threadMeta.id);
                            await newConversation();
                          })(),
                      },
                    ])
                  }
                />
                <TextButton label="Clear logged history" onPress={confirmDeleteHistory} />
              </View>
            ) : null}
          </FormScrollView>

          <SignalComposer
            s={s}
            tokens={tokens}
            text={text}
            busy={busy}
            setText={setText}
            onAsk={() => void ask(text)}
            onCancel={cancelAsk}
            onAttach={() => router.push('/letter-explainer' as never)}
            onFocusComposer={() => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))}
          />
        </ScreenColumn>
      </SignalKeyboardFooterLayout>

      <Modal visible={toolsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setToolsOpen(false)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Specialized tools</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setToolsOpen(false)}>
              <Lucide name="x" color={tokens.text} size={22} />
            </Pressable>
          </View>
          <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.modalBody}>
            <Text style={s.modalLead}>Shortcuts to FairPath workflows. Document-heavy tasks open on their screen.</Text>
            {signalQuickTools().map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                style={s.catalogRow}
                onPress={() => {
                  setToolsOpen(false);
                  if (row.assistantPrompt) void ask(row.assistantPrompt);
                  else if (row.route) router.push(row.route as never);
                }}
              >
                <Text style={s.catalogTitle}>{row.title}</Text>
                <Text style={s.catalogBody} numberOfLines={2}>{row.description}</Text>
              </Pressable>
            ))}
          </FormScrollView>
        </View>
      </Modal>
    </ScreenFrame>
  );
}

function SignalComposer({
  s,
  tokens,
  text,
  busy,
  setText,
  onAsk,
  onCancel,
  onAttach,
  onFocusComposer,
}: {
  s: ReturnType<typeof styles>;
  tokens: ThemeTokens;
  text: string;
  busy: boolean;
  setText: (v: string) => void;
  onAsk: () => void;
  onCancel: () => void;
  onAttach: () => void;
  onFocusComposer: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardInset = useSignalKeyboardInset();
  const composerPad = keyboardInset > 0 ? 8 : Math.max(insets.bottom, 8);
  return (
    <View style={[s.composer, { paddingBottom: composerPad }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Attach a document photo" style={s.attach} onPress={onAttach}>
        <Lucide name="paperclip" color={tokens.textSecondary} size={20} />
      </Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message Signal…"
        placeholderTextColor={tokens.textMuted}
        style={s.input}
        multiline
        maxLength={500}
        editable={!busy}
        onFocus={onFocusComposer}
        onSubmitEditing={onAsk}
        blurOnSubmit={false}
      />
      {busy ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Stop" style={s.send} onPress={onCancel}>
          <Lucide name="square" color={tokens.onAccent} size={18} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[s.send, text.trim().length < 2 && s.sendDisabled]}
          disabled={text.trim().length < 2}
          onPress={onAsk}
        >
          <Lucide name="arrow-up" color={text.trim().length < 2 ? tokens.textMuted : tokens.onAccent} size={20} />
        </Pressable>
      )}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  header: {
    minHeight: 56,
    paddingHorizontal: L.mobileGutter,
    paddingVertical: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  brand: { color: t.text, fontFamily: F.extraBold, fontSize: 17, letterSpacing: -0.3 },
  subtitle: { color: t.textMuted, fontFamily: F.medium, fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  creditPill: { borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: t.surface },
  creditText: { color: t.accentText, fontFamily: F.semiBold, fontSize: 11 },
  signInLink: { color: t.accentText, fontFamily: F.semiBold, fontSize: 12 },
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: L.mobileGutter, paddingTop: 12, paddingBottom: 12, flexGrow: 1 },
  locHint: { color: t.textMuted, fontFamily: F.medium, fontSize: 11, marginBottom: 8 },
  welcome: { gap: 10, paddingBottom: 8 },
  welcomeTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 20, lineHeight: 24 },
  welcomeBody: { color: t.textSecondary, fontFamily: F.medium, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 4 },
  composer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 8,
    paddingHorizontal: L.mobileGutter,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: t.border,
    backgroundColor: t.background,
  },
  attach: { width: 40, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.input,
    color: t.text,
    fontFamily: F.medium,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  send: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.accent,
  },
  sendDisabled: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  footerRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingHorizontal: L.mobileGutter, paddingBottom: 8 },
  modal: { flex: 1, backgroundColor: t.background },
  modalHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: L.mobileGutter,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  modalTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 18 },
  modalBody: { padding: L.mobileGutter, paddingBottom: 32, gap: 16 },
  modalLead: { color: t.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  modalGroup: { gap: 8 },
  groupTitle: { color: t.accentText, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.6, marginTop: 8 },
  catalogRow: { borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 12, gap: 4 },
  catalogTitle: { color: t.text, fontFamily: F.bold, fontSize: 14 },
  catalogBody: { color: t.textSecondary, fontSize: 12, lineHeight: 17 },
});
