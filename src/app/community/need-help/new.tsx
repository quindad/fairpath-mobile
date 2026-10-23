import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { notify } from '@/core/ui/notify';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { COMMUNITY_HELP_CATEGORIES, COMMUNITY_URGENCY, type CommunityHelpCategoryId, type CommunityHelpUrgency } from '@/core/community/categories';
import { createCommunityHelpRequest } from '@/core/community/community-help-service';
import { syncCommunityRequestPlan } from '@/core/opportunity/community-plan-sync';

function defaultExpiry(urgency: CommunityHelpUrgency): string {
  const d = new Date();
  if (urgency === 'today') d.setHours(d.getHours() + 36);
  else if (urgency === 'this_week') d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 14);
  return d.toISOString();
}

export default function NewCommunityRequestScreen() {
  const [category, setCategory] = useState<CommunityHelpCategoryId>('groceries');
  const [description, setDescription] = useState('');
  const [household, setHousehold] = useState('');
  const [urgency, setUrgency] = useState<CommunityHelpUrgency>('today');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [pickupOk, setPickupOk] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    if (description.trim().length < 10) {
      notify('Add a short description', 'Tell the community what you need in plain language.');
      return;
    }
    if (!city.trim() || state.trim().length < 2) {
      notify('Add approximate location', 'City and state are enough — never your exact home address.');
      return;
    }
    setSaving(true);
    try {
      const row = await createCommunityHelpRequest({
        category,
        description: description.trim(),
        householdSize: household ? Number(household) : null,
        urgency,
        city: city.trim(),
        state: state.trim(),
        postalCode: postal.trim() || undefined,
        pickupOk,
        deliveryPreferred: false,
        expiresAt: defaultExpiry(urgency),
      });
      await syncCommunityRequestPlan({ requestId: row.id, description: row.description, status: row.status });
      notify('Request posted', 'FairPath will show resources and community offers that may fit.');
      router.replace(('/community/need-help/' + row.id) as never);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('SIGNED_OUT')) router.push('/sign-in?returnTo=/community/need-help/new' as never);
      else if (msg.includes('TOO_MANY_OPEN')) notify('Too many open requests', 'Close or fulfill an existing request before posting another.');
      else if (msg.includes('DUPLICATE_REQUEST')) notify('Similar request recently', 'You already posted something like this in the last day.');
      else notify('Could not post request', 'Try again shortly.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="I NEED HELP" title="New request" backTo="/community/need-help" />
      <FormScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.help}>Share only what you are comfortable making visible to nearby helpers. No income proof, criminal history, or Opportunity Profile details.</Text>
        <Text style={s.label}>CATEGORY</Text>
        <View style={s.chips}>
          {COMMUNITY_HELP_CATEGORIES.map((c) => (
            <Pressable key={c.id} style={[s.chip, category === c.id && s.chipOn]} onPress={() => setCategory(c.id)}>
              <Text style={[s.chipText, category === c.id && s.chipTextOn]}>{c.label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>DESCRIPTION</Text>
        <TextInput value={description} onChangeText={setDescription} style={s.area} multiline maxLength={500} placeholder="Example: My family needs groceries tonight." placeholderTextColor={C.muted} />
        <Text style={s.label}>URGENCY</Text>
        <View style={s.chips}>
          {COMMUNITY_URGENCY.map((u) => (
            <Pressable key={u.id} style={[s.chip, urgency === u.id && s.chipOn]} onPress={() => setUrgency(u.id)}>
              <Text style={[s.chipText, urgency === u.id && s.chipTextOn]}>{u.label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>HOUSEHOLD SIZE (OPTIONAL)</Text>
        <TextInput value={household} onChangeText={(v) => setHousehold(v.replace(/\D/g, '').slice(0, 2))} style={s.field} keyboardType="number-pad" placeholder="Optional" placeholderTextColor={C.muted} />
        <Text style={s.label}>APPROXIMATE LOCATION</Text>
        <View style={s.row}>
          <TextInput value={city} onChangeText={setCity} style={[s.field, { flex: 1 }]} placeholder="City" placeholderTextColor={C.muted} />
          <TextInput value={state} onChangeText={(v) => setState(v.toUpperCase().slice(0, 2))} style={[s.field, { width: 72 }]} placeholder="OH" placeholderTextColor={C.muted} />
        </View>
        <TextInput value={postal} onChangeText={(v) => setPostal(v.replace(/\D/g, '').slice(0, 5))} style={s.field} placeholder="ZIP (optional)" placeholderTextColor={C.muted} keyboardType="number-pad" />
        <Pressable style={s.toggle} onPress={() => setPickupOk((v) => !v)}>
          <Text style={s.toggleText}>{pickupOk ? '✓ ' : ''}I can pick up nearby</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Posting request' : 'Post request'}
          accessibilityState={{ disabled: saving }}
          style={[s.publish, saving && s.disabled]}
          disabled={saving}
          onPress={() => void submit()}
        >
          <Text style={s.publishText}>{saving ? 'Posting…' : 'Post request'}</Text>
        </Pressable>
      </FormScrollView>
    </ScreenFrame>
  );
}

const s = {
  scroll: { flex: 1 },
  content: { padding: L.mobileGutter, paddingBottom: 40 },
  help: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  label: { color: C.lime, fontFamily: F.extraBold, fontSize: 12, marginTop: 14, marginBottom: 6 },
  field: { minHeight: 44, borderWidth: 1, borderColor: C.borderStrong, color: C.white, paddingHorizontal: 12, fontSize: 14, marginBottom: 6 },
  area: { minHeight: 100, borderWidth: 1, borderColor: C.borderStrong, color: C.white, padding: 12, fontSize: 14, textAlignVertical: 'top' as const },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  chip: { borderWidth: 1, borderColor: C.borderStrong, paddingHorizontal: 8, paddingVertical: 8 },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { color: C.mutedStrong, fontFamily: F.extraBold, fontSize: 12 },
  chipTextOn: { color: C.black },
  row: { flexDirection: 'row' as const, gap: 8 },
  toggle: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: C.borderStrong },
  toggleText: { color: C.white, fontSize: 13 },
  publish: { minHeight: 48, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 18, paddingHorizontal: 16 },
  publishText: { color: C.black, fontFamily: F.extraBold, fontSize: 13 },
  disabled: { opacity: 0.55 },
};
