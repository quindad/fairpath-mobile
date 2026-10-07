// Staffing workflow state machine: requisition -> sourcing/matching -> member preparation -> interview ->
// authorized screening -> onboarding -> placement -> assignment -> time/status -> retention.
// Screening never runs without a prior consent step, and no status here ever auto-rejects a candidate.

export type StaffingStage =
  | 'requisition_open'
  | 'sourcing_matching'
  | 'member_preparation'
  | 'interview'
  | 'screening_consent'
  | 'screening_in_progress'
  | 'onboarding'
  | 'placement_confirmed'
  | 'assignment_active'
  | 'assignment_ended'
  | 'converted_to_direct_hire'
  | 'retention';

const ALLOWED_NEXT: Record<StaffingStage, StaffingStage[]> = {
  requisition_open: ['sourcing_matching'],
  sourcing_matching: ['member_preparation'],
  member_preparation: ['interview'],
  interview: ['screening_consent'],
  screening_consent: ['screening_in_progress'],
  screening_in_progress: ['onboarding'],
  onboarding: ['placement_confirmed'],
  placement_confirmed: ['assignment_active'],
  assignment_active: ['assignment_ended', 'converted_to_direct_hire'],
  assignment_ended: ['retention'],
  converted_to_direct_hire: [],
  retention: [],
};

export function canAdvance(from: StaffingStage, to: StaffingStage): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

export function advance(from: StaffingStage, to: StaffingStage): StaffingStage {
  return canAdvance(from, to) ? to : from;
}

/** Screening can only start from a stage that has already passed through explicit consent. */
export function screeningAuthorized(stage: StaffingStage): boolean {
  const order: StaffingStage[] = [
    'requisition_open', 'sourcing_matching', 'member_preparation', 'interview',
    'screening_consent', 'screening_in_progress', 'onboarding', 'placement_confirmed',
    'assignment_active', 'assignment_ended', 'retention',
  ];
  return order.indexOf(stage) >= order.indexOf('screening_consent');
}

/** No stage in this workflow is an automatic rejection. FairPath never silently removes a candidate. */
export const AUTO_REJECT_STAGES: readonly StaffingStage[] = [];
