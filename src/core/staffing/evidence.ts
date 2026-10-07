// Staffing evidence: which pipeline stages produce real, verifiable evidence, and which do not. Designed to feed the
// existing impact evidence ledger (supabase/migrations/20261007170000_impact_evidence_ledger.sql: "real facts only,
// auto-recorded") rather than build a second evidence system. This module only decides WHICH stages qualify and
// HOW to shape the fact; writing it is a server concern for when the staffing migration is reviewed.

import type { PipelineStage } from './pipeline.ts';

export type EvidenceKind = 'placement' | 'assignment_start' | 'retention' | 'conversion_to_direct_hire';

export type EvidenceFact = {
  kind: EvidenceKind;
  assignmentId: string;
  occurredAt: string;
  source: 'staffing_pipeline';
  verificationState: 'system_recorded'; // these stages are system-recorded facts, not member-reported claims
};

/**
 * Candidate submission and interviews are NOT evidence of anything — a candidate being submitted or interviewed is
 * not an outcome. Only these stages produce a fact, and the mapping is explicit so nothing can quietly add more.
 */
const EVIDENCE_STAGE_MAP: Partial<Record<PipelineStage, EvidenceKind>> = {
  placement_confirmed: 'placement',
  assignment_active: 'assignment_start',
  retention_confirmed: 'retention',
  converted_to_direct_hire: 'conversion_to_direct_hire',
};

export const NON_EVIDENCE_STAGES: readonly PipelineStage[] = [
  'candidate_submitted', 'candidate_interested', 'interview_requested', 'interview_scheduled', 'interview_completed',
];

export function evidenceForStage(stage: PipelineStage, assignmentId: string, occurredAt: string): EvidenceFact | null {
  const kind = EVIDENCE_STAGE_MAP[stage];
  if (!kind) return null;
  return { kind, assignmentId, occurredAt, source: 'staffing_pipeline', verificationState: 'system_recorded' };
}

/** Evidence is never scaled up or estimated. One stage reached = one fact, never a multiplier. */
export function evidenceCount(facts: readonly EvidenceFact[], kind: EvidenceKind): number {
  return facts.filter((f) => f.kind === kind).length;
}
