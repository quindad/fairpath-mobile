import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, Field, PrimaryButton, StatusLine } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { loadMyRecordStatement, saveMyRecordStatement, statementErrorMessage } from '@/core/record-relief/statement-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

const MAX = 3000;

export default function MyRecordStatement() {
  const { tokens } = useFairPathTheme();
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try { setBody(await loadMyRecordStatement()); setLoaded(true); }
      catch { setError('We could not load your statement.'); setLoaded(true); }
    })();
  }, []);

  async function save() {
    setBusy(true);
    try { await saveMyRecordStatement(body); setSaved(true); notify('Saved', 'Your statement is saved privately. It is never shown to anyone unless you choose to attach it to a specific application.'); }
    catch (e) { notify('Could not save', statementErrorMessage(e)); }
    finally { setBusy(false); }
  }

  if (!loaded) return <ScreenFrame><PageHeader eyebrow="RECORD RELIEF" title="Explain My Record" backTo="/record-relief" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;

  return (
    <ScreenFrame>
      <PageHeader eyebrow="RECORD RELIEF" title="Explain My Record" backTo="/record-relief" alwaysBackTo />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        <BodyText>
          Write this once, in your own words. It stays completely private — nothing here is ever shown to an employer, landlord, or anyone else
          unless you personally choose to attach it when you apply to a specific job or home. You decide every single time.
        </BodyText>
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        <View style={{ marginBottom: 12 }}><SectionTitle>YOUR STATEMENT</SectionTitle></View>
        <Field
          label={`YOUR STATEMENT (${body.length}/${MAX})`}
          value={body}
          onChangeText={(v) => { setBody(v.slice(0, MAX)); setSaved(false); }}
          multiline
          maxLength={MAX}
          optional
          placeholder="Example: In 2019 I was convicted of a felony. Since then I've completed my sentence, stayed out of the system, and I'm asking for a chance to show what I can do in this role."
        />
        <PrimaryButton label={saved ? 'SAVED' : 'SAVE STATEMENT'} onPress={() => void save()} busy={busy} disabled={saved} />
      </FormScrollView>
    </ScreenFrame>
  );
}
