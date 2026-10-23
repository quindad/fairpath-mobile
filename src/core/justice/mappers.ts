import type { Conviction } from '../profile/conviction-service.ts';
import type { ReliefCase } from '../record-relief/relief-service.ts';
import type { CaseBundle, ChargeDegree, ChargeDisposition } from '../record-relief/jurisdiction-engine.ts';
import type { UnifiedJusticeCase, UnifiedJusticeCharge, JusticeChargeDegree, JusticeChargeDisposition } from './types.ts';

function mapDegree(raw: string | null | undefined): JusticeChargeDegree {
  if (raw === 'infraction' || raw === 'minor_misdemeanor' || raw === 'misdemeanor' || raw === 'felony') return raw;
  if (raw === 'traffic_infraction') return 'infraction';
  if (raw === 'misdemeanor') return 'misdemeanor';
  if (raw?.includes('felony')) return 'felony';
  return 'unknown';
}

function mapDisposition(raw: string | null | undefined): JusticeChargeDisposition {
  const allowed: JusticeChargeDisposition[] = [
    'conviction', 'dismissal', 'acquittal', 'deferred_adjudication', 'nolle_prosequi', 'arrest_no_charge', 'pending', 'unknown',
  ];
  return allowed.includes(raw as JusticeChargeDisposition) ? (raw as JusticeChargeDisposition) : 'unknown';
}

function stateToJurisdiction(state: string | null | undefined): string | null {
  if (!state?.trim()) return null;
  const s = state.trim().toUpperCase();
  if (s.length === 2) return `US-${s}`;
  return null;
}

export function convictionToUnifiedCharge(c: Conviction, countNumber = 1): UnifiedJusticeCharge {
  return {
    id: `conviction:${c.id}`,
    source: 'conviction',
    countNumber,
    offenseName: c.offense_title?.trim() || 'Charge',
    statuteCode: c.offense_code,
    degree: mapDegree(c.offense_degree ?? c.offense_class),
    degreeLevel: null,
    disposition: mapDisposition(c.disposition),
    convictionDate: c.conviction_date,
    dispositionDate: c.sentence_date,
    sentenceCompletionDate: null,
    supervisionCompletionDate: null,
    releaseDate: c.release_date,
    finesPaid: null,
    restitutionPaid: null,
    verificationState: c.verification_state,
    offenseCategory: c.taxonomy_category_id,
    linkedConvictionId: c.id,
    linkedRecordReliefCaseId: null,
  };
}

export function recordReliefCaseToUnified(c: ReliefCase): UnifiedJusticeCase {
  const charge: UnifiedJusticeCharge = {
    id: `record_relief:${c.id}`,
    source: 'record_relief',
    countNumber: 1,
    offenseName: c.offense_description?.trim() || c.label,
    statuteCode: null,
    degree: mapDegree(c.offense_class),
    degreeLevel: null,
    disposition: mapDisposition(c.disposition),
    convictionDate: c.conviction_date,
    dispositionDate: c.disposition_date,
    sentenceCompletionDate: c.sentence_completion_date,
    supervisionCompletionDate: c.supervision_completion_date,
    releaseDate: c.release_date,
    finesPaid: c.fines_paid,
    restitutionPaid: c.restitution_paid,
    verificationState: c.out_of_state_conviction ? 'needs_review' : 'user_confirmed',
    offenseCategory: c.offense_class,
    linkedConvictionId: null,
    linkedRecordReliefCaseId: c.id,
  };
  return {
    id: `record_relief_case:${c.id}`,
    docketLabel: c.label,
    jurisdictionCode: c.jurisdiction_code,
    stateCode: c.jurisdiction_code?.startsWith('US-') ? c.jurisdiction_code.slice(3) : null,
    county: null,
    courtName: c.court_name,
    caseNumber: c.case_number,
    caseStatus: 'unknown',
    verificationState: charge.verificationState,
    sources: ['record_relief'],
    charges: [charge],
    memberNotes: c.notes,
    updatedAt: c.updated_at,
  };
}

export function convictionToUnifiedCase(c: Conviction): UnifiedJusticeCase {
  const jc = stateToJurisdiction(c.state_code);
  return {
    id: `conviction_case:${c.id}`,
    docketLabel: c.case_number?.trim() || c.offense_title?.trim() || 'Justice record',
    jurisdictionCode: jc,
    stateCode: c.state_code,
    county: c.county,
    courtName: c.court_name,
    caseNumber: c.case_number,
    caseStatus: 'unknown',
    verificationState: c.verification_state,
    sources: ['conviction'],
    charges: [convictionToUnifiedCharge(c)],
    memberNotes: c.user_notes,
    updatedAt: c.updated_at,
  };
}

/** Merge key: same member, jurisdiction, and case number when both sides have one. */
export function docketMergeKey(jurisdictionCode: string | null, caseNumber: string | null): string | null {
  const cn = caseNumber?.trim();
  if (!cn || !jurisdictionCode) return null;
  return `${jurisdictionCode}::${cn.toLowerCase()}`;
}

export function unifiedCaseToCaseBundle(row: UnifiedJusticeCase): CaseBundle {
  const toEngineDegree = (d: JusticeChargeDegree): ChargeDegree => {
    if (d === 'infraction' || d === 'minor_misdemeanor' || d === 'misdemeanor' || d === 'felony') return d;
    return 'unknown';
  };
  const toEngineDisposition = (d: JusticeChargeDisposition): ChargeDisposition => {
    if (d === 'pending' || d === 'unknown') return d;
    if (d === 'arrest_no_charge') return 'arrest_no_charge';
    return d as ChargeDisposition;
  };
  return {
    venue: {
      jurisdictionCode: row.jurisdictionCode ?? 'US-OH',
      stateCode: row.stateCode ?? undefined,
      county: row.county ?? undefined,
      courtName: row.courtName ?? undefined,
      courtLevel: 'unknown',
    },
    charges: row.charges.map((ch) => ({
      id: ch.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100),
      offenseName: ch.offenseName,
      statute: ch.statuteCode ?? undefined,
      degree: toEngineDegree(ch.degree),
      degreeLevel: ch.degreeLevel ?? undefined,
      disposition: toEngineDisposition(ch.disposition),
      convictionDate: ch.convictionDate ?? undefined,
      dispositionDate: ch.dispositionDate ?? undefined,
      sentenceCompletionDate: ch.sentenceCompletionDate ?? undefined,
      supervisionCompletionDate: ch.supervisionCompletionDate ?? undefined,
      releaseDate: ch.releaseDate ?? undefined,
      finesPaid: ch.finesPaid ?? undefined,
      restitutionPaid: ch.restitutionPaid ?? undefined,
    })),
  };
}
