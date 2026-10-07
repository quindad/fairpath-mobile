// Client rate card architecture: effective-dated, role- and location-specific commercial terms. DATA ARCHITECTURE
// ONLY — no real pricing is invented here, and nothing here activates billing. A template becomes a real RateCard
// (economics.ts) only when an authorized FairPath staffing operator fills in actual numbers for a client.

export type RateCardTemplate = {
  id: string;
  clientOrganizationId: string;
  roleTitle: string;
  location: string;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null; // null = open-ended
  payRangeMinHourly: number | null;
  payRangeMaxHourly: number | null;
  billRateHourly: number | null; // null until the client agrees to a rate
  markupPercent: number | null; // alternate to a flat bill rate: bill = pay * (1 + markup)
  eorCostAssumptionHourly: number | null;
  overtimeRulesText: string | null; // plain-language description; no overtime math is invented here
  screeningRequirementsText: string | null;
  assignmentMinimumWeeks: number | null;
};

/** A template is usable to build a real rate card only once it has committed numbers, not just ranges or ambitions.
 * A resolvable bill rate (explicit, or derivable from markup + pay range) counts as committed. */
export function templateIsComplete(t: RateCardTemplate): boolean {
  return resolveBillRateHourly(t) !== null && t.eorCostAssumptionHourly !== null;
}

/** Finds the template that applies on a given date for a client/role/location, respecting effective dating. */
export function templateEffectiveOn(templates: readonly RateCardTemplate[], clientOrganizationId: string, roleTitle: string, location: string, onDate: string): RateCardTemplate | null {
  const candidates = templates.filter(
    (t) => t.clientOrganizationId === clientOrganizationId && t.roleTitle === roleTitle && t.location === location &&
      t.effectiveFrom <= onDate && (t.effectiveTo === null || t.effectiveTo > onDate),
  );
  if (candidates.length === 0) return null;
  // Most recently effective wins if more than one somehow overlaps (should not happen with correct data entry).
  return [...candidates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]!;
}

/** Bill rate from a template: explicit rate wins; otherwise derive from markup over the pay range midpoint, if both exist. */
export function resolveBillRateHourly(t: RateCardTemplate): number | null {
  if (t.billRateHourly !== null) return t.billRateHourly;
  if (t.markupPercent !== null && t.payRangeMinHourly !== null && t.payRangeMaxHourly !== null) {
    const mid = (t.payRangeMinHourly + t.payRangeMaxHourly) / 2;
    return Math.round(mid * (1 + t.markupPercent / 100) * 100) / 100;
  }
  return null;
}
