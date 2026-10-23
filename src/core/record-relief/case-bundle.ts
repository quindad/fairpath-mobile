import type { CaseBundle, ChargeDegree } from './jurisdiction-engine.ts';

/** Minimal saved-case shape needed to build a single-charge engine bundle. */
export type ReliefCaseBundleRow = {
  id: string;
  jurisdiction_code: string;
  court_name: string | null;
  offense_description: string | null;
  label: string;
  offense_class: string;
  disposition: string;
  conviction_date: string | null;
  disposition_date: string | null;
  sentence_completion_date: string | null;
  supervision_completion_date: string | null;
  release_date: string | null;
  fines_paid: boolean | null;
  restitution_paid: boolean | null;
};

export function degreeFromOffenseClass(offenseClass: string): ChargeDegree {
  if (offenseClass === 'traffic_infraction') return 'infraction';
  if (offenseClass === 'misdemeanor') return 'misdemeanor';
  if (offenseClass === 'non_violent_felony' || offenseClass === 'violent_felony' || offenseClass === 'sex_offense') return 'felony';
  return 'unknown';
}

export function caseToCaseBundle(c: ReliefCaseBundleRow): CaseBundle {
  return {
    venue: { jurisdictionCode: c.jurisdiction_code, courtName: c.court_name ?? undefined, courtLevel: 'unknown' },
    charges: [{
      id: c.id, offenseName: c.offense_description ?? c.label, degree: degreeFromOffenseClass(c.offense_class),
      disposition: (c.disposition as CaseBundle['charges'][number]['disposition']) ?? 'unknown',
      convictionDate: c.conviction_date ?? undefined, dispositionDate: c.disposition_date ?? undefined,
      sentenceCompletionDate: c.sentence_completion_date ?? undefined, supervisionCompletionDate: c.supervision_completion_date ?? undefined,
      releaseDate: c.release_date ?? undefined, finesPaid: c.fines_paid ?? undefined, restitutionPaid: c.restitution_paid ?? undefined,
    }],
  };
}
