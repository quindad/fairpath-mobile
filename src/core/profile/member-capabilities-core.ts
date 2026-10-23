/** Pure capability model (no Supabase) — safe for Node tests. */

export type CapabilityChoice = 'yes' | 'no' | 'prefer_not_to_say';

export type MemberCapabilities = {
  justice: CapabilityChoice;
  veteran: CapabilityChoice;
};

export const VETERAN_TOOLS_QUESTION_ID = 'member.veteran_tools_opt_in';

export function normalizeCapabilityChoice(raw: unknown): CapabilityChoice {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'yes' || t === 'true') return 'yes';
  if (t === 'no' || t === 'false') return 'no';
  if (t === 'prefer not to say' || t === 'prefer_not_to_say') return 'prefer_not_to_say';
  return 'prefer_not_to_say';
}

export function parseJusticeImpactedField(raw: string | null | undefined): CapabilityChoice {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'yes') return 'yes';
  if (t === 'no') return 'no';
  if (t === 'prefer not to say') return 'prefer_not_to_say';
  return 'prefer_not_to_say';
}

export function justiceToolsEnabled(c: MemberCapabilities | null | undefined): boolean {
  return c?.justice === 'yes';
}

export function veteranToolsEnabled(c: MemberCapabilities | null | undefined): boolean {
  return c?.veteran === 'yes';
}

export function capabilitiesFromOnboardingToolStep(selected: string[]): Pick<MemberCapabilities, 'justice' | 'veteran'> {
  const hasReentry = selected.includes('Reentry & record relief');
  const hasVeteran = selected.includes('Veteran transition');
  const neither = selected.includes('Neither — skip for now');
  if (neither && !hasReentry && !hasVeteran) {
    return { justice: 'no', veteran: 'no' };
  }
  return {
    justice: hasReentry ? 'yes' : 'no',
    veteran: hasVeteran ? 'yes' : 'no',
  };
}

export function toProfileJusticeField(choice: CapabilityChoice): string {
  if (choice === 'yes') return 'Yes';
  if (choice === 'no') return 'No';
  return 'Prefer not to say';
}

export function filterNextStepsForCapabilities<T extends { reason: string }>(steps: T[], caps: MemberCapabilities | null): T[] {
  const justice = justiceToolsEnabled(caps);
  const veteran = veteranToolsEnabled(caps);
  return steps
    .filter((s) => justice || !s.reason.startsWith('record_relief'))
    .filter((s) => veteran || !s.reason.includes('veteran'));
}

export function filterGoalLabels(goals: string[], caps: MemberCapabilities | null): string[] {
  return goals.filter((g) => {
    if (g === 'Reentry' && !justiceToolsEnabled(caps)) return false;
    if (g === 'Veteran transition' && !veteranToolsEnabled(caps)) return false;
    return true;
  });
}
