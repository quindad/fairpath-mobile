// Staffing economics. INTERNAL-ONLY: never import this from a member-facing screen. Computes gross spread, which is
// explicitly NOT the same thing as profit — it has not yet absorbed overhead, bad-debt risk, or anything beyond the
// listed direct costs. Every output carries that distinction so nobody downstream can round it off to "profit".

export type RateCard = {
  payRateHourly: number; // what the worker is paid
  billRateHourly: number; // what the client is billed
  eorCostHourly: number; // EOR/back-office fee (FoxHire or future provider), per hour
  screeningCostFlat: number; // one-time screening cost, amortized below
  statutoryBurdenPercent: number; // employer taxes, workers' comp, etc., as a percent of pay rate
  expectedWeeklyHours: number; // for amortizing the flat screening cost
  expectedAssignmentWeeks: number; // for amortizing the flat screening cost
};

export type EconomicsResult = {
  grossSpreadHourly: number; // bill rate - pay rate - EOR cost, NOT profit
  statutoryBurdenHourly: number;
  amortizedScreeningHourly: number;
  estimatedContributionHourly: number; // grossSpread - statutory burden - amortized screening; still not profit
  label: typeof GROSS_SPREAD_LABEL;
};

export const GROSS_SPREAD_LABEL =
  'Gross spread (not profit — overhead, risk and other costs are not reflected here)' as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeEconomics(rc: RateCard): EconomicsResult {
  const grossSpreadHourly = round2(rc.billRateHourly - rc.payRateHourly - rc.eorCostHourly);
  const statutoryBurdenHourly = round2(rc.payRateHourly * (rc.statutoryBurdenPercent / 100));
  const totalHours = Math.max(1, rc.expectedWeeklyHours * rc.expectedAssignmentWeeks);
  const amortizedScreeningHourly = round2(rc.screeningCostFlat / totalHours);
  const estimatedContributionHourly = round2(grossSpreadHourly - statutoryBurdenHourly - amortizedScreeningHourly);
  return { grossSpreadHourly, statutoryBurdenHourly, amortizedScreeningHourly, estimatedContributionHourly, label: GROSS_SPREAD_LABEL };
}

/** Fields that must never reach a member-facing type or screen. Used by tests to guard the redaction boundary. */
export const INTERNAL_ONLY_FIELDS = [
  'billRateHourly', 'eorCostHourly', 'screeningCostFlat', 'statutoryBurdenPercent',
  'grossSpreadHourly', 'statutoryBurdenHourly', 'amortizedScreeningHourly', 'estimatedContributionHourly',
] as const;
