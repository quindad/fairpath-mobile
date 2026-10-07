// Member-facing staffing assignment view. This is an explicit allowlist, not a denylist: a field only reaches the
// member if it is named here. Internal economics (bill rate, EOR cost, margin) can never leak through this module,
// even if the internal object passed in is malformed or over-shares, because the output is built field by field.

export type AssignmentType = 'temporary' | 'contract' | 'temp_to_hire';
export type AssignmentStatus =
  | 'applied' | 'interview' | 'screening' | 'onboarding' | 'active' | 'ended' | 'converted_to_direct_hire';

export type InternalAssignment = {
  id: string;
  clientDisplayName: string;
  roleTitle: string;
  locationText: string;
  payRateHourly: number;
  payRatePeriodLabel: string;
  shiftScheduleText: string;
  assignmentType: AssignmentType;
  expectedDurationWeeks: number | null;
  status: AssignmentStatus;
  interviewScheduledAt: string | null;
  screeningStatus: 'not_started' | 'consent_pending' | 'in_progress' | 'complete' | 'manual_review' | null;
  onboardingStatus: 'not_started' | 'pending' | 'complete' | null;
  startDate: string | null;
  timePayrollHandoffAvailable: boolean;
  retentionCheckpointDueAt: string | null;
  // Internal-only fields a real backend row would also carry. Never read by toMemberView.
  billRateHourly?: number;
  eorCostHourly?: number;
  grossSpreadHourly?: number;
  estimatedContributionHourly?: number;
  internalNotes?: string;
};

/** Exactly what a member may see. Every key here is intentional and member-safe. */
export type MemberAssignmentView = {
  id: string;
  client: string;
  role: string;
  location: string;
  payRate: string;
  schedule: string;
  assignmentType: AssignmentType;
  expectedDurationWeeks: number | null;
  status: AssignmentStatus;
  interviewScheduledAt: string | null;
  screeningStatus: InternalAssignment['screeningStatus'];
  onboardingStatus: InternalAssignment['onboardingStatus'];
  startDate: string | null;
  timePayrollHandoffAvailable: boolean;
  retentionCheckpointDueAt: string | null;
};

export function toMemberView(a: InternalAssignment): MemberAssignmentView {
  return {
    id: a.id,
    client: a.clientDisplayName,
    role: a.roleTitle,
    location: a.locationText,
    payRate: `$${a.payRateHourly.toFixed(2)}/${a.payRatePeriodLabel}`,
    schedule: a.shiftScheduleText,
    assignmentType: a.assignmentType,
    expectedDurationWeeks: a.expectedDurationWeeks,
    status: a.status,
    interviewScheduledAt: a.interviewScheduledAt,
    screeningStatus: a.screeningStatus,
    onboardingStatus: a.onboardingStatus,
    startDate: a.startDate,
    timePayrollHandoffAvailable: a.timePayrollHandoffAvailable,
    retentionCheckpointDueAt: a.retentionCheckpointDueAt,
  };
}
