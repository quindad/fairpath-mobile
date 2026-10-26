import { router, useLocalSearchParams } from 'expo-router';
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
import { validateResourceEditPayload } from '@/core/community/contribution-validation';
import { isSignedIn, loadResourceDetail } from '@/core/resources/resources-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

export default function SuggestResourceEditScreen() {
  const { resourceId } = useLocalSearchParams<{ resourceId?: string }>();
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [title, setTitle] = useState('');
  const [change, setChange] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    communityContributionsBackendReady().then(setReady).catch(() => setReady(false));
  }, []);

  useEffect(() => {
    if (!resourceId) return;
    loadResourceDetail(resourceId).then((r) => r && setTitle(r.title)).catch(() => {});
  }, [resourceId]);

  async function submit() {
    if (!resourceId) {
      notify('Missing resource', 'Open this form from a resource detail page.');
      return;
    }
    if (!(await isSignedIn())) {
      router.push(('/sign-in?returnTo=' + encodeURIComponent('/resources/contribute/suggest-edit?resourceId=' + resourceId)) as never);
      return;
    }
    const payload = { resource_title: title, proposed_change: change, source_url: sourceUrl };
    const err = validateResourceEditPayload(payload);
    if (err) {
      notify('Missing information', err);
      return;
    }
    setBusy(true);
    try {
      await submitCommunityContribution({
        kind: 'resource_edit',
        resourceId,
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
      <PageHeader eyebrow="RESOURCE CENTER" title="Suggest an edit" backTo={resourceId ? `/resource/${resourceId}` : '/resources'} />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={s.lead}>Corrections are reviewed by FairPath. Verified listings do not change until approval.</Text>
        {ready === false ? <Text style={s.meta}>Contributions are not enabled until the migration is applied.</Text> : null}
        {done ? (
          <View style={s.box}>
            <Text style={s.boxTitle}>Thank you</Text>
            <Text style={s.body}>Your edit suggestion is pending review.</Text>
          </View>
        ) : (
          <>
            <Text style={s.label}>Resource</Text>
            <Text style={s.resourceTitle}>{title || 'Loading…'}</Text>
            <Field label="What should change?" value={change} onChangeText={setChange} tokens={tokens} multiline />
            <Field label="Official source link" value={sourceUrl} onChangeText={setSourceUrl} tokens={tokens} />
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

function Field(props: { label: string; value: string; onChangeText: (t: string) => void; tokens: ThemeTokens; multiline?: boolean }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.field}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        style={[s.input, props.multiline && s.inputMulti]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholderTextColor={props.tokens.textMuted}
        multiline={props.multiline}
      />
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 36 },
  lead: { color: t.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 16 },
  meta: { color: t.warning, fontSize: 12, marginBottom: 12 },
  resourceTitle: { color: t.text, fontFamily: F.bold, fontSize: 15, marginBottom: 12 },
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
  body: { color: t.textSecondary, fontSize: 14, lineHeight: 21 },
});
