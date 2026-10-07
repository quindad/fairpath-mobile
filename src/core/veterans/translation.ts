// Military occupation to civilian career translation. A translation is shown only when a subject-matter-reviewed mapping
// exists for that exact code and branch. Nothing is guessed: unreviewed codes return 'not_reviewed'.
// The reviewed mapping table is intentionally empty in this pass. It must be populated by a reviewed data import.

import type { BranchId } from './branches.ts';

export type ReviewedTranslation = {
  branch: BranchId;
  code: string;
  civilianRoles: readonly string[];
  reviewedBy: string;
  reviewedOn: string; // ISO date
};

export type TranslationResult =
  | { status: 'reviewed'; roles: readonly string[]; reviewedBy: string; reviewedOn: string }
  | { status: 'not_reviewed' };

/** Empty until a reviewed import. Do not add unreviewed entries here. */
export const REVIEWED_TRANSLATIONS: readonly ReviewedTranslation[] = [];

export function translateOccupation(
  branch: BranchId,
  code: string,
  table: readonly ReviewedTranslation[] = REVIEWED_TRANSLATIONS,
): TranslationResult {
  const normalized = code.trim().toUpperCase();
  const hit = table.find((t) => t.branch === branch && t.code.toUpperCase() === normalized);
  if (!hit) return { status: 'not_reviewed' };
  return { status: 'reviewed', roles: hit.civilianRoles, reviewedBy: hit.reviewedBy, reviewedOn: hit.reviewedOn };
}
