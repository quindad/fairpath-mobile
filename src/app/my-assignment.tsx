import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { toMemberView, type MemberAssignmentView } from '@/core/staffing/member-view';
import { DEMO_ASSIGNMENTS, DEMO_ASSIGNMENT_IN_REVIEW, DEMO_LABEL } from '@/core/staffing/demo-fixtures';
import { buildNextAction, employerOfRecordNote } from '@/core/staffing/ui-contract';
import {
  AssignmentTypeBadge, AssignmentStatusLine, StaffingTimeline, StaffingNextAction, ScreeningStatus,
  OnboardingStatus, ConversionStatus, AssignmentContact, EmployerOfRecordCard,
} from '@/components/staffing/StaffingComponents';

type ViewState = 'loading' | 'empty' | 'error' | 'ready';

// This screen renders from DEV fixtures only; nothing here is connected to a backend (staffing_assignments does
// not exist yet — see docs/proposed-migrations/20261021100000_staffing_architecture_DRAFT.sql). The demo switcher
// below exists purely so the full range of honest states (empty/loading/error/manual review/active/extended/
// converted) can be inspected without a server. It must be removed or gated once real data exists.
export default function MyAssignmentScreen() {
  const s = useThemedStyles(styles);
  const [demoIndex, setDemoIndex] = useState<number | 'empty' | 'error' | 'review'>(0);
  // A real version tracks an async ViewState (loading/error/ready); this demo renders synchronously from fixtures.

  const assignment: MemberAssignmentView | null =
    demoIndex === 'empty' || demoIndex === 'error' ? null :
    demoIndex === 'review' ? toMemberView(DEMO_ASSIGNMENT_IN_REVIEW) :
    toMemberView(DEMO_ASSIGNMENTS[demoIndex]!);

  return (
    <ScreenFrame>
      <PageHeader eyebrow="MY ASSIGNMENT · DEV DEMO" title="My Assignment" backTo="/my-path" />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>{DEMO_LABEL}</Text>
          <Text style={s.body}>This screen is not connected to a backend yet. Use the buttons below to preview every honest state.</Text>
          <View style={s.demoRow}>
            {(['empty', 0, 1, 2, 'review', 'error'] as const).map((d) => (
              <Pressable key={String(d)} style={s.demoChip} accessibilityRole="button" onPress={() => setDemoIndex(d)}>
                <Text style={s.demoChipText}>{typeof d === 'number' ? `Assignment ${d + 1}` : d}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {demoIndex === 'error' ? (
          <View style={s.card} accessibilityRole="alert">
            <Text style={s.cardTitle}>We could not load your assignment</Text>
            <Text style={s.body}>Nothing was changed. Try again, or check back later.</Text>
          </View>
        ) : !assignment ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>No active assignment</Text>
            <Text style={s.body}>When you are placed on a FairPath Staffing assignment, it will show up here.</Text>
          </View>
        ) : (
          <AssignmentDetail a={assignment} />
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

function AssignmentDetail({ a }: { a: MemberAssignmentView }) {
  const s = useThemedStyles(styles);
  const manualReview = a.screeningStatus === 'in_progress' && a.onboardingStatus === 'not_started';
  const screeningState = manualReview ? 'manual_review' : (a.screeningStatus ?? 'not_started');
  const next = buildNextAction(a.status, a.screeningStatus, a.onboardingStatus, a.retentionCheckpointDueAt);
  const contactAvailable = a.onboardingStatus === 'complete';

  return (
    <>
      <View style={s.card}>
        <Text style={s.cardTitle}>{a.client}</Text>
        <Text style={s.body}>{a.role} · {a.location}</Text>
        <AssignmentStatusLine status={a.status} />
      </View>

      <SectionTitle>Progress</SectionTitle>
      <StaffingTimeline status={a.status} />

      <SectionTitle>Pay and schedule</SectionTitle>
      <View style={s.card}>
        <Row label="Pay rate" value={a.payRate} />
        <Row label="Schedule" value={a.schedule} />
        <Row label="Expected duration" value={a.expectedDurationWeeks ? `${a.expectedDurationWeeks} weeks` : 'Not specified'} />
      </View>
      <AssignmentTypeBadge assignmentType={a.assignmentType} />

      <SectionTitle>Who employs you</SectionTitle>
      <EmployerOfRecordCard note={employerOfRecordNote(a.client, false)} />

      <SectionTitle>Status</SectionTitle>
      <View style={s.card}>
        <Row label="Interview" value={a.interviewScheduledAt ? new Date(a.interviewScheduledAt).toLocaleString() : 'Not scheduled'} />
        <ScreeningStatus status={screeningState} />
        <OnboardingStatus status={a.onboardingStatus ?? 'not_started'} />
        <Row label="Start date" value={a.startDate ?? 'Not set'} />
        <Row label="Time/payroll handoff" value={a.timePayrollHandoffAvailable ? 'Available' : 'Not yet available'} />
        {a.retentionCheckpointDueAt ? <Row label="Retention check-in due" value={a.retentionCheckpointDueAt} /> : null}
      </View>

      {manualReview ? (
        <View style={s.card} accessibilityRole="alert">
          <Text style={s.cardTitle}>Screening needs a closer look</Text>
          <Text style={s.body}>
            A person is reviewing this. FairPath does not make an automatic decision from screening results. You will be contacted with next steps.
          </Text>
        </View>
      ) : null}

      <ConversionStatus converted={a.status === 'converted_to_direct_hire'} clientOffered={false} />
      <AssignmentContact contactName={contactAvailable ? 'FairPath Staffing Team' : null} contactRole="Staffing Specialist" contactAvailable={contactAvailable} />

      <SectionTitle>Next action</SectionTitle>
      <StaffingNextAction text={next.text} urgent={next.urgent} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 8 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 14 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  demoRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  demoChip: { borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 10, paddingVertical: 6 },
  demoChipText: { color: t.textSecondary, fontSize: 12, fontWeight: '700' as const },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  status: { color: t.accent, fontWeight: '700' as const, fontSize: 13 },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 10, paddingVertical: 4 },
  rowLabel: { color: t.textSecondary, fontSize: 14 },
  rowValue: { color: t.text, fontSize: 14, fontWeight: '600' as const, flexShrink: 1, textAlign: 'right' as const },
});
