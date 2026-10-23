import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { BodyText, Panel, SecondaryButton, StatusLine } from '@/components/ui-kit';
import type { Job } from '@/core/jobs/jobs-service.ts';
import { evaluateJobProfileFit, type ProfileFitInputs } from '@/core/jobs/job-profile-fit.ts';
import { loadContact, loadCredentials, loadPreferences, loadSkills } from '@/core/profile/opportunity-service.ts';
import { FairPathFonts as F } from '@/constants/fairpath';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type Props = { job: Job };

export function JobProfileFitPanel({ job }: Props) {
  const s = useThemedStyles(styles);
  const [inputs, setInputs] = useState<ProfileFitInputs | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadSkills(), loadPreferences(), loadContact(), loadCredentials()])
      .then(([skills, prefs, contact, creds]) => {
        if (!alive) return;
        setInputs({
          skills: skills.map((x) => x.skill),
          desiredTitles: prefs.desired_titles,
          employmentTypes: prefs.employment_types,
          workplaceTypes: prefs.workplace_types,
          zipCode: contact.zip_code || null,
          credentialNames: creds.map((c) => c.name),
        });
      })
      .catch(() => {
        if (alive) setError('Could not load your profile for fit hints.');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <StatusLine tone="error">{error}</StatusLine>;
  if (!inputs) return null;

  const fit = evaluateJobProfileFit(job, inputs);
  const title =
    fit.band === 'strong' ? 'Strong profile match' : fit.band === 'moderate' ? 'Moderate profile match' : 'Worth exploring';

  return (
    <Panel>
      <Text style={s.title}>{title}</Text>
      <BodyText muted>
        Based on skills, interests, and preferences in your Opportunity Profile — not a background check. Conviction-aware
        insights are separate below when a published employer policy exists.
      </BodyText>
      {!expanded ? (
        <SecondaryButton label="WHY THIS JOB MAY FIT" onPress={() => setExpanded(true)} />
      ) : (
        <View style={s.list}>
          {fit.reasons.map((r) => (
            <Text key={r} style={s.item}>
              • {r}
            </Text>
          ))}
          {fit.gaps.map((g) => (
            <Text key={g} style={s.gap}>
              • {g}
            </Text>
          ))}
        </View>
      )}
    </Panel>
  );
}

const styles = (t: ThemeTokens) => ({
  title: { color: t.text, fontFamily: F.bold, fontSize: 16, marginBottom: 6 },
  list: { marginTop: 8, gap: 6 },
  item: { color: t.text, fontSize: 14, lineHeight: 20 },
  gap: { color: t.textMuted, fontSize: 14, lineHeight: 20 },
});
