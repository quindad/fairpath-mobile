// Reentry preparation contract. Helps a member get ready for staffing (work readiness, ID/document readiness,
// transportation planning, volunteered schedule constraints, credentials, resume, fair-chance discovery) without
// ever turning Reentry pathway membership, conviction details, or case-management history into a staffing score
// or a candidate label. The fair-chance disclosure rule stays entirely in src/core/matching/fair-chance.ts.

export type ReentryPreparationInput = {
  workReadinessNotes: string;
  idDocumentReadiness: 'not_started' | 'in_progress' | 'ready';
  transportationPlanText: string;
  scheduleConstraintsText: string; // volunteered by the member, not inferred
  credentials: readonly string[];
  resumeText: string;
};

export type ReentryPreparationStatus = {
  readyForAssignment: boolean;
  openItems: string[];
};

/** Readiness is derived only from preparation facts, never from pathway membership or record details. */
export function assessReadiness(input: ReentryPreparationInput): ReentryPreparationStatus {
  const openItems: string[] = [];
  if (input.idDocumentReadiness !== 'ready') openItems.push('ID and documents');
  if (!input.transportationPlanText.trim()) openItems.push('Transportation plan');
  if (!input.resumeText.trim()) openItems.push('Resume');
  return { readyForAssignment: openItems.length === 0, openItems };
}

/** Skills and credentials only — exactly what a candidate submission is allowed to carry. No pathway, no record data. */
export function skillsFromReentryPrep(input: ReentryPreparationInput): string[] {
  return [...input.credentials];
}

/** Fields that must never appear in a candidate submission, a match explanation, or any employer-facing surface. */
export const REENTRY_FORBIDDEN_LABELS = ['reentry candidate', 'felon', 'formerly incarcerated', 'justice-impacted', 'ex-offender'];

/** True if any forbidden label appears in a piece of text meant for an employer. Used to gate output before it ships. */
export function containsForbiddenReentryLabel(text: string): boolean {
  const lower = text.toLowerCase();
  return REENTRY_FORBIDDEN_LABELS.some((label) => lower.includes(label));
}
