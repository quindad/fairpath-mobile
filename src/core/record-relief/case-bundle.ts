import type { CaseBundle, Charge, ChargeDegree, ChargeDisposition } from './jurisdiction-engine.ts';

/** Extra charge rows for engine evaluation before record_relief_charges table lands (scan / draft payloads). */
export type ReliefAdditionalCharge = {
  id: string;
  offense_name: string;
  offense_class?: string;
  disposition: string;
  conviction_date?: string | null;
  disposition_date?: string | null;
  sentence_completion_date?: string | null;
  supervision_completion_date?: string | null;
  release_date?: string | null;
  fines_paid?: boolean | null;
  restitution_paid?: boolean | null;
};

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
  additional_charges?: ReliefAdditionalCharge[];
};

export type EngineChargePayloadRow = {
  id?: string;
  offense_name: string;
  offense_class?: string;
  disposition: string;
  conviction_date?: string | null;
  disposition_date?: string | null;
  sentence_completion_date?: string | null;
  supervision_completion_date?: string | null;
  release_date?: string | null;
  fines_paid?: boolean | null;
  restitution_paid?: boolean | null;
};

export function additionalChargesFromSavePayload(p: Record<string, unknown>): ReliefAdditionalCharge[] {
  const raw = p.engine_additional_charges;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as EngineChargePayloadRow;
      const offense = String(r.offense_name ?? '').trim();
      if (offense.length < 2) return null;
      return {
        id: String(r.id ?? `extra-${i + 1}`),
        offense_name: offense,
        offense_class: r.offense_class,
        disposition: String(r.disposition ?? 'conviction'),
        conviction_date: r.conviction_date ?? null,
        disposition_date: r.disposition_date ?? null,
        sentence_completion_date: r.sentence_completion_date ?? null,
        supervision_completion_date: r.supervision_completion_date ?? null,
        release_date: r.release_date ?? null,
        fines_paid: r.fines_paid ?? null,
        restitution_paid: r.restitution_paid ?? null,
      } satisfies ReliefAdditionalCharge;
    })
    .filter((x): x is ReliefAdditionalCharge => x !== null);
}

export function degreeFromOffenseClass(offenseClass: string): ChargeDegree {
  if (offenseClass === 'traffic_infraction') return 'infraction';
  if (offenseClass === 'misdemeanor') return 'misdemeanor';
  if (offenseClass === 'non_violent_felony' || offenseClass === 'violent_felony' || offenseClass === 'sex_offense') return 'felony';
  return 'unknown';
}

function chargeFromPrimaryRow(c: ReliefCaseBundleRow): Charge {
  return {
    id: c.id,
    offenseName: c.offense_description ?? c.label,
    degree: degreeFromOffenseClass(c.offense_class),
    disposition: (c.disposition as ChargeDisposition) ?? 'unknown',
    convictionDate: c.conviction_date ?? undefined,
    dispositionDate: c.disposition_date ?? undefined,
    sentenceCompletionDate: c.sentence_completion_date ?? undefined,
    supervisionCompletionDate: c.supervision_completion_date ?? undefined,
    releaseDate: c.release_date ?? undefined,
    finesPaid: c.fines_paid ?? undefined,
    restitutionPaid: c.restitution_paid ?? undefined,
  };
}

function chargeFromAdditional(row: ReliefAdditionalCharge): Charge {
  return {
    id: row.id,
    offenseName: row.offense_name,
    degree: degreeFromOffenseClass(row.offense_class ?? 'misdemeanor'),
    disposition: (row.disposition as ChargeDisposition) ?? 'unknown',
    convictionDate: row.conviction_date ?? undefined,
    dispositionDate: row.disposition_date ?? undefined,
    sentenceCompletionDate: row.sentence_completion_date ?? undefined,
    supervisionCompletionDate: row.supervision_completion_date ?? undefined,
    releaseDate: row.release_date ?? undefined,
    finesPaid: row.fines_paid ?? undefined,
    restitutionPaid: row.restitution_paid ?? undefined,
  };
}

export function caseToCaseBundle(c: ReliefCaseBundleRow): CaseBundle {
  const charges = [chargeFromPrimaryRow(c), ...(c.additional_charges ?? []).map(chargeFromAdditional)];
  return {
    venue: { jurisdictionCode: c.jurisdiction_code, courtName: c.court_name ?? undefined, courtLevel: 'unknown' },
    charges,
  };
}

export function caseToCaseBundleWithPayload(c: ReliefCaseBundleRow, payload: Record<string, unknown> = {}): CaseBundle {
  return caseToCaseBundle({ ...c, additional_charges: [...(c.additional_charges ?? []), ...additionalChargesFromSavePayload(payload)] });
}
