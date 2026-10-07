// Member-facing staffing display components. Every prop type here is imported from
// src/core/staffing/ui-contract.ts or src/core/staffing/member-view.ts — the allowlisted, member-safe contract.
// No component in this file may accept an internal economics field; tests/staffing-ui-contract.test.ts enforces this
// against the type source, and this file's own prop destructuring makes it structurally impossible to pass one through.
import { Text, View } from 'react-native';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { LISTING_KIND_LABEL, LISTING_KIND_EXPLANATION, type ListingKind } from '@/core/staffing/listing-kind';
import {
  ASSIGNMENT_TYPE_EXPLANATION, buildTimeline, type AssignmentTypeBadgeProps, type TimelineStep,
  type NextActionProps, type ScreeningStatusProps, type OnboardingStatusProps, type ConversionStatusProps,
  type AssignmentContactProps, type EmployerOfRecordNote,
} from '@/core/staffing/ui-contract';
import type { AssignmentStatus } from '@/core/staffing/member-view';

export function StaffingBadge({ kind }: { kind: ListingKind }) {
  const s = useThemedStyles(styles);
  return (
    <View style={kind === 'staffing' ? s.badgeAccent : s.badgeNeutral} accessibilityLabel={LISTING_KIND_LABEL[kind]}>
      <Text style={kind === 'staffing' ? s.badgeAccentText : s.badgeNeutralText}>{LISTING_KIND_LABEL[kind]}</Text>
    </View>
  );
}

export function StaffingOpportunitySummary({ kind }: { kind: ListingKind }) {
  const s = useThemedStyles(styles);
  return <Text style={s.body}>{LISTING_KIND_EXPLANATION[kind]}</Text>;
}

export function AssignmentTypeBadge({ assignmentType }: AssignmentTypeBadgeProps) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.badgeNeutral} accessibilityLabel={assignmentType.replace(/_/g, ' ')}>
      <Text style={s.badgeNeutralText}>{assignmentType.replace(/_/g, ' ')}</Text>
      <Text style={s.caption}>{ASSIGNMENT_TYPE_EXPLANATION[assignmentType]}</Text>
    </View>
  );
}

export function EmployerOfRecordCard({ note }: { note: EmployerOfRecordNote }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Who employs you</Text>
      <Text style={s.body}>{note.note}</Text>
    </View>
  );
}

export function StaffingTimeline({ status }: { status: AssignmentStatus }) {
  const s = useThemedStyles(styles);
  const steps: TimelineStep[] = buildTimeline(status);
  return (
    <View style={s.timeline} accessibilityRole="progressbar">
      {steps.map((step, i) => (
        <View key={step.label} style={s.timelineStep}>
          <View style={[s.timelineDot, step.state === 'done' && s.timelineDotDone, step.state === 'current' && s.timelineDotCurrent]} />
          <Text style={step.state === 'upcoming' ? s.timelineLabelMuted : s.timelineLabel}>{step.label}</Text>
          {i < steps.length - 1 ? <View style={s.timelineLine} /> : null}
        </View>
      ))}
    </View>
  );
}

export function StaffingNextAction({ text, urgent }: NextActionProps) {
  const s = useThemedStyles(styles);
  return (
    <View style={urgent ? s.cardUrgent : s.card} accessibilityLabel={`Next action: ${text}`}>
      <Text style={s.cardTitle}>Next action</Text>
      <Text style={s.body}>{text}</Text>
    </View>
  );
}

const SCREENING_LABEL: Record<ScreeningStatusProps['status'], string> = {
  not_started: 'Not started', consent_pending: 'Waiting on your authorization', in_progress: 'In progress',
  complete: 'Complete', manual_review: 'Under human review',
};
export function ScreeningStatus({ status }: ScreeningStatusProps) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>Screening</Text>
      <Text style={s.rowValue}>{SCREENING_LABEL[status]}</Text>
    </View>
  );
}

const ONBOARDING_LABEL: Record<OnboardingStatusProps['status'], string> = { not_started: 'Not started', pending: 'In progress', complete: 'Complete' };
export function OnboardingStatus({ status }: OnboardingStatusProps) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>Onboarding</Text>
      <Text style={s.rowValue}>{ONBOARDING_LABEL[status]}</Text>
    </View>
  );
}

export function AssignmentStatusLine({ status }: { status: AssignmentStatus }) {
  const s = useThemedStyles(styles);
  const label: Record<AssignmentStatus, string> = {
    applied: 'Application submitted', interview: 'Interview stage', screening: 'Screening in progress',
    onboarding: 'Onboarding', active: 'Active assignment', ended: 'Assignment ended', converted_to_direct_hire: 'Converted to direct hire',
  };
  return <Text style={s.status}>{label[status]}</Text>;
}

export function ConversionStatus({ converted, clientOffered }: ConversionStatusProps) {
  const s = useThemedStyles(styles);
  if (converted) return <View style={s.card}><Text style={s.cardTitle}>Converted to direct hire</Text><Text style={s.body}>Your assignment became a direct position with this employer.</Text></View>;
  if (clientOffered) return <View style={s.card}><Text style={s.cardTitle}>Direct-hire offer</Text><Text style={s.body}>This client has asked about converting your assignment to a direct position. Review the details before deciding.</Text></View>;
  return null;
}

export function AssignmentContact({ contactName, contactRole, contactAvailable }: AssignmentContactProps) {
  const s = useThemedStyles(styles);
  if (!contactAvailable || !contactName) {
    return <View style={s.card}><Text style={s.cardTitle}>Approved contact</Text><Text style={s.body}>Not yet assigned. Check back once onboarding is complete.</Text></View>;
  }
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Approved contact</Text>
      <Text style={s.body}>{contactName}{contactRole ? ` · ${contactRole}` : ''}</Text>
    </View>
  );
}

/** Shared unavailable/restricted state for any staffing component that has nothing to show yet. */
export function StaffingUnavailable({ reason }: { reason: string }) {
  const s = useThemedStyles(styles);
  return <View style={s.card}><Text style={s.body}>{reason}</Text></View>;
}

const styles = (t: ThemeTokens) => ({
  badgeAccent: { alignSelf: 'flex-start' as const, backgroundColor: t.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2 },
  badgeAccentText: { color: t.onAccent, fontWeight: '700' as const, fontSize: 12 },
  badgeNeutral: { alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 10, paddingVertical: 4, gap: 2 },
  badgeNeutralText: { color: t.textSecondary, fontWeight: '700' as const, fontSize: 12, textTransform: 'capitalize' as const },
  caption: { color: t.textMuted, fontSize: 11, maxWidth: 220 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardUrgent: { borderWidth: 1, borderColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  status: { color: t.accent, fontWeight: '700' as const, fontSize: 13 },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingVertical: 4 },
  rowLabel: { color: t.textSecondary, fontSize: 14 },
  rowValue: { color: t.text, fontSize: 14, fontWeight: '600' as const },
  timeline: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, alignItems: 'center' as const },
  timelineStep: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.border },
  timelineDotDone: { backgroundColor: t.accent },
  timelineDotCurrent: { backgroundColor: t.accent, width: 12, height: 12, borderRadius: 6 },
  timelineLabel: { color: t.text, fontSize: 12, fontWeight: '600' as const },
  timelineLabelMuted: { color: t.textMuted, fontSize: 12 },
  timelineLine: { width: 16, height: 1, backgroundColor: t.border },
});
