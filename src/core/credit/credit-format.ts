// Pure helpers for the Credit workspace (no imports, so audits run them under Node).

export type ItemStage = 'negative_item' | 'possible_inaccuracy' | 'member_disputes_accuracy' | 'confirmed_dispute_issue' | 'dismissed';
export type DisputeStatus = 'draft' | 'sent' | 'response_received' | 'resolved' | 'closed';

export const STAGE_INFO: Record<ItemStage, { label: string; short: string; explain: string }> = {
  negative_item: {
    label: 'NEGATIVE ITEM',
    short: 'Negative item',
    explain: 'This account shows negative information. If it is accurate it generally cannot be removed, and disputing accurate information does not help. Only continue if something on it is wrong.',
  },
  possible_inaccuracy: {
    label: 'POSSIBLE INACCURACY',
    short: 'Possible inaccuracy',
    explain: 'FairPath noticed something worth a second look. This is a question for you, not a finding. Check it against your own records.',
  },
  member_disputes_accuracy: {
    label: 'YOU SAY IT IS INACCURATE',
    short: 'You dispute this',
    explain: 'You told us what you believe is wrong, in your own words. FairPath cannot verify it. Confirm it when you are sure.',
  },
  confirmed_dispute_issue: {
    label: 'CONFIRMED ISSUE',
    short: 'Confirmed issue',
    explain: 'You confirmed this is inaccurate. It can be included in a dispute. There is no guarantee about the result of any dispute.',
  },
  dismissed: { label: 'DISMISSED', short: 'Dismissed', explain: 'You decided not to act on this. You can reopen it any time.' },
};

export const ISSUE_LABEL: Record<string, string> = {
  negative_item: 'Negative item',
  duplicate_account: 'Possible duplicate',
  conflicting_balance: 'Balances differ',
  conflicting_status: 'Status differs',
  date_inconsistency: 'Dates do not line up',
  not_mine_reported: 'You say it is not yours',
  missing_information: 'Missing information',
  unclear_extraction: 'Confirm what was read',
  possible_outdated_item: 'Old negative item',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  current: 'Current', late_30: '30 days late', late_60: '60 days late', late_90: '90 days late', late_120_plus: '120+ days late',
  collection: 'In collection', charged_off: 'Charged off', settled: 'Settled', paid_closed: 'Paid and closed', unknown: 'Not listed',
};
export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));

export const EXTRACTION_LABEL: Record<string, { label: string; tone: 'warn' | 'ok' | 'info' }> = {
  extracted: { label: 'READ FROM FILE', tone: 'warn' },
  needs_review: { label: 'NEEDS YOUR REVIEW', tone: 'warn' },
  member_confirmed: { label: 'YOU CONFIRMED', tone: 'ok' },
  corrected_by_member: { label: 'YOU CORRECTED', tone: 'ok' },
};

export const BUREAU_LABEL: Record<string, string> = { equifax: 'Equifax', experian: 'Experian', transunion: 'TransUnion', other: 'Other', unknown: 'Unknown bureau' };

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = { draft: 'Draft', sent: 'Sent', response_received: 'Response received', resolved: 'Resolved', closed: 'Closed' };
export const OUTCOME_LABEL: Record<string, string> = { verified_accurate: 'Verified as accurate', corrected: 'Corrected', removed: 'Removed', no_response: 'No response yet', other: 'Other' };

export function formatCents(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined || cents === '') return '—';
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return (n < 0 ? '-' : '') + '$' + Math.abs(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function dollarsToCents(text: string): number | null | 'invalid' {
  const t = text.trim().replace(/[$,]/g, '');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'invalid';
  return Math.round(Number(t) * 100);
}

export function dateLabel(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** Whole days from `now` to the due date (negative = overdue). Dates are compared as calendar days. */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const due = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

export function dueLabel(dueOn: string | null | undefined, status: DisputeStatus, now: Date = new Date()): { text: string; tone: 'ok' | 'soon' | 'overdue' | 'none' } {
  if (status !== 'sent' || !dueOn) return { text: '', tone: 'none' };
  const d = daysUntil(dueOn, now);
  if (d === null) return { text: '', tone: 'none' };
  if (d < 0) return { text: `Response overdue by ${-d} day${d === -1 ? '' : 's'}`, tone: 'overdue' };
  if (d === 0) return { text: 'Response due today', tone: 'soon' };
  if (d <= 7) return { text: `Response due in ${d} day${d === 1 ? '' : 's'}`, tone: 'soon' };
  return { text: `Response expected by ${dateLabel(dueOn)}`, tone: 'ok' };
}

/** What can happen next for a dispute, from the tracker's real state. */
export function nextDisputeAction(status: DisputeStatus, hasOutcome: boolean): string {
  if (status === 'draft') return 'Review the letter, send it, then record the date you sent it.';
  if (status === 'sent') return 'Wait for a response, and record it when it arrives. If nothing arrives by the due date, follow up.';
  if (status === 'response_received') return hasOutcome ? 'Review the response. You can follow up, start a new dispute with new information, or close this one.' : 'Record what the response said.';
  return 'Nothing further to do.';
}

/** Items that may be attached to a dispute: only ones the member confirmed. */
export function disputableItems<T extends { stage: string }>(items: T[]): T[] {
  return items.filter((i) => i.stage === 'confirmed_dispute_issue');
}

/** Legal-safety wording checks: text FairPath shows must never promise outcomes. */
export const PROMISE_PATTERN = /guarantee|will (be )?(delete|remov)|remove (it|them) (for|from)|boost your score|raise your score|score (will|to) (increase|go up)|fix your credit fast|instantly/i;

export function bureauName(bureau: string | null | undefined): string {
  return BUREAU_LABEL[bureau ?? ''] ?? 'Unknown bureau';
}

export function sortAccountsForReview<T extends { extraction_state: string; furnisher_name: string }>(accounts: T[]): T[] {
  const rank = (s: string) => (s === 'needs_review' || s === 'extracted' ? 0 : 1);
  return [...accounts].sort((a, b) => rank(a.extraction_state) - rank(b.extraction_state) || a.furnisher_name.localeCompare(b.furnisher_name));
}
