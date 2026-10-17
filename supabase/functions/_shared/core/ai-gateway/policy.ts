// Deterministic output guard. A model may describe, draft and summarize. It may not state a decision about a person,
// a home, a job, a score, or a legal outcome. This is a backstop behind the workflow contracts and the product's own
// authorization, not the primary control. A tripped guard is never retried on another model, because the same kind
// of answer would be produced again and the person would be exposed to it twice.
import type { OutputKind } from './specs.ts';

const DECISION_PATTERNS: RegExp[] = [
  /\b(is|are|was|were|has been|have been)\s+(approved|denied|rejected|accepted|declined)\b/i,
  /\b(denying|rejecting|declining|approving|accepting)\s+(this|the|that|your|an?)\s+(applicant|applicants|candidate|candidates|tenant|tenants|renter|renters|application|applications)\b/i,
  /\byou will (be )?(hired|placed|approved|housed|accepted|rejected|denied)\b/i,
  /\b(rejected|denied|declined) you\b/i,
  /\byou are (eligible|ineligible|guaranteed|disqualified)\b/i,
  /\bguaranteed (approval|hire|hiring|housing|placement|acceptance)\b/i,
  /\brisk score\b/i,
  /\b(boost|raise) your score\b/i,
  /\bscore will (rise|increase|go up)\b/i,
  /\bdispute will succeed\b/i,
  /\bwill (be )?expung/i,
  /\bqualify for expung/i,
  /\bscore\s*[:=]\s*\d/i,
  /\b\d+\s*(out of|\/)\s*100\b.*\b(candidate|applicant|tenant|renter|person|risk)\b/i,
];

export type GuardResult = { ok: true } | { ok: false; reason: 'decision_language' };

export function guardOutput(text: string): GuardResult {
  for (const p of DECISION_PATTERNS) if (p.test(text)) return { ok: false, reason: 'decision_language' };
  return { ok: true };
}

const FALLBACK: Record<OutputKind, string> = {
  draft: 'Signal could not prepare a draft right now. Use the standard template and write it yourself.',
  read_only_summary: 'Signal could not summarize these records right now. Open the list to review them directly.',
  explanation: 'Signal could not explain this right now. Review the source records and rules directly.',
  structured: 'Signal could not produce structured output right now. Enter the details manually.',
};

export function fallbackTextFor(kind: OutputKind): string {
  return FALLBACK[kind];
}
