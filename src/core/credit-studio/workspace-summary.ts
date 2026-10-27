import type { Dispute } from '../credit/credit-service.ts';
import { dueLabel } from '../credit/credit-format.ts';

/** Explains Studio counters (e.g. 48 accounts vs 47 to confirm). */
export function explainAccountConfirmCounts(total: number, toConfirm: number): string {
  if (total === 0) return 'Upload a report or add accounts manually to begin.';
  if (toConfirm === 0) return 'Every tracked account has been confirmed or corrected by you.';
  const confirmed = total - toConfirm;
  if (confirmed <= 0) {
    return 'Nothing read from a file is trusted until you confirm each account on the Accounts tab.';
  }
  return `${confirmed} account${confirmed === 1 ? ' is' : 's are'} already confirmed; ${toConfirm} still need your review before they count as yours.`;
}

export type CreditNextStep = {
  title: string;
  body: string;
  actionLabel: string;
  kind: 'upload' | 'manual' | 'accounts' | 'review' | 'dispute' | 'dispute_due' | 'steady';
};

export type CreditProgressStep = {
  id: string;
  label: string;
  done: boolean;
};

export function computeCreditNextStep(input: {
  reports: number;
  uploads: number;
  toConfirm: number;
  openIssues: number;
  confirmedIssues: number;
  disputes: number;
  dueSoon: Dispute[];
}): CreditNextStep {
  const { reports, uploads, toConfirm, openIssues, confirmedIssues, disputes, dueSoon } = input;
  if (!reports && !uploads) {
    return {
      title: 'Add your credit report',
      body: 'Upload a PDF or photo from AnnualCreditReport.com, or type accounts in yourself.',
      actionLabel: 'Add a report',
      kind: 'upload',
    };
  }
  if (uploads > 0 && reports === 0) {
    return {
      title: 'Report saved — accounts not extracted',
      body: 'Your uploaded file is stored, but no accounts have been extracted. Try Analyze report below, or enter accounts manually if analysis is unavailable.',
      actionLabel: 'Add accounts manually',
      kind: 'manual',
    };
  }
  if (toConfirm > 0) {
    return {
      title: `Confirm ${toConfirm} account${toConfirm === 1 ? '' : 's'}`,
      body: 'Check what was read from your file before anything else builds on it.',
      actionLabel: 'Review accounts',
      kind: 'accounts',
    };
  }
  if (openIssues > 0) {
    return {
      title: `Review ${openIssues} possible issue${openIssues === 1 ? '' : 's'}`,
      body: 'These are questions for you — not automatic findings.',
      actionLabel: 'Open review',
      kind: 'review',
    };
  }
  if (confirmedIssues > 0 && disputes === 0) {
    return {
      title: 'Prepare a dispute',
      body: 'You confirmed an issue. Draft a letter when you are ready to send it.',
      actionLabel: 'Start dispute',
      kind: 'dispute',
    };
  }
  if (dueSoon.length > 0) {
    const d = dueSoon[0];
    return {
      title: 'Dispute response needs attention',
      body: dueLabel(d.response_due_on, d.status).text,
      actionLabel: 'Open dispute',
      kind: 'dispute_due',
    };
  }
  return {
    title: 'You are caught up',
    body: 'Check back when you upload a new report or hear from a bureau.',
    actionLabel: 'View progress',
    kind: 'steady',
  };
}

export function computeCreditProgress(input: {
  reports: number;
  uploads: number;
  accounts: number;
  toConfirm: number;
  openIssues: number;
  confirmedIssues: number;
  activeDisputes: number;
}): CreditProgressStep[] {
  const hasReport = input.reports > 0 || input.uploads > 0;
  const accountsReady = input.accounts > 0 && input.toConfirm === 0;
  const reviewClear = hasReport && input.openIssues === 0;
  const disputeTrack = input.activeDisputes > 0 || input.confirmedIssues > 0;
  return [
    { id: 'report', label: 'Report added', done: hasReport },
    { id: 'accounts', label: 'Accounts confirmed', done: accountsReady },
    { id: 'review', label: 'Review complete', done: reviewClear && hasReport },
    { id: 'disputes', label: 'Disputes tracked', done: disputeTrack },
  ];
}
