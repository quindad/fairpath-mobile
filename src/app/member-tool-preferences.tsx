import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { BodyText, Panel, PrimaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import {
  loadMemberCapabilities,
  saveMemberCapabilities,
  type CapabilityChoice,
  type MemberCapabilities,
} from '@/core/profile/member-capabilities';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

const CHOICES: { value: CapabilityChoice; label: string; hint: string }[] = [
  { value: 'yes', label: 'Yes — show these tools', hint: 'FairPath may suggest Record Relief or Veterans workflows.' },
  { value: 'no', label: 'No — hide for now', hint: 'You can still use Jobs, Housing, and Resources like everyone else.' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', hint: 'Treated like No for showing specialized tools. Never shared as an employer label.' },
];

function ChoiceRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: CapabilityChoice;
  onChange: (v: CapabilityChoice) => void;
}) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{title}</Text>
      {CHOICES.map((c) => {
        const active = value === c.value;
        return (
          <Pressable
            key={c.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[s.choice, active && s.choiceActive]}
            onPress={() => onChange(c.value)}
          >
            <Text style={[s.choiceLabel, active && s.choiceLabelActive]}>{c.label}</Text>
            <BodyText muted>{c.hint}</BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MemberToolPreferencesScreen() {
  const s = useThemedStyles(styles);
  const [caps, setCaps] = useState<MemberCapabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      setError('');
      loadMemberCapabilities()
        .then((c) => setCaps(c ?? { justice: 'prefer_not_to_say', veteran: 'prefer_not_to_say' }))
        .catch(() => setError('Could not load your preferences.'));
    }, []),
  );

  async function save() {
    if (!caps || busy) return;
    setBusy(true);
    setError('');
    try {
      await saveMemberCapabilities(caps);
      notify('Saved', 'Home, Explore, Profile, and Signal will respect these choices after you refresh those screens.');
      router.back();
    } catch {
      setError('Could not save. Sign in and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="PRIVACY" title="FairPath tools" backTo="/me" />
      <ScreenScroll contentContainerStyle={s.content}>
        <Panel>
          <BodyText>
            These choices control whether FairPath shows Record Relief, justice records, and veteran-specific pages in your everyday experience. They do not block you from searching jobs or housing, and they are never employer-facing labels.
          </BodyText>
        </Panel>
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        {caps ? (
          <>
            <ChoiceRow
              title="Justice-impacted / record relief tools"
              value={caps.justice}
              onChange={(justice) => setCaps({ ...caps, justice })}
            />
            <ChoiceRow
              title="Veteran transition tools"
              value={caps.veteran}
              onChange={(veteran) => setCaps({ ...caps, veteran })}
            />
            <PrimaryButton label={busy ? 'Saving…' : 'Save preferences'} onPress={() => void save()} />
          </>
        ) : null}
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 32, gap: 16 },
  block: { gap: 10 },
  blockTitle: { color: t.text, fontWeight: '800' as const, fontSize: 15, marginTop: 8 },
  choice: { borderWidth: 1, borderColor: t.border, padding: 12, gap: 4, backgroundColor: t.surface },
  choiceActive: { borderColor: t.accent, backgroundColor: t.surface },
  choiceLabel: { color: t.text, fontWeight: '700' as const, fontSize: 14 },
  choiceLabelActive: { color: t.accentText },
});
