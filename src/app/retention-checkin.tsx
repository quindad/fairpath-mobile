import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { notify } from '@/core/ui/notify';
import { FormScrollView } from '@/components/FormScrollView';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { CHECKPOINT_LABELS, RetentionCheckpoint, SUPPORT_CATEGORIES, confirmEnded, confirmStillWorking, loadMyCheckpoint, loadMyDueCheckpoints, requestSupport } from '@/core/retention/retention-service';

type Step = 'ask' | 'support_category' | 'support_detail' | 'done';

export default function RetentionCheckinScreen() {
 const params = useLocalSearchParams<{ checkpoint?: string }>();
 const [checkpoints, setCheckpoints] = useState<RetentionCheckpoint[]>([]);
 const [active, setActive] = useState<RetentionCheckpoint | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [step, setStep] = useState<Step>('ask');
 const [category, setCategory] = useState<string | null>(null);
 const [detail, setDetail] = useState('');
 const [saving, setSaving] = useState(false);

 const load = useCallback(() => {
  setLoading(true); setError(''); setStep('ask'); setCategory(null); setDetail('');
  const single = params.checkpoint ? loadMyCheckpoint(params.checkpoint) : Promise.resolve(null);
  Promise.all([single, loadMyDueCheckpoints()])
   .then(([one, due]) => { setCheckpoints(due); setActive(one ?? due[0] ?? null); })
   .catch((e) => setError(e?.message === 'SIGNED_OUT' ? 'Sign in to check in.' : 'Could not load your check-in.'))
   .finally(() => setLoading(false));
 }, [params.checkpoint]);
 useFocusEffect(useCallback(() => { load(); }, [load]));

 async function stillWorking() {
  if (!active) return;
  setSaving(true);
  try { await confirmStillWorking(active.id); setStep('done'); }
  catch { notify('Could not save', 'Please try again.'); }
  finally { setSaving(false); }
 }
 async function noLongerWorking() {
  if (!active) return;
  notify('No longer working here?', 'This updates your FairPath retention record.', [
   { text: 'Cancel', style: 'cancel' },
   { text: 'Confirm', style: 'destructive', onPress: async () => {
     setSaving(true);
     try { await confirmEnded(active.id); setStep('done'); }
     catch { notify('Could not save', 'Please try again.'); }
     finally { setSaving(false); }
   } },
  ]);
 }
 async function submitSupport() {
  if (!active || !category) return;
  setSaving(true);
  try { await requestSupport(active.id, category, detail.trim() || null); setStep('done'); }
  catch { notify('Could not save', 'Please try again.'); }
  finally { setSaving(false); }
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH" title="Job check-in" backTo="/home" />
  <FormScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
   {loading ? <Text style={s.state}>Loading…</Text> : error ? <Text style={s.state}>{error}</Text> : !active ? (
    <View style={s.empty}><Lucide name="check-circle" color={C.lime} size={22} /><Text style={s.emptyTitle}>NOTHING DUE RIGHT NOW</Text><Text style={s.emptyBody}>We'll check back in with you when your next job check-in is due.</Text></View>
   ) : step === 'done' ? (
    <View style={s.empty}><Lucide name="check-circle" color={C.lime} size={22} /><Text style={s.emptyTitle}>THANKS FOR LETTING US KNOW</Text><Text style={s.emptyBody}>Your {CHECKPOINT_LABELS[active.checkpoint_type] ?? active.checkpoint_type} check-in is saved.</Text>
     {checkpoints.length > 1 ? <Pressable style={s.secondary} onPress={() => { const next = checkpoints.find((c) => c.id !== active.id); setActive(next ?? null); setStep('ask'); }}><Text style={s.secondaryText}>NEXT CHECK-IN</Text></Pressable> : null}
    </View>
   ) : step === 'ask' ? (<>
    <Text style={s.eyebrow}>{(CHECKPOINT_LABELS[active.checkpoint_type] ?? active.checkpoint_type).toUpperCase()} CHECK-IN</Text>
    <Text style={s.question}>How's the job going?</Text>
    <Pressable style={s.optionPrimary} onPress={() => void stillWorking()} disabled={saving}><Lucide name="check" color={C.black} size={16} /><Text style={s.optionPrimaryText}>STILL WORKING HERE</Text></Pressable>
    <Pressable style={s.option} onPress={() => setStep('support_category')} disabled={saving}><Lucide name="life-buoy" color={C.white} size={16} /><Text style={s.optionText}>I NEED SUPPORT</Text></Pressable>
    <Pressable style={s.option} onPress={() => void noLongerWorking()} disabled={saving}><Lucide name="x" color={C.mutedStrong} size={16} /><Text style={s.optionText}>I'M NO LONGER WORKING HERE</Text></Pressable>
    <Text style={s.privacyNote}>If you need support, what you share stays private to you and any organization already authorized to help you - your employer only ever sees that support is available, never the details.</Text>
   </>) : step === 'support_category' ? (<>
    <Text style={s.eyebrow}>WHAT KIND OF SUPPORT?</Text>
    <View style={s.grid}>{SUPPORT_CATEGORIES.map((c) => (
     <Pressable key={c.code} style={[s.choice, category === c.code && s.choiceOn]} onPress={() => setCategory(c.code)}><Text style={[s.choiceText, category === c.code && s.choiceTextOn]}>{c.label.toUpperCase()}</Text></Pressable>
    ))}</View>
    <Pressable style={[s.optionPrimary, !category && s.optionDisabled]} disabled={!category} onPress={() => setStep('support_detail')}><Text style={s.optionPrimaryText}>CONTINUE</Text></Pressable>
   </>) : (<>
    <Text style={s.eyebrow}>TELL US MORE (OPTIONAL)</Text>
    <TextInput style={s.textarea} value={detail} onChangeText={setDetail} multiline placeholder="What's going on? This stays private." placeholderTextColor={C.muted} />
    <Pressable style={s.optionPrimary} onPress={() => void submitSupport()} disabled={saving}><Text style={s.optionPrimaryText}>{saving ? 'SENDING…' : 'SEND'}</Text></Pressable>
   </>)}
  </FormScrollView>
 </ScreenFrame>;
}

const s = StyleSheet.create({
 content: { padding: L.mobileGutter, paddingBottom: 40 },
 state: { color: C.mutedStrong, fontSize: 11, paddingVertical: 40, textAlign: 'center' },
 eyebrow: { color: C.lime, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 1.1, marginBottom: 8 },
 question: { color: C.white, fontFamily: F.extraBold, fontSize: 22, marginBottom: 22 },
 optionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.lime, borderRadius: 4, paddingVertical: 15, marginBottom: 10 },
 optionPrimaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.4 },
 optionDisabled: { opacity: 0.4 },
 option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 4, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 10 },
 optionText: { color: C.white, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.4 },
 privacyNote: { color: C.muted, fontSize: 9.5, lineHeight: 15, marginTop: 14 },
 grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
 choice: { borderWidth: 1, borderColor: C.borderStrong, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 14 },
 choiceOn: { borderColor: C.lime, backgroundColor: C.surface },
 choiceText: { color: C.mutedStrong, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 0.5 },
 choiceTextOn: { color: C.lime },
 textarea: { borderWidth: 1, borderColor: C.borderStrong, borderRadius: 4, color: C.white, fontSize: 12, padding: 14, minHeight: 110, textAlignVertical: 'top', marginBottom: 18 },
 empty: { alignItems: 'center', gap: 10, paddingVertical: 48 },
 emptyTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 0.6 },
 emptyBody: { color: C.mutedStrong, fontSize: 10.5, lineHeight: 16, textAlign: 'center', paddingHorizontal: 20 },
 secondary: { marginTop: 18, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 20 },
 secondaryText: { color: C.white, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.6 },
});
