import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { DEFAULT_SEARCH_RADIUS_MILES, loadLocationSettings, saveLocationSettings } from '@/core/profile/location-service';

const RADIUS_OPTIONS = [10, 25, 50, 100];

export default function LocationSetup() {
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(DEFAULT_SEARCH_RADIUS_MILES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadLocationSettings()
      .then((s) => {
        if (!active) return;
        setZip(s.zip_code ?? '');
        setRadius(s.search_radius_miles);
      })
      .catch((e) => {
        if (e instanceof Error && e.message === 'SIGNED_OUT') {
          router.replace(('/sign-up?returnTo=' + encodeURIComponent('/location-setup')) as never);
          return;
        }
        // Migrations may not be applied to the live project yet — the
        // screen still renders with sensible defaults rather than
        // getting stuck on a loading spinner.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const zipValid = /^\d{5}$/.test(zip.trim());

  async function save() {
    if (!zipValid || saving) return;
    setSaving(true);
    try {
      await saveLocationSettings({ zipCode: zip.trim(), radiusMiles: radius });
      notify('Location saved', 'FairPath will use this to find opportunities near you.');
      router.back();
    } catch (e) {
      if (e instanceof Error && e.message === 'SIGNED_OUT') {
        router.replace(('/sign-up?returnTo=' + encodeURIComponent('/location-setup')) as never);
        return;
      }
      notify('Could not save location', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FAIRPATH" title="Your location" backTo="/me" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.intro}>
          Used to find Jobs and Housing near you. Optional — you can browse without it, and change it anytime.
        </Text>

        <Text style={s.label}>ZIP CODE</Text>
        <TextInput
          value={zip}
          onChangeText={(v) => setZip(v.replace(/\D/g, '').slice(0, 5))}
          style={s.input}
          placeholder="12345"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          maxLength={5}
        />

        <Text style={s.label}>SEARCH RADIUS</Text>
        <View style={s.radiusRow}>
          {RADIUS_OPTIONS.map((mi) => (
            <Pressable
              key={mi}
              style={[s.chip, radius === mi && s.chipActive]}
              onPress={() => setRadius(mi)}
            >
              <Text style={[s.chipText, radius === mi && s.chipTextActive]}>{mi} mi</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>Default is {DEFAULT_SEARCH_RADIUS_MILES} miles. You can widen this anytime — FairPath will also suggest widening it if your area has limited local inventory.</Text>

        <Pressable
          style={[s.primary, (!zipValid || saving || loading) && s.primaryDisabled]}
          onPress={() => void save()}
          disabled={!zipValid || saving || loading}
        >
          <Text style={s.primaryText}>{saving ? 'SAVING…' : 'SAVE LOCATION'}</Text>
        </Pressable>
      </ScrollView>
    </ScreenFrame>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: L.mobileGutter, paddingTop: 16, paddingBottom: 40 },
  intro: { color: C.mutedStrong, fontSize: 13, lineHeight: 19 },
  label: { color: C.lime, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.2, marginTop: 22, marginBottom: 9 },
  input: { height: 52, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.card, color: C.white, fontFamily: F.bold, fontSize: 18, paddingHorizontal: 14 },
  radiusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { height: 38, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.black },
  chipActive: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { color: C.mutedStrong, fontFamily: F.bold, fontSize: 12 },
  chipTextActive: { color: C.black, fontFamily: F.extraBold },
  note: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 10 },
  primary: { height: 52, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  primaryDisabled: { backgroundColor: '#1B201A', borderWidth: 1, borderColor: '#303630' },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 0.9 },
});
