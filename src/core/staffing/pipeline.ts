// Full staffing pipeline state machine. Supersedes the coarse 12-stage version in workflow.ts with the operational
// granularity requested for requisitions through retention. workflow.ts's StaffingStage values are kept as a subset
// for backward compatibility with already-written code; this module is the canonical source going forward.
//
// WHERE EACH STAGE LIVES (decided here so nobody invents a second status column):
// - 'requisition_*' and 'sourcing'/'candidate_*' stages belong on staffing_requisitions / a future candidate-pipeline
//   row, NOT on job_applications. A requisition can have many candidates; job_applications already tracks one
//   member's application to one job and should not be overloaded with requisition-level state.
// - 'interview_*' through 'onboarding_complete' belong on job_applications.status (already has 'interview') where the
//   existing values cover it, and on staffing_assignments.stage for the staffing-specific steps job_applications has
//   no concept of (screening, onboarding). See job_applications.status: 'started'|'submitted'|'viewed'|'interview'|
//   'offer'|'hired'|'withdrawn'|'rejected' — none of those should be stretched to mean "screening in progress".
// - 'placement_confirmed' onward belongs on staffing_assignments.stage, which is the 1:1 extension of
//   job_placements (the durable hire fact already recorded there once 'placement_confirmed' is reached).
// No mega-status column: requisition-level and assignment-level state are deliberately separate tables/columns.

export type PipelineStage =
  // Requisition / candidate sourcing (staffing_requisitions + a future candidate-pipeline row)
  | 'requisition_created'
  | 'requisition_approved'
  | 'sourcing'
  | 'candidate_identified'
  | 'candidate_interested'
  | 'candidate_submitted'
  // Interview (job_applications.status territory, extended)
  | 'interview_requested'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'employer_moving_forward'
  // Screening (staffing_screening_state)
  | 'screening_authorization_requested'
  | 'screening_consent_received'
  | 'screening_requested'
  | 'screening_processing'
  | 'screening_requires_human_review'
  // Onboarding (staffing_provider_state)
  | 'onboarding_requested'
  | 'onboarding_pending'
  | 'onboarding_complete'
  // Assignment (staffing_assignments.stage, the 1:1 extension of job_placements)
  | 'placement_confirmed'
  | 'assignment_scheduled'
  | 'assignment_active'
  | 'assignment_extended'
  | 'assignment_completed'
  | 'assignment_ended_early'
  | 'converted_to_direct_hire'
  | 'retention_checkpoint_due'
  | 'retention_confirmed';

export type RecordLevel = 'requisition' | 'application' | 'assignment';

export const STAGE_RECORD_LEVEL: Record<PipelineStage, RecordLevel> = {
  requisition_created: 'requisition', requisition_approved: 'requisition', sourcing: 'requisition',
  candidate_identified: 'requisition', candidate_interested: 'requisition', candidate_submitted: 'requisition',
  interview_requested: 'application', interview_scheduled: 'application', interview_completed: 'application',
  employer_moving_forward: 'application',
  screening_authorization_requested: 'assignment', screening_consent_received: 'assignment',
  screening_requested: 'assignment', screening_processing: 'assignment', screening_requires_human_review: 'assignment',
  onboarding_requested: 'assignment', onboarding_pending: 'assignment', onboarding_complete: 'assignment',
  placement_confirmed: 'assignment', assignment_scheduled: 'assignment', assignment_active: 'assignment',
  assignment_extended: 'assignment', assignment_completed: 'assignment', assignment_ended_early: 'assignment',
  converted_to_direct_hire: 'assignment', retention_checkpoint_due: 'assignment', retention_confirmed: 'assignment',
};

const ALLOWED_NEXT: Record<PipelineStage, PipelineStage[]> = {
  requisition_created: ['requisition_approved'],
  requisition_approved: ['sourcing'],
  sourcing: ['candidate_identified'],
  candidate_identified: ['candidate_interested'],
  candidate_interested: ['candidate_submitted'],
  candidate_submitted: ['interview_requested'],
  interview_requested: ['interview_scheduled'],
  interview_scheduled: ['interview_completed'],
  interview_completed: ['employer_moving_forward'],
  employer_moving_forward: ['screening_authorization_requested'],
  screening_authorization_requested: ['screening_consent_received'],
  screening_consent_received: ['screening_requested'],
  screening_requested: ['screening_processing'],
  screening_processing: ['screening_requires_human_review', 'onboarding_requested'],
  screening_requires_human_review: ['onboarding_requested'], // only after a human clears it
  onboarding_requested: ['onboarding_pending'],
  onboarding_pending: ['onboarding_complete'],
  onboarding_complete: ['placement_confirmed'],
  placement_confirmed: ['assignment_scheduled'],
  assignment_scheduled: ['assignment_active'],
  assignment_active: ['assignment_extended', 'assignment_completed', 'assignment_ended_early', 'converted_to_direct_hire'],
  assignment_extended: ['assignment_active'], // extension returns to active with a new expected end date
  assignment_completed: ['retention_checkpoint_due'],
  assignment_ended_early: ['retention_checkpoint_due'],
  converted_to_direct_hire: [], // leaves the staffing pipeline entirely; becomes a job_placements direct-hire fact
  retention_checkpoint_due: ['retention_confirmed'],
  retention_confirmed: [],
};

export function canAdvance(from: PipelineStage, to: PipelineStage): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

/** Stages where a wrong transition would have real consequences (financial, legal, or identity) require an audit event. */
export const AUDITED_STAGES: readonly PipelineStage[] = [
  'screening_consent_received', 'screening_requested', 'onboarding_complete', 'placement_confirmed',
  'assignment_active', 'assignment_extended', 'converted_to_direct_hire', 'retention_confirmed',
];

export function requiresAudit(stage: PipelineStage): boolean {
  return AUDITED_STAGES.includes(stage);
}

export type TransitionAttempt = { from: PipelineStage; to: PipelineStage; actorId: string; occurredAt: string };
export type TransitionResult =
  | { ok: true; stage: PipelineStage; auditRequired: boolean }
  | { ok: false; reason: 'invalid_transition' };

/** The single entry point every caller (UI, future server function) should use. Never apply a stage change directly. */
export function applyTransition(attempt: TransitionAttempt): TransitionResult {
  if (!canAdvance(attempt.from, attempt.to)) return { ok: false, reason: 'invalid_transition' };
  return { ok: true, stage: attempt.to, auditRequired: requiresAudit(attempt.to) };
}

/** Screening may only be requested once consent is on record — same rule as checkr-adapter.ts, restated at the pipeline level. */
export function screeningConsentSatisfied(stage: PipelineStage): boolean {
  const order: PipelineStage[] = [
    'requisition_created', 'requisition_approved', 'sourcing', 'candidate_identified', 'candidate_interested',
    'candidate_submitted', 'interview_requested', 'interview_scheduled', 'interview_completed', 'employer_moving_forward',
    'screening_authorization_requested', 'screening_consent_received', 'screening_requested', 'screening_processing',
    'screening_requires_human_review', 'onboarding_requested', 'onboarding_pending', 'onboarding_complete',
    'placement_confirmed', 'assignment_scheduled', 'assignment_active', 'assignment_extended', 'assignment_completed',
    'assignment_ended_early', 'retention_checkpoint_due', 'retention_confirmed',
  ];
  return order.indexOf(stage) >= order.indexOf('screening_consent_received');
}

/** No stage in the pipeline is an automatic rejection or an automatic employment decision. */
export const AUTO_DECISION_STAGES: readonly PipelineStage[] = [];
