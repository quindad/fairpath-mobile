import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { HousingInquiryThreadMessage, loadHousingInquiryThread, sendHousingInquiryFollowup } from '@/core/opportunities/opportunity-service';

const ERRORS: Record<string, string> = {
  MESSAGE_INVALID: 'Write at least a short message (keep it under 2,000 characters).',
  INQUIRY_NOT_FOUND: 'This conversation could not be found.',
};

export default function HousingInquiryThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<HousingInquiryThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true); setError('');
    loadHousingInquiryThread(id).then(setMessages)
      .catch((e) => setError(e?.message === 'SIGNED_OUT' ? 'Sign in to see this conversation.' : 'This conversation could not be loaded.'))
      .finally(() => setLoading(false));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function send() {
    if (!id || busy.current || draft.trim().length < 1) return;
    busy.current = true; setSending(true);
    try {
      await sendHousingInquiryFollowup(id, draft);
      setDraft('');
      await loadHousingInquiryThread(id).then(setMessages);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      notify('Could not send', ERRORS[code] ?? 'Please try again.');
    } finally {
      busy.current = false; setSending(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FAIRPATH HOUSING" title="Conversation" backTo="/housing-activity" />
      <FormScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.note}>You can keep asking follow-up questions here. The property team's replies are not yet real-time — check back or wait for a notification.</Text>
        {loading ? <Text style={s.state}>Loading conversation…</Text> : error ? <Text style={s.state}>{error}</Text> : (
          <View style={s.thread}>
            {messages.length === 0 ? <Text style={s.state}>No messages yet.</Text> : messages.map((m) => (
              <View key={m.id} style={[s.bubble, m.is_me ? s.bubbleMe : s.bubbleThem]}>
                <Text style={s.bubbleLabel}>{m.is_me ? 'YOU' : 'PROPERTY TEAM'}</Text>
                <Text style={s.bubbleBody}>{m.body}</Text>
                <Text style={s.bubbleDate}>{new Date(m.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.label}>FOLLOW-UP MESSAGE</Text>
        <TextInput style={s.input} value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Ask a follow-up question…" placeholderTextColor={C.muted} />
        <Pressable accessibilityRole="button" style={[s.primary, sending && s.primaryMuted]} onPress={() => void send()} disabled={sending}>
          <Text style={s.primaryText}>{sending ? 'SENDING…' : 'SEND'}</Text>
          <Lucide name="send" color={C.black} size={16} />
        </Pressable>
      </FormScrollView>
    </ScreenFrame>
  );
}

const s = StyleSheet.create({
  content: { padding: L.mobileGutter, paddingBottom: 40 },
  note: { color: C.mutedStrong, fontSize: 10, lineHeight: 16, marginBottom: 14 },
  state: { color: C.muted, fontSize: 11, paddingVertical: 16 },
  thread: { gap: 10, marginBottom: 18 },
  bubble: { padding: 11, borderWidth: 1, maxWidth: '88%' },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#10150C', borderColor: '#526F2B' },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: C.card, borderColor: C.borderStrong },
  bubbleLabel: { color: C.lime, fontFamily: F.extraBold, fontSize: 6.5, letterSpacing: 0.8 },
  bubbleBody: { color: C.white, fontSize: 11, lineHeight: 16, marginTop: 4 },
  bubbleDate: { color: C.muted, fontSize: 7.5, marginTop: 6 },
  label: { color: C.lime, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 1, marginBottom: 7 },
  input: { minHeight: 90, borderWidth: 1, borderColor: C.borderStrong, color: C.white, paddingHorizontal: 12, paddingTop: 10, fontSize: 13, textAlignVertical: 'top' },
  primary: { height: 50, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 14 },
  primaryMuted: { opacity: 0.6 },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 0.8 },
});
