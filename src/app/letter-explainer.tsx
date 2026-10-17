import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { explainLetterPhoto } from '@/core/ai/signal';
import { bytesToBase64 } from '@/core/documents/bytes';
import { notify } from '@/core/ui/notify';
import { supabase } from '@/lib/supabase';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export default function LetterExplainerScreen() {
  const [context, setContext] = useState('');
  const [fileLabel, setFileLabel] = useState('');
  const [picked, setPicked] = useState<{ uri: string; mimeType: string } | null>(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function pickPhoto() {
    const res = await DocumentPicker.getDocumentAsync({
      type: IMAGE_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const mime = (a.mimeType ?? 'image/jpeg').toLowerCase();
    if (!mime.startsWith('image/')) {
      notify('Photos only', 'Use a clear photo of the letter. PDFs are not supported here yet.');
      return;
    }
    setPicked({ uri: a.uri, mimeType: mime });
    setFileLabel(a.name ?? 'Photo selected');
    setResult('');
  }

  async function runExplain() {
    if (!picked || loading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(('/sign-up?returnTo=' + encodeURIComponent('/letter-explainer')) as never);
      return;
    }
    setLoading(true);
    try {
      const bytes = new Uint8Array(await (await fetch(picked.uri)).arrayBuffer());
      if (bytes.length > 4 * 1024 * 1024) {
        notify('Photo too large', 'Try a closer crop or lower resolution.');
        return;
      }
      const base64 = bytesToBase64(bytes);
      const r = await explainLetterPhoto(picked.mimeType, base64, context.trim());
      if (r.status === 'ok') setResult(r.text);
      else if (r.status === 'out_of_credits') setResult('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setResult('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') router.push(('/sign-up?returnTo=' + encodeURIComponent('/letter-explainer')) as never);
      else setResult(r.status === 'error' ? r.message : 'Signal could not read this photo right now.');
    } catch {
      setResult('Signal could not read this photo right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="SIGNAL" title="Explain a letter" backTo="/credit" />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.lead}>
          Take a clear photo of mail or a notice (bureau, court, landlord, etc.). Signal summarizes what it says in plain English. This is not legal advice.
        </Text>
        <Text style={s.label}>OPTIONAL CONTEXT</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. I got this after a dispute"
          placeholderTextColor={C.muted}
          value={context}
          onChangeText={setContext}
          multiline
        />
        <Pressable accessibilityRole="button" style={s.pickBtn} onPress={() => void pickPhoto()}>
          <Text style={s.pickBtnText}>{fileLabel || 'CHOOSE PHOTO'}</Text>
        </Pressable>
        {picked ? (
          <Pressable accessibilityRole="button" style={[s.runBtn, loading && s.runBtnDisabled]} onPress={() => void runExplain()} disabled={loading}>
            {loading ? <ActivityIndicator color={C.black} /> : <Text style={s.runBtnText}>EXPLAIN WITH SIGNAL · 2 CREDITS</Text>}
          </Pressable>
        ) : null}
        {result ? (
          <View style={s.resultBox}>
            <Text style={s.resultLabel}>SUMMARY</Text>
            <Text style={s.resultText}>{result}</Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: L.mobileGutter, paddingTop: 16, paddingBottom: 32 },
  lead: { color: C.mutedStrong, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  label: { color: C.muted, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 1, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: C.border, color: C.white, fontSize: 13, padding: 12, minHeight: 72, textAlignVertical: 'top', marginBottom: 16,
  },
  pickBtn: { height: 44, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  pickBtnText: { color: C.lime, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  runBtn: { height: 48, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  runBtnDisabled: { opacity: 0.7 },
  runBtnText: { color: C.black, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  resultBox: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 },
  resultLabel: { color: C.muted, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 1, marginBottom: 8 },
  resultText: { color: C.mutedStrong, fontSize: 13, lineHeight: 20 },
});
