import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import type { Job } from '@/core/jobs/jobs-service';
import { evaluateJobJusticeCompatibility, type JobJusticeCompatibility } from '@/core/matching/member-job-justice-match';
import { BodyText, Panel, SecondaryButton, StatusLine } from '@/components/ui-kit';

const OUTCOME_LABEL: Record<string, string> = {
  appears_compatible: 'May fit this employer’s published criteria',
  individual_review_required: 'Individual review likely',
  confirmed_restriction: 'Policy may restrict something you shared',
  insufficient_information: 'More information needed',
};

export function JobJusticeCompatibilityPanel({ job }: { job: Job }) {
  const [row, setRow] = useState<JobJusticeCompatibility | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    evaluateJobJusticeCompatibility(job)
      .then((r) => {
        if (alive) setRow(r);
      })
      .catch(() => {
        if (alive) setError('Could not check compatibility with this employer’s policy.');
      });
    return () => {
      alive = false;
    };
  }, [job.id, job.eligibility_rules]);

  if (error) return <Panel tone="warning"><BodyText muted>{error}</BodyText></Panel>;
  if (!row) return null;
  if (!row.policyPublished && row.evaluation.outcome === 'insufficient_information') {
    return (
      <Panel>
        <BodyText strong>Conviction consideration policy</BodyText>
        <BodyText muted>This employer has not published an approved job-specific policy on FairPath yet. FairPath will not guess their hiring rules.</BodyText>
      </Panel>
    );
  }

  const tone =
    row.evaluation.outcome === 'confirmed_restriction'
      ? 'warning'
      : row.evaluation.outcome === 'appears_compatible'
        ? 'success'
        : 'muted';

  return (
    <Panel>
      <BodyText strong>{OUTCOME_LABEL[row.evaluation.outcome] ?? 'Compatibility insight'}</BodyText>
      <StatusLine tone={tone}>{row.evaluation.reason}</StatusLine>
      {row.evaluation.missingInformation.length ? (
        <BodyText muted>Missing: {row.evaluation.missingInformation.join(', ').replace(/_/g, ' ')}</BodyText>
      ) : null}
      {!row.disclosureReady ? (
        <View style={{ marginTop: 8 }}>
          <SecondaryButton label="MANAGE DISCLOSURE" onPress={() => router.push('/profile-readiness' as never)} />
        </View>
      ) : null}
      <View style={{ marginTop: 8 }}>
        <BodyText muted>This is not a hiring decision. Employers decide; FairPath never auto-rejects you based on your record.</BodyText>
      </View>
    </Panel>
  );
}
