import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { BodyText, ChipGroup, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F } from '@/constants/fairpath';
import { loadCreditPresentation } from '@/core/credit-studio/credit-score-provider';
import { computeCreditNextStep, computeCreditProgress, explainAccountConfirmCounts } from '@/core/credit-studio/workspace-summary';
import type { CreditAccount, CreditReport, Dispute, ReviewItem, Upload } from '@/core/credit/credit-service';
import { bureauName, dateLabel } from '@/core/credit/credit-format';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type Props = {
  reports: CreditReport[];
  accounts: CreditAccount[];
  items: ReviewItem[];
  disputes: Dispute[];
  uploads: Upload[];
  toConfirm: CreditAccount[];
  open: ReviewItem[];
  confirmed: ReviewItem[];
  activeDisputes: Dispute[];
  dueSoon: Dispute[];
  bureau: string[];
  onBureauChange: (next: string[]) => void;
  busy: boolean;
  note: string;
  signalRequested: boolean;
  signalLoading: boolean;
  signalText: string;
  onUpload: () => void;
  onSample?: () => void;
  onAskSignal: () => void;
  onGoAccounts: () => void;
  onGoReview: () => void;
  onGoDisputes: () => void;
  onGoLearn: () => void;
  uploadStatus: (u: Upload) => string;
  onReadUpload: (u: Upload) => void;
  onExtendUpload: (id: string) => void;
  onDeleteUpload: (u: Upload) => void;
};

