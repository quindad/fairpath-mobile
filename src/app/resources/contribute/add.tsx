import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
  communityContributionsBackendReady,
  contributionActionMessage,
  submitCommunityContribution,
} from '@/core/community/community-contributions';
import { validateResourceAddPayload } from '@/core/community/contribution-validation';
import { isSignedIn } from '@/core/resources/resources-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

export default function AddResourceContributionScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    communityContributionsBackendReady().then(setReady).catch(() => setReady(false));
  }, []);

  async function submit() {
    if (!(await isSignedIn())) {
      router.push('/sign-in?returnTo=%2Fresources%2Fcontribute%2Fadd' as never);
      return;
    }
    const payload = {
      resource_name: name,
      category_slug: category,
      service_area: serviceArea,
      description,
      official_website: website,
      contact_phone: phone,
    };
    const err = validateResourceAddPayload(payload);
    if (err) {
      notify('Missing information', err);
      return;
    }
    setBusy(true);
    try {
      await submitCommunityContribution({
        kind: 'resource_add',
        payload,
        displayName: anonymous ? null : displayName,
        anonymous,
      });
      setDone(true);
    } catch (e) {
      notify('Not submitted', contributionActionMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RESOURCE CENTER" title="Add a resource" backTo="/resources" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={s.lead}>Suggest a missing program. FairPath reviews every submission before it can appear as a verified listing.</Text>
        {ready === false ? (
          <Text style={s.meta}>Contributions are not enabled in this environment until the community contributions migration is applied.</Text>
        ) : null}
        {done ? (
          <View style={s.box}>
            <Text style={s.boxTitle}>Thank you</Text>
            <Text style={s.body}>Your suggestion is pending review. Nothing is published automatically.</Text>
            <Pressable accessibilityRole="button" style={s.primary} onPress={() => router.replace('/resources' as never)}>
              <Text style={s.primaryText}>BACK TO RESOURCES</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Field label="Resource name" value={name} onChangeText={setName} tokens={tokens} />
            <Field label="Category (e.g. food, housing)" value={category} onChangeText={setCategory} tokens={tokens} />
            <Field label="City, ZIP, or service area" value={serviceArea} onChangeText={setServiceArea} tokens={tokens} />
            <Field label="Description" value={description} onChangeText={setDescription} tokens={tokens} multiline />
            <Field label="Official website" value={website} onChangeText={setWebsite} tokens={tokens} />
            <Field label="Phone (optional)" value={phone} onChangeText={setPhone} tokens={tokens} />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Show as anonymous</Text>
              <Switch value={anonymous} onValueChange={setAnonymous} />
            </View>
            {!anonymous ? <Field label="Community display name" value={displayName} onChangeText={setDisplayName} tokens={tokens} /> : null}
            <Pressable accessibilityRole="button" disabled={busy || ready === false} style={s.primary} onPress={() => void submit()}>
              <Text style={s.primaryText}>SUBMIT FOR REVIEW</Text>
            </Pressable>
          </>
        )}
      </FormScrollView>
    </ScreenFrame>
  );
}

function Field({
  label,
  value,
  onChangeText,
  tokens,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  tokens: ThemeTokens;
  multiline?: boolean;
}) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={tokens.textMuted}
        multiline={multiline}
      />
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 36 },
  lead: { color: t.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 16 },
  meta: { color: t.warning, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.6, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, fontSize: 14, padding: 10, minHeight: 44 },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' as const },
  switchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginVertical: 12 },
  switchLabel: { color: t.text, fontSize: 13 },
  primary: { height: 48, backgroundColor: t.accent, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 8 },
  primaryText: { color: t.onAccent, fontFamily: F.extraBold, fontSize: 11, letterSpacing: 1 },
  box: { borderWidth: 1, borderColor: t.border, padding: 14, marginTop: 12 },
  boxTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 16, marginBottom: 8 },
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 12 },
});
