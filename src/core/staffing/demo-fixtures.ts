// DEV-ONLY STAFFING DEMO SCENARIO. Not real data, not connected to any backend, not shown to anyone but the person
// using this build. Never referenced from any public-facing impact or statistics surface — the evidence layer
// (evidence.ts) only ever counts real system-recorded facts, and these fixtures are not fed into it for real.
//
// Scenario: a client needs 10 warehouse associates. Candidates include an ordinary FairPath member, a veteran
// member, and a member who came through the Reentry pathway. Nothing about a member's pathway is exposed to the
// (fictional) client in any of these records — consistent with "Veterans is a pathway, not a staffing badge" and
// "Reentry is not disclosed automatically".

import type { InternalAssignment } from './member-view.ts';

export const DEMO_LABEL = 'DEV DEMO — not a real assignment' as const;

export const DEMO_REQUISITION = {
  id: 'demo-req-1',
  clientDisplayName: 'Example Logistics Co. (DEV fixture)',
  roleTitle: 'Warehouse Associate',
  headcount: 10,
  assignmentType: 'temp_to_hire' as const,
  location: 'Columbus, OH',
};

export const DEMO_MEMBERS = [
  { id: 'demo-member-1', label: 'Member A (ordinary pathway)' },
  { id: 'demo-member-2', label: 'Member B (Veterans pathway)' },
  { id: 'demo-member-3', label: 'Member C (Reentry pathway)' },
] as const;

/** Three placements out of ten requested, at different real-world points in the pipeline. */
export const DEMO_ASSIGNMENTS: InternalAssignment[] = [
  {
    id: 'demo-assign-1', clientDisplayName: DEMO_REQUISITION.clientDisplayName, roleTitle: DEMO_REQUISITION.roleTitle,
    locationText: DEMO_REQUISITION.location, payRateHourly: 19.5, payRatePeriodLabel: 'hr', shiftScheduleText: 'Mon-Fri, 7am-3:30pm',
    assignmentType: 'temp_to_hire', expectedDurationWeeks: 12, status: 'active', interviewScheduledAt: null,
    screeningStatus: 'complete', onboardingStatus: 'complete', startDate: '2026-09-15', timePayrollHandoffAvailable: true,
    retentionCheckpointDueAt: '2026-10-15',
  },
  {
    // extended: duration grew from the original 12 weeks
    id: 'demo-assign-2', clientDisplayName: DEMO_REQUISITION.clientDisplayName, roleTitle: DEMO_REQUISITION.roleTitle,
    locationText: DEMO_REQUISITION.location, payRateHourly: 19.5, payRatePeriodLabel: 'hr', shiftScheduleText: 'Mon-Fri, 3pm-11:30pm',
    assignmentType: 'temporary', expectedDurationWeeks: 20, status: 'active', interviewScheduledAt: null,
    screeningStatus: 'complete', onboardingStatus: 'complete', startDate: '2026-08-01', timePayrollHandoffAvailable: true,
    retentionCheckpointDueAt: '2026-11-01',
  },
  {
    // converted to direct hire
    id: 'demo-assign-3', clientDisplayName: DEMO_REQUISITION.clientDisplayName, roleTitle: DEMO_REQUISITION.roleTitle,
    locationText: DEMO_REQUISITION.location, payRateHourly: 21, payRatePeriodLabel: 'hr', shiftScheduleText: 'Mon-Fri, 7am-3:30pm',
    assignmentType: 'temp_to_hire', expectedDurationWeeks: 12, status: 'converted_to_direct_hire', interviewScheduledAt: null,
    screeningStatus: 'complete', onboardingStatus: 'complete', startDate: '2026-07-01', timePayrollHandoffAvailable: true,
    retentionCheckpointDueAt: null,
  },
];

/** A fourth, non-placed example used only to demonstrate the screening-review UI state. */
export const DEMO_ASSIGNMENT_IN_REVIEW: InternalAssignment = {
  id: 'demo-assign-review', clientDisplayName: DEMO_REQUISITION.clientDisplayName, roleTitle: DEMO_REQUISITION.roleTitle,
  locationText: DEMO_REQUISITION.location, payRateHourly: 19.5, payRatePeriodLabel: 'hr', shiftScheduleText: 'Mon-Fri, 7am-3:30pm',
  assignmentType: 'temp_to_hire', expectedDurationWeeks: 12, status: 'screening', interviewScheduledAt: '2026-10-10T14:00:00Z',
  screeningStatus: 'manual_review', onboardingStatus: 'not_started', startDate: null, timePayrollHandoffAvailable: false,
  retentionCheckpointDueAt: null,
};