export function CreditStudioHome(props: Props) {
  const s = useThemedStyles(styles);
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [toolsOpen, setToolsOpen] = useState(false);
  const counts = {
    reports: props.reports.length,
    uploads: props.uploads.length,
    accounts: props.accounts.length,
    accountsToConfirm: props.toConfirm.length,
    openIssues: props.open.length,
    confirmedIssues: props.confirmed.length,
    activeDisputes: props.activeDisputes.length,
  };
  const credit = loadCreditPresentation(counts);
  const next = computeCreditNextStep({
    reports: props.reports.length,
    uploads: props.uploads.length,
    toConfirm: props.toConfirm.length,
    openIssues: props.open.length,
    confirmedIssues: props.confirmed.length,
    disputes: props.disputes.length,
    dueSoon: props.dueSoon,
  });
  const progress = computeCreditProgress({
    reports: props.reports.length,
    uploads: props.uploads.length,
    accounts: props.accounts.length,
    toConfirm: props.toConfirm.length,
    openIssues: props.open.length,
    confirmedIssues: props.confirmed.length,
    activeDisputes: props.activeDisputes.length,
  });
  const doneCount = progress.filter((p) => p.done).length;

  function onNext() {
    if (next.kind === 'upload') void props.onUpload();
    else if (next.kind === 'manual') router.push('/credit/add' as never);
    else if (next.kind === 'accounts') props.onGoAccounts();
    else if (next.kind === 'review') props.onGoReview();
    else if (next.kind === 'dispute') router.push('/credit/new-dispute' as never);
    else if (next.kind === 'dispute_due' && props.dueSoon[0]) router.push(('/credit/dispute/' + props.dueSoon[0].id) as never);
    else props.onGoDisputes();
  }

  return (
    <View style={[s.wrap, width >= 768 && s.wrapTablet]}>
      {props.uploads.length ? (
        <View style={s.uploadBlock}>
          <Text style={s.eyebrow}>YOUR SAVED REPORTS</Text>
          {props.uploads.map((u) => (
            <Panel key={u.id}>
              <Text style={s.panelTitle}>{bureauName(u.bureau)} · {u.file_kind.toUpperCase()}</Text>
              <BodyText muted>{props.uploadStatus(u)} · Scheduled removal {dateLabel(u.expires_at)}</BodyText>
              <View style={s.row}>
                {u.status === 'uploaded' ? <TextButton label="ANALYZE REPORT" onPress={() => props.onReadUpload(u)} /> : null}
                <TextButton label="90D" onPress={() => props.onExtendUpload(u.id)} />
                <TextButton tone="danger" label="DELETE" onPress={() => props.onDeleteUpload(u)} />
              </View>
            </Panel>
          ))}
        </View>
      ) : null}
      <Panel tone="accent">
        <Text style={s.eyebrow}>MY CREDIT</Text>
        <Text style={[s.heroTitle, compact && s.heroTitleCompact]}>{credit.headline}</Text>
        <BodyText muted>{credit.detail}</BodyText>
        <Text style={s.partnerLine}>
          {credit.featureRows.find((r) => r.status === 'coming_soon')?.label ?? 'Partner monitoring when approved'}
        </Text>
      </Panel>

      <Panel tone="accent">
        <Text style={s.eyebrow}>MY NEXT STEP</Text>
        <Text style={s.nextTitle}>{next.title}</Text>
        <BodyText>{next.body}</BodyText>
        <PrimaryButton label={next.actionLabel.toUpperCase()} onPress={onNext} />
      </Panel>

      <View style={s.progressPanel} accessibilityRole="summary" accessibilityLabel={`My progress, ${doneCount} of ${progress.length} steps complete`}>
        <View style={s.progressHeader}>
          <Text style={s.eyebrow}>MY PROGRESS</Text>
          <Text style={s.progressSummary}>
            {doneCount}/{progress.length} · {props.activeDisputes.length} active dispute{props.activeDisputes.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={s.progressBarTrack}>
          <View style={[s.progressBarFill, { width: `${Math.round((doneCount / progress.length) * 100)}%` as `${number}%` }]} />
        </View>
        <View style={s.statRow}>
          <Stat label="To confirm" value={props.toConfirm.length} />
          <Stat label="Open questions" value={props.open.length} />
          <Stat label="Accounts" value={props.accounts.length} />
        </View>
        <BodyText muted>{explainAccountConfirmCounts(props.accounts.length, props.toConfirm.length)}</BodyText>
        {props.open.length ? (
          <BodyText muted>
            Open questions ({props.open.length}) are FairPath rule checks on the Review tab — each ties to a specific account or conflict, not a generic counter.
          </BodyText>
        ) : null}
      </View>

      <View style={s.actionGrid}>
        <SecondaryButton label="UPLOAD" onPress={props.onUpload} disabled={props.busy} />
        <SecondaryButton label="ACCOUNTS" onPress={props.onGoAccounts} />
        <SecondaryButton label="REVIEW" onPress={props.onGoReview} />
        <SecondaryButton label="DISPUTES" onPress={props.onGoDisputes} />
      </View>

      <ChipGroup
        single
        label="BUREAU FOR UPLOAD"
        options={[
          { value: 'equifax', label: 'Equifax' },
          { value: 'experian', label: 'Experian' },
          { value: 'transunion', label: 'TransUnion' },
          { value: 'unknown', label: 'Not sure' },
        ]}
        selected={props.bureau}
        onChange={(n) => props.onBureauChange(n.length ? n : ['unknown'])}
      />
      {props.note ? <StatusLine tone="muted">{props.note}</StatusLine> : null}

      {props.signalRequested ? (
        <Panel>
          <Text style={s.eyebrow}>SIGNAL</Text>
          <BodyText muted>{props.signalLoading ? 'Signal is thinking…' : props.signalText}</BodyText>
        </Panel>
      ) : (
        <SecondaryButton label={props.signalLoading ? 'SIGNAL…' : 'ASK SIGNAL ABOUT MY REPORT'} onPress={props.onAskSignal} disabled={props.signalLoading} />
      )}

      {__DEV__ && props.onSample ? <SecondaryButton label="LOAD SAMPLE (DEV)" onPress={props.onSample} disabled={props.busy} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toolsOpen ? 'Hide more credit tools' : 'Show more credit tools'}
        onPress={() => setToolsOpen((v) => !v)}
        style={s.toolsToggle}
      >
        <Text style={s.toolsToggleText}>{toolsOpen ? 'HIDE EXTRA TOOLS' : 'MORE TOOLS'}</Text>
      </Pressable>
      {toolsOpen ? (
        <View style={s.toolsBlock}>
          <ListRow title="Learn" body="Official education links" onPress={props.onGoLearn} />
          <ListRow title="Add account manually" body="Skip upload" onPress={() => router.push('/credit/add' as never)} />
          <ListRow title="Utilization calculator" body="Numbers you enter" onPress={() => router.push('/credit-studio' as never)} />
          <ListRow title="Dispute export" body="PDF or Word history" onPress={() => router.push('/documents/create-credit' as never)} />
          <ListRow title="Correct bureau identity info" body="Not account disputes" onPress={() => router.push('/credit/correct-identity' as never)} />
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.annualcreditreport.com')}>
            <Text style={s.link}>FREE ANNUAL REPORTS (OFFICIAL) →</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  wrap: { paddingBottom: 12, gap: 12 },
  wrapTablet: { maxWidth: 720, alignSelf: 'center' as const, width: '100%' as const },
  eyebrow: { color: t.accentText, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1.4 },
  heroTitle: { color: t.text, fontFamily: F.black, fontSize: 24, lineHeight: 28, marginTop: 6, marginBottom: 4 },
  heroTitleCompact: { fontSize: 20, lineHeight: 24 },
  nextTitle: { color: t.text, fontFamily: F.black, fontSize: 18, lineHeight: 22, marginVertical: 6 },
  panelTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 14, marginBottom: 4 },
  link: { color: t.accentText, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.6, marginTop: 8 },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, marginTop: 6 },
  partnerLine: { color: t.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  progressPanel: {
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: 14,
  },
  progressHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-end' as const, gap: 8 },
  progressSummary: { color: t.textMuted, fontFamily: F.bold, fontSize: 10 },
  progressBarTrack: { height: 4, backgroundColor: t.border, marginTop: 12, overflow: 'hidden' as const },
  progressBarFill: { height: 4, backgroundColor: t.accentText },
  statRow: { flexDirection: 'row' as const, marginTop: 14, gap: 8 },
  stat: { flex: 1, minWidth: 88 },
  statValue: { color: t.text, fontFamily: F.black, fontSize: 22 },
  statLabel: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 0.5, marginTop: 2 },
  actionGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  uploadBlock: { gap: 8, marginTop: 4 },
  toolsToggle: { paddingVertical: 10, alignItems: 'center' as const },
  toolsToggleText: { color: t.accentText, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  toolsBlock: { gap: 4 },
});
