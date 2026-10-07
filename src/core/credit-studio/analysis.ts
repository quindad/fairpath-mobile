// Credit Studio report analysis. Works on tradeline records the member has reviewed. Findings are POSSIBLE inaccuracies
// until the member confirms them. Accurate negative information is never flagged merely for being negative. Dispute
// drafts are Premium-only per the frozen V1 specification and never state facts that are not in confirmed findings.

import { tierMayUse, type TierId } from '../membership/frozen-v1.ts';

export type Bureau = 'equifax' | 'experian' | 'transunion';

export type Tradeline = {
  id: string;
  creditor: string;
  accountRef: string; // last digits or internal reference only; never a full account number
  bureau: Bureau;
  balanceUsd: number | null;
  limitUsd: number | null;
  status: 'current' | 'late_30' | 'late_60' | 'late_90' | 'collection' | 'charge_off' | 'closed' | 'unknown';
  reportedDate: string | null; // ISO
  sourcePage: number;
};

export type FindingKind = 'possible_duplicate' | 'bureau_conflict' | 'missing_balance' | 'missing_limit' | 'possible_identity_mismatch';

export type Finding = {
  id: string;
  kind: FindingKind;
  tradelineIds: string[];
  summary: string;
  /** Always 'possible' from analysis. Only the member can move a finding to confirmed. */
  certainty: 'possible' | 'confirmed_by_member';
  evidence: { tradelineId: string; bureau: Bureau; sourcePage: number }[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function analyzeTradelines(lines: readonly Tradeline[]): Finding[] {
  const findings: Finding[] = [];
  let n = 0;
  const add = (kind: FindingKind, group: Tradeline[], summary: string) => {
    n += 1;
    findings.push({
      id: `f${n}`,
      kind,
      tradelineIds: group.map((t) => t.id),
      summary,
      certainty: 'possible',
      evidence: group.map((t) => ({ tradelineId: t.id, bureau: t.bureau, sourcePage: t.sourcePage })),
    });
  };

  // Same creditor, same account reference, same balance and status on one report: possible duplicate.
  const byKey = new Map<string, Tradeline[]>();
  for (const t of lines) {
    const key = `${norm(t.creditor)}|${t.accountRef}|${t.bureau}`;
    byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }
  for (const group of byKey.values()) {
    if (group.length > 1) add('possible_duplicate', group, `${group[0]!.creditor} appears ${group.length} times on the same report. Check whether these are one account.`);
  }

  // Same account across bureaus with different balances: discrepancy to compare, not a verified error.
  const byAccount = new Map<string, Tradeline[]>();
  for (const t of lines) {
    const key = `${norm(t.creditor)}|${t.accountRef}`;
    byAccount.set(key, [...(byAccount.get(key) ?? []), t]);
  }
  for (const group of byAccount.values()) {
    const bureaus = new Set(group.map((t) => t.bureau));
    if (bureaus.size < 2) continue;
    const balances = new Set(group.map((t) => t.balanceUsd));
    if (balances.size > 1) add('bureau_conflict', group, `${group[0]!.creditor} shows different balances across bureaus. Compare with your statement.`);
  }

  for (const t of lines) {
    if (t.balanceUsd === null) add('missing_balance', [t], `${t.creditor} has no balance listed on ${t.bureau}.`);
    if (t.balanceUsd !== null && t.limitUsd === null && t.status === 'current') {
      add('missing_limit', [t], `${t.creditor} is open with no credit limit listed on ${t.bureau}. Utilization cannot be calculated for it.`);
    }
  }

  return findings;
}

/** Only the member can change certainty. Analysis output never confirms itself. */
export function confirmFinding(finding: Finding): Finding {
  return { ...finding, certainty: 'confirmed_by_member' };
}

export type DisputeDraft =
  | { status: 'blocked'; reason: 'premium_required' | 'no_confirmed_findings' }
  | { status: 'ready'; text: string };

export const DISPUTE_DISCLAIMER =
  'Draft for your review. Read every line before you send it. FairPath does not send disputes for you and does not guarantee any removal or score change.';

/**
 * Builds a plain-text dispute letter from CONFIRMED findings only. Premium-only per the frozen spec. Uses only facts
 * the member confirmed; no fabricated statements.
 */
export function draftDispute(tier: TierId, findings: readonly Finding[], memberName: string, bureau: Bureau): DisputeDraft {
  if (!tierMayUse(tier, 'dispute_letter_draft')) return { status: 'blocked', reason: 'premium_required' };
  const confirmed = findings.filter((f) => f.certainty === 'confirmed_by_member' && f.evidence.some((e) => e.bureau === bureau));
  if (confirmed.length === 0) return { status: 'blocked', reason: 'no_confirmed_findings' };
  const lines = confirmed.map((f, i) => `${i + 1}. ${f.summary}`);
  const text = [
    `To the ${bureau} dispute department:`,
    '',
    `I am ${memberName.trim() || '[your name]'} and I am writing about information on my credit report that I believe needs review.`,
    '',
    'I ask you to investigate the following items:',
    ...lines,
    '',
    'Please send me the results of your investigation in writing.',
    '',
    '[Sign and date here]',
    '',
    DISPUTE_DISCLAIMER,
  ].join('\n');
  return { status: 'ready', text };
}

export type ExportResult =
  | { status: 'ready'; mime: 'text/plain'; body: string }
  | { status: 'unavailable'; reason: 'pdf_renderer_not_installed' | 'docx_renderer_not_installed' };

/** Plain text works now. PDF and DOCX stay unavailable until their renderers are approved and installed. */
export function exportDraft(text: string, format: 'txt' | 'pdf' | 'docx'): ExportResult {
  if (format === 'txt') return { status: 'ready', mime: 'text/plain', body: text };
  if (format === 'pdf') return { status: 'unavailable', reason: 'pdf_renderer_not_installed' };
  return { status: 'unavailable', reason: 'docx_renderer_not_installed' };
}
