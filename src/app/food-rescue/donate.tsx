import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { Lucide } from '@react-native-vector-icons/lucide';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FOOD_RESCUE_HOME, foodRescueItemRoute } from '@/core/community/food-rescue-nav';
import { publishFoodRescueDonation } from '@/core/food-rescue/food-rescue-service';
import { foodRescueErrorMessage } from '@/core/food-rescue/errors';
import { notify } from '@/core/ui/notify';

export default function FoodRescueDonateScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [bestByNote, setBestByNote] = useState('');
  const [pickupStart, setPickupStart] = useState('');
  const [pickupEnd, setPickupEnd] = useState('');
  const [storageNotes, setStorageNotes] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pickupArea, setPickupArea] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupState, setPickupState] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await publishFoodRescueDonation({
        title,
        description,
        quantity: Number(quantity) || 1,
        bestByNote,
        pickupWindowStart: pickupStart,
        pickupWindowEnd: pickupEnd,
        storageNotes,
        city,
        state,
        pickupArea,
        pickupCity,
        pickupState,
      });
      if (!result.ok) {
        if (result.reason === 'SIGNED_OUT') {
          router.push(('/sign-up?returnTo=' + encodeURIComponent('/food-rescue/donate')) as never);
          return;
        }
        if (result.reason.length > 3 && result.reason !== 'DONATION_FAILED') {
          notify('Finish the donation', result.reason);
          return;
        }
        const msg = foodRescueErrorMessage(result.reason);
        notify(msg.title, msg.body);
        return;
      }
      const note = result.moderationPending
        ? 'Submitted for review — it will appear in Food Rescue once approved.'
        : 'Neighbors can browse and claim it now.';
      notify(result.moderationPending ? 'Submitted for review' : 'Donation listed', note, [
        { text: 'View listing', onPress: () => router.replace(foodRescueItemRoute(result.itemId) as never) },
      ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FOOD RESCUE" title="Donate surplus food" backTo={FOOD_RESCUE_HOME} />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          List sealed, eligible surplus food for same-day pickup. Exact address stays private until someone is approved to pick up.
        </Text>

        <Label text="WHAT ARE YOU SHARING?" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={s.field}
          maxLength={100}
          placeholder="Example: Case of canned vegetables"
          placeholderTextColor={C.muted}
        />

        <Label text="DESCRIPTION" />
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={s.area}
          multiline
          maxLength={1500}
          textAlignVertical="top"
          placeholder="Packaging, count, allergens if known, anything useful at pickup."
          placeholderTextColor={C.muted}
        />

        <View style={s.two}>
          <View style={{ flex: 1 }}>
            <Label text="QUANTITY" />
            <TextInput
              value={quantity}
              onChangeText={(v) => setQuantity(v.replace(/\D/g, '').slice(0, 2))}
              style={s.field}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 2 }}>
            <Label text="BEST-BY / EXPIRATION" />
            <TextInput
              value={bestByNote}
              onChangeText={setBestByNote}
              style={s.field}
              placeholder="Best by 12/2026"
              placeholderTextColor={C.muted}
            />
          </View>
        </View>

        <Text style={s.sectionTitle}>TODAY&apos;S PICKUP WINDOW</Text>
        <Text style={s.sectionHelp}>When can a neighbor pick this up today?</Text>
        <View style={s.two}>
          <TextInput
            value={pickupStart}
            onChangeText={setPickupStart}
            style={[s.field, { flex: 1 }]}
            placeholder="Start · 3:00 PM"
            placeholderTextColor={C.muted}
          />
          <TextInput
            value={pickupEnd}
            onChangeText={setPickupEnd}
            style={[s.field, { flex: 1 }]}
            placeholder="End · 6:00 PM"
            placeholderTextColor={C.muted}
          />
        </View>

        <Label text="STORAGE NOTES (OPTIONAL)" />
        <TextInput
          value={storageNotes}
          onChangeText={setStorageNotes}
          style={s.areaSmall}
          multiline
          maxLength={400}
          textAlignVertical="top"
          placeholder="Refrigerated until pickup, kept in back room, etc."
          placeholderTextColor={C.muted}
        />

        <Text style={s.sectionTitle}>PUBLIC PICKUP AREA</Text>
        <Text style={s.sectionHelp}>Neighbors see only this approximate area before approval.</Text>
        <View style={s.two}>
          <TextInput value={city} onChangeText={setCity} style={[s.field, { flex: 1 }]} placeholder="City" placeholderTextColor={C.muted} />
          <TextInput
            value={state}
            onChangeText={(v) => setState(v.toUpperCase().slice(0, 2))}
            style={[s.field, { width: 78 }]}
            placeholder="OH"
            placeholderTextColor={C.muted}
          />
        </View>
        <TextInput
          value={pickupArea}
          onChangeText={setPickupArea}
          style={s.field}
          placeholder="Neighborhood label (optional)"
          placeholderTextColor={C.muted}
        />

        <Text style={s.sectionTitle}>PRIVATE PICKUP LOCATION</Text>
        <View style={s.two}>
          <TextInput value={pickupCity} onChangeText={setPickupCity} style={[s.field, { flex: 1 }]} placeholder="Pickup city" placeholderTextColor={C.muted} />
          <TextInput
            value={pickupState}
            onChangeText={(v) => setPickupState(v.toUpperCase().slice(0, 2))}
            style={[s.field, { width: 78 }]}
            placeholder="OH"
            placeholderTextColor={C.muted}
          />
        </View>

        <View style={s.rules}>
          <Lucide name="shield-alert" color={C.lime} size={17} />
          <View style={{ flex: 1 }}>
            <Text style={s.rulesTitle}>FOOD RESCUE RULES</Text>
            <Text style={s.rulesBody}>
              Sealed shelf-stable groceries and properly packaged eligible foods only. FairPath does not verify food safety — use judgment at pickup.
            </Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" style={[s.publish, saving && s.disabled]} disabled={saving} onPress={() => void submit()}>
          <Text style={s.publishText}>{saving ? 'PUBLISHING…' : 'PUBLISH FOOD RESCUE LISTING'}</Text>
          <Lucide name="arrow-right" color={C.black} size={16} />
        </Pressable>
      </FormScrollView>
    </ScreenFrame>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={s.label}>{text}</Text>;
}

const s = StyleSheet.create({
  content: { padding: L.mobileGutter, paddingBottom: 44 },
  intro: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.borderStrong },
  label: { color: C.lime, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  field: { minHeight: 46, borderWidth: 1, borderColor: C.borderStrong, color: C.white, paddingHorizontal: 11, fontSize: 11, marginBottom: 7 },
  area: { minHeight: 120, borderWidth: 1, borderColor: C.borderStrong, color: C.white, padding: 11, fontSize: 11 },
  areaSmall: { minHeight: 88, borderWidth: 1, borderColor: C.borderStrong, color: C.white, padding: 11, fontSize: 11, marginBottom: 7 },
  two: { flexDirection: 'row', gap: 8 },
  sectionTitle: { color: C.white, fontFamily: F.black, fontSize: 17, marginTop: 20 },
  sectionHelp: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 4, marginBottom: 8 },
  rules: { borderWidth: 1, borderColor: '#526F2B', backgroundColor: '#0F150B', padding: 13, flexDirection: 'row', gap: 10, marginTop: 22 },
  rulesTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 0.9 },
  rulesBody: { color: C.mutedStrong, fontSize: 8.5, lineHeight: 13, marginTop: 4 },
  publish: { height: 52, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 14 },
  publishText: { color: C.black, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 0.9 },
  disabled: { opacity: 0.55 },
});
