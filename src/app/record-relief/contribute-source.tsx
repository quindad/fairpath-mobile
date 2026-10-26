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
import { validateRecordReliefSourcePayload } from '@/core/community/contribution-validation';
import { isSignedIn } from '@/core/resources/resources-service';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

export default function RecordReliefContributeSourceScreen() {
  const { jurisdiction, relief } = useLocalSearchParams<{ jurisdiction?: string; relief?: string }>();
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [stateCode, setStateCode] = useState(jurisdiction ?? '');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');
  const [court, setCourt] = useState('');
  const [reliefType, setReliefType] = useState(relief ?? '');
  const [formUrl, setFormUrl] = useState('');
  const [instructionsUrl, setInstructionsUrl] = useState('');
  const [correction, setCorrection] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    communityContributionsBackendReady().then(setReady).catch(() => setReady(false));
  }, []);

  async function submit() {
    if (!(await isSignedIn())) {
      router.push('/sign-in?returnTo=%2Frecord-relief%2Fcontribute-source' as never);
      return;
    }
    const payload = {
      jurisdiction_code: stateCode,
      county,
      city,
      court_name: court,
      relief_type: reliefType,
      official_form_url: formUrl,
      filing_instructions_url: instructionsUrl,
      proposed_correction: correction,
    };
    const err = validateRecordReliefSourcePayload(payload);
    if (err) {
      notify('Cannot submit', err);
      return;
    }
    setBusy(true);
    try {
      await submitCommunityContribution({
        kind: 'record_relief_source',
        jurisdictionCode: stateCode,
        payload,
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
      <PageHeader eyebrow="RECORD RELIEF" title="Help improve FairPath" backTo="/record-relief" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={s.lead}>
          Share official court forms or filing instructions. Do not upload personal court records or case details. Community
          submissions never change eligibility rules automatically.
        </Text>
        {ready === false ? <Text style={s.meta}>Source contributions are not enabled until the migration is applied.</Text> : null}
        {done ? (
          <View style={s.box}>
            <Text style={s.boxTitle}>Thank you</Text>
            <Text style={s.body}>FairPath will review your source before it can become verified filing guidance.</Text>
          </View>
        ) : (
          <>
            <Field label="State / jurisdiction code" value={stateCode} onChangeText={setStateCode} tokens={tokens} />
            <Field label="County (if applicable)" value={county} onChangeText={setCounty} tokens={tokens} />
            <Field label="City (if applicable)" value={city} onChangeText={setCity} tokens={tokens} />
            <Field label="Court name" value={court} onChangeText={setCourt} tokens={tokens} />
            <Field label="Relief type" value={reliefType} onChangeText={setReliefType} tokens={tokens} />
            <Field label="Official form URL" value={formUrl} onChangeText={setFormUrl} tokens={tokens} />
            <Field label="Filing instructions URL" value={instructionsUrl} onChangeText={setInstructionsUrl} tokens={tokens} />
            <Field label="Proposed correction (optional)" value={correction} onChangeText={setCorrection} tokens={tokens} multiline />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Show as anonymous</Text>
              <Switch value={anonymous} onValueChange={setAnonymous} />
            </View>
            <Pressable accessibilityRole="button" disabled={busy || ready === false} style={s.primary} onPress={() => void submit()}>
              <Text style={s.primaryText}>SUBMIT SOURCE FOR REVIEW</Text>
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
      <TextInput style={[s.input, props.multiline && s.inputMulti]} value={props.value} onChangeText={props.onChangeText} placeholderTextColor={props.tokens.textMuted} multiline={props.multiline} />
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 36 },
  lead: { color: t.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 16 },
  meta: { color: t.warning, fontSize: 12, marginBottom: 12 },
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
