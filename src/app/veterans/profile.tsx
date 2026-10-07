import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle, SharpChip } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { BRANCHES, type BranchId } from '@/core/veterans/branches';
import { SERVICE_PROFILE_FIELDS, type ServiceProfileField } from '@/core/veterans/service-profile';
import {
  consented, emptyProfile, parseProfile, serializeProfile, setConsent, setValue, VETERAN_PROFILE_KEY,
  type VeteranProfile,
} from '@/core/veterans/profile-store';

type Load = 'loading' | 'ready' | 'error';
const COMPONENTS: { id: 'active' | 'reserve' | 'national_guard'; label: string }[] = [
  { id: 'active', label: 'Active Duty' },
  { id: 'reserve', label: 'Reserve' },
  { id: 'national_guard', label: 'National Guard' },
];

export default function VeteranProfileScreen() {
  const s = useThemedStyles(styles);
  const [load, setLoad] = useState<Load>('loading');
  const [profile, setProfile] = useState<VeteranProfile>(emptyProfile(new Date().toISOString()));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(VETERAN_PROFILE_KEY)
      .then((raw) => { if (alive) { setProfile(parseProfile(raw, new Date().toISOString())); setLoad('ready'); } })
      .catch(() => { if (alive) setLoad('error'); });
    return () => { alive = false; };
  }, []);

  const save = async (next: VeteranProfile) => {
    setProfile(next);
    try {
      await AsyncStorage.setItem(VETERAN_PROFILE_KEY, serializeProfile(next));
      setMessage(null);
    } catch {
      setMessage('Your changes could not be saved on this device. Try again.');
    }
  };

  const now = () => new Date().toISOString();
  const toggleBranch = (id: BranchId) => save({ ...profile, branch: profile.branch === id ? null : id, updatedAt: now() });
  const toggleComponent = (id: 'active' | 'reserve' | 'national_guard') => {
    const has = profile.components.includes(id);
    save({ ...profile, components: has ? profile.components.filter((c) => c !== id) : [...profile.components, id], updatedAt: now() });
  };

  return (
    <ScreenFrame>
      <PageHeader eyebrow="VETERANS · IN DEVELOPMENT" title="Service profile" backTo="/veterans" />
      <FormScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Everything here is optional</Text>
          <Text style={s.body}>
            You can browse Veterans resources without filling this in. Each detail is shared only if you turn on its consent switch. You can turn any of them off again at any time, and the stored value is removed.
          </Text>
        </View>

        {load === 'loading' ? <Text style={s.body} accessibilityLiveRegion="polite">Loading your profile…</Text> : null}
        {load === 'error' ? <Text style={s.error} accessibilityRole="alert">Your profile could not be loaded on this device.</Text> : null}

        {load === 'ready' ? (
          <>
            <SectionTitle>Branch</SectionTitle>
            <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Military branch">
              {BRANCHES.map((b) => (
                <SharpChip key={b.id} label={b.officialName.replace('United States ', '')} active={profile.branch === b.id} onPress={() => toggleBranch(b.id)} />
              ))}
            </View>

            <SectionTitle>Service component</SectionTitle>
            <View style={s.chips}>
              {COMPONENTS.map((c) => (
                <SharpChip key={c.id} label={c.label} active={profile.components.includes(c.id)} onPress={() => toggleComponent(c.id)} />
              ))}
            </View>

            <SectionTitle>Details and consent</SectionTitle>
            {SERVICE_PROFILE_FIELDS.map((f) => (
              <FieldRow
                key={f.field}
                label={f.label}
                field={f.field}
                profile={profile}
                onConsent={(granted) => save(setConsent(profile, f.field, granted, now()))}
                onValue={(v) => save(setValue(profile, f.field, v, now()))}
                value={profile.values[f.field] ?? ''}
              />
            ))}
          </>
        ) : null}

        {message ? <Text style={s.error} accessibilityRole="alert">{message}</Text> : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

function FieldRow({ label, field, profile, onConsent, onValue, value }: {
  label: string; field: ServiceProfileField; profile: VeteranProfile;
  onConsent: (granted: boolean) => void; onValue: (v: string) => void; value: string;
}) {
  const s = useThemedStyles(styles);
  const on = consented(profile, field);
  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.cardTitle}>{label}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`Share ${label} with my FairPath profile`}
          accessibilityState={{ checked: on }}
          onPress={() => onConsent(!on)}
          style={on ? s.switchOn : s.switchOff}
        >
          <Text style={on ? s.switchOnText : s.switchOffText}>{on ? 'On' : 'Off'}</Text>
        </Pressable>
      </View>
      {on ? (
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onValue}
          accessibilityLabel={label}
          placeholder="Optional"
          placeholderTextColor={s.placeholder.color}
        />
      ) : (
        <Text style={s.meta}>Turn on to add this detail.</Text>
      )}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const, borderLeftWidth: 3, borderLeftColor: t.accent, padding: 12 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15, flexShrink: 1 },
  rowBetween: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 8 },
  meta: { color: t.textMuted, fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, paddingHorizontal: 12, fontSize: 16 },
  placeholder: { color: t.textMuted },
  switchOn: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  switchOnText: { color: t.onAccent, fontWeight: '700' as const },
  switchOff: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: t.borderStrong },
  switchOffText: { color: t.textSecondary, fontWeight: '700' as const },
});
