import type { OpportunityResult } from './types.ts';

/** Collapse identical underlying records (same resource or marketplace item). */
export function dedupeOpportunityResults(rows: OpportunityResult[]): OpportunityResult[] {
  const seen = new Map<string, OpportunityResult>();
  for (const row of rows) {
    const prev = seen.get(row.dedupeKey);
    if (!prev) {
      seen.set(row.dedupeKey, row);
      continue;
    }
    // Prefer higher-confidence availability, then shorter reason chain
    const rank = (a: OpportunityResult) =>
      (a.availability === 'confirmed_active' ? 4 : a.availability === 'contact_required' ? 3 : a.availability === 'listed_unverified' ? 2 : 1);
    if (rank(row) > rank(prev)) seen.set(row.dedupeKey, row);
  }
  return [...seen.values()];
}
