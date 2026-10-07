// Staffing UI contract: the exact, member-safe props every staffing display component may receive. Pure types and
// serializers only (no React here) so Command Center can consume the same contract without depending on React Native.
// Every type here is an explicit allowlist. A serialization test proves no internal economics field can reach it.

import type { AssignmentStatus, AssignmentType } from './member-view.ts';

export type ListingKindBadgeProps = { kind: 'direct_hire' | 'staffing' };

export type AssignmentTypeBadgeProps = { assignmentType: AssignmentType };

export const ASSIGNMENT_TYPE_EXPLANATION: Record<AssignmentType, string> = {
  temporary: 'A short-term assignment with a defined or expected end date. You are not expected to continue beyond it unless offered an extension.',
  contract: 'A fixed assignment for a stated scope or duration, typically longer than a short temporary role.',
  temp_to_hire: 'A trial period working for this client. If it goes well, the client may offer you a direct position with them.',
};

export type EmployerOfRecordNote = { workerEmployer: 'pending_confirmation' | 'eor_partner'; worksite: string; note: string };

/** Who legally employs the worker vs. where they physically work. Never claims an EOR relationship is finalized
 * before it actually is — the note text is the only place this is ever described to a member. */
export function employerOfRecordNote(worksite: string, eorFinalized: boolean): EmployerOfRecordNote {
  return {
    workerEmployer: eorFinalized ? 'eor_partner' : 'pending_confirmation',
    worksite,
    note: eorFinalized
      ? `You work at ${worksite}. Your employer of record handles your pay and tax paperwork.`
      : `You work at ${worksite}. FairPath is finalizing which company serves as your employer of record; details will be confirmed before you start.`,
  };
}

export type TimelineStep = { label: string; state: 'done' | 'current' | 'upcoming' | 'skipped' };

const TIMELINE_LABELS: [AssignmentStatus, string][] = [
  ['applied', 'Applied'],
  ['interview', 'Interview'],
  ['screening', 'Screening'],
  ['onboarding', 'Onboarding'],
  ['active', 'Active'],
];

/** Builds the member-visible timeline. Converted-to-hire and ended are terminal and shown as a final step, not folded into "active". */
export function buildTimeline(status: AssignmentStatus): TimelineStep[] {
  if (status === 'converted_to_direct_hire') {
    return [...TIMELINE_LABELS.map(([, label]) => ({ label, state: 'done' as const })), { label: 'Converted to direct hire', state: 'current' as const }];
  }
  if (status === 'ended') {
    return [...TIMELINE_LABELS.map(([, label]) => ({ label, state: 'done' as const })), { label: 'Assignment ended', state: 'current' as const }];
  }
  const order: AssignmentStatus[] = ['applied', 'interview', 'screening', 'onboarding', 'active'];
  const idx = order.indexOf(status);
  return TIMELINE_LABELS.map(([s, label], i) => ({ label, state: i < idx ? 'done' : i === idx ? 'current' : 'upcoming' }));
}

export type NextActionProps = { text: string; urgent: boolean };

export function buildNextAction(status: AssignmentStatus, screeningStatus: string | null, onboardingStatus: string | null, retentionDueAt: string | null): NextActionProps {
  if (status === 'converted_to_direct_hire') return { text: 'Nothing needed. Welcome to your new direct position.', urgent: false };
  if (onboardingStatus === 'pending') return { text: 'Finish onboarding steps you were sent.', urgent: true };
  if (screeningStatus === 'in_progress') return { text: 'No action needed right now. We will reach out with next steps.', urgent: false };
  if (status === 'active' && retentionDueAt) return { text: `Confirm your retention check-in by ${retentionDueAt}.`, urgent: true };
  if (status === 'active') return { text: 'Nothing needed right now.', urgent: false };
  return { text: 'Check back for updates.', urgent: false };
}

export type ScreeningStatusProps = { status: 'not_started' | 'consent_pending' | 'in_progress' | 'complete' | 'manual_review' };
export type OnboardingStatusProps = { status: 'not_started' | 'pending' | 'complete' };
export type ConversionStatusProps = { converted: boolean; clientOffered: boolean };
export type AssignmentContactProps = { contactName: string | null; contactRole: string | null; contactAvailable: boolean };

/** Fields that must NEVER appear on any staffing UI component prop type. Used by a serialization test against every type above. */
export const FORBIDDEN_UI_PROP_FIELDS = [
  'billRateHourly', 'eorCostHourly', 'grossSpreadHourly', 'estimatedContributionHourly', 'statutoryBurdenPercent',
  'screeningCostFlat', 'markupPercent', 'internalNotes', 'providerRef',
];
