// Staffing economics. INTERNAL-ONLY: never import this from a member-facing screen. Computes gross spread, which is
// explicitly NOT the same thing as profit — it has not yet absorbed overhead, bad-debt risk, or anything beyond the
// listed direct costs. Estimated contribution is likewise NOT guaranteed profit. Every output carries that
// distinction so nobody downstream can round it off to "profit".

export type RateCard = {
  payRateHourly: number; // what the worker is paid for regular hours
  billRateHourly: number; // what the client is billed for regular hours
  overtimePayRateHourly: number | null; // null when overtime is not configured for this assignment
  overtimeBillRateHourly: number | null;
  eorCostHourly: number; // EOR/back-office fee (FoxHire or future provider), per regular hour
  screeningCostFlat: number; // one-time screening cost, amortized below
  statutoryBurdenPercent: number; // employer taxes, workers' comp, etc., as a percent of pay rate
  otherAssignmentCostFlat: number; // any other one-time cost supplied, amortized the same way as screening
  expectedWeeklyRegularHours: number;
  expectedWeeklyOvertimeHours: number; // 0 when overtime is not configured
  expectedAssignmentWeeks: number;
};

export type EconomicsError =
  | 'invalid_rate' // a rate is negative, zero where a positive value is required, or non-finite
  | 'bill_below_pay' // bill rate is less than pay rate; every hour worked would lose money before any other cost
  | 'invalid_hours'; // weekly hours or assignment weeks are negative

export type EconomicsResult = {
  grossSpreadHourly: number; // bill rate - pay rate - EOR cost, regular hours only, NOT profit
  overtimeGrossSpreadHourly: number | null; // same, for overtime hours, when configured
  statutoryBurdenHourly: number;
  amortizedScreeningHourly: number;
  amortizedOtherCostHourly: number;
  estimatedContributionHourly: number; // grossSpread - statutory burden - amortized costs; still not profit
  label: typeof GROSS_SPREAD_LABEL;
};

export const GROSS_SPREAD_LABEL =
  'Gross spread (not profit — overhead, risk and other costs are not reflected here)' as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const finite = (n: number) => Number.isFinite(n);

export function validateRateCard(rc: RateCard): { ok: true } | { ok: false; error: EconomicsError } {
  if (!finite(rc.payRateHourly) || rc.payRateHourly <= 0) return { ok: false, error: 'invalid_rate' };
  if (!finite(rc.billRateHourly) || rc.billRateHourly <= 0) return { ok: false, error: 'invalid_rate' };
  if (!finite(rc.eorCostHourly) || rc.eorCostHourly < 0) return { ok: false, error: 'invalid_rate' };
  if (!finite(rc.statutoryBurdenPercent) || rc.statutoryBurdenPercent < 0) return { ok: false, error: 'invalid_rate' };
  if (!finite(rc.screeningCostFlat) || rc.screeningCostFlat < 0) return { ok: false, error: 'invalid_rate' };
  if (!finite(rc.otherAssignmentCostFlat) || rc.otherAssignmentCostFlat < 0) return { ok: false, error: 'invalid_rate' };
  if (rc.overtimePayRateHourly !== null && (!finite(rc.overtimePayRateHourly) || rc.overtimePayRateHourly <= 0)) return { ok: false, error: 'invalid_rate' };
  if (rc.overtimeBillRateHourly !== null && (!finite(rc.overtimeBillRateHourly) || rc.overtimeBillRateHourly <= 0)) return { ok: false, error: 'invalid_rate' };
  if (rc.billRateHourly < rc.payRateHourly) return { ok: false, error: 'bill_below_pay' };
  if (rc.overtimeBillRateHourly !== null && rc.overtimePayRateHourly !== null && rc.overtimeBillRateHourly < rc.overtimePayRateHourly) return { ok: false, error: 'bill_below_pay' };
  if (rc.expectedWeeklyRegularHours < 0 || rc.expectedWeeklyOvertimeHours < 0 || rc.expectedAssignmentWeeks < 0) return { ok: false, error: 'invalid_hours' };
  return { ok: true };
}

export function computeEconomics(rc: RateCard): { ok: true; result: EconomicsResult } | { ok: false; error: EconomicsError } {
  const valid = validateRateCard(rc);
  if (!valid.ok) return valid;

  const grossSpreadHourly = round2(rc.billRateHourly - rc.payRateHourly - rc.eorCostHourly);
  const overtimeGrossSpreadHourly =
    rc.overtimePayRateHourly !== null && rc.overtimeBillRateHourly !== null
      ? round2(rc.overtimeBillRateHourly - rc.overtimePayRateHourly - rc.eorCostHourly)
      : null;
  const statutoryBurdenHourly = round2(rc.payRateHourly * (rc.statutoryBurdenPercent / 100));

  const totalHours = Math.max(1, (rc.expectedWeeklyRegularHours + rc.expectedWeeklyOvertimeHours) * rc.expectedAssignmentWeeks);
  const amortizedScreeningHourly = round2(rc.screeningCostFlat / totalHours);
  const amortizedOtherCostHourly = round2(rc.otherAssignmentCostFlat / totalHours);

  const estimatedContributionHourly = round2(
    grossSpreadHourly - statutoryBurdenHourly - amortizedScreeningHourly - amortizedOtherCostHourly,
  );

  return {
    ok: true,
    result: {
      grossSpreadHourly, overtimeGrossSpreadHourly, statutoryBurdenHourly,
      amortizedScreeningHourly, amortizedOtherCostHourly, estimatedContributionHourly, label: GROSS_SPREAD_LABEL,
    },
  };
}

/** Fields that must never reach a member-facing type or screen. Used by tests to guard the redaction boundary. */
export const INTERNAL_ONLY_FIELDS = [
  'billRateHourly', 'overtimeBillRateHourly', 'eorCostHourly', 'screeningCostFlat', 'otherAssignmentCostFlat',
  'statutoryBurdenPercent', 'grossSpreadHourly', 'overtimeGrossSpreadHourly', 'statutoryBurdenHourly',
  'amortizedScreeningHourly', 'amortizedOtherCostHourly', 'estimatedContributionHourly',
] as const;

// ---------------------------------------------------------------------
// Economics card row builder. Shapes results for an internal ops table/card UI. This is data only — no React
// component lives here, and NOTHING in this file may be imported from src/app (member routes). The ops workspace
// that eventually renders this belongs in the Command Center/Partner repo, not here; see docs/SYSTEM_MAP_V1.md.
// ---------------------------------------------------------------------
export type EconomicsCardRow = { label: string; value: string; note?: string };

export function buildEconomicsCardRows(rc: RateCard, r: EconomicsResult): EconomicsCardRow[] {
  const rows: EconomicsCardRow[] = [
    { label: 'Pay rate', value: `$${rc.payRateHourly.toFixed(2)}/hr` },
    { label: 'Bill rate', value: `$${rc.billRateHourly.toFixed(2)}/hr` },
    { label: 'EOR cost', value: `$${rc.eorCostHourly.toFixed(2)}/hr` },
    { label: 'Statutory burden', value: `$${r.statutoryBurdenHourly.toFixed(2)}/hr`, note: `${rc.statutoryBurdenPercent}% of pay rate` },
    { label: 'Amortized screening', value: `$${r.amortizedScreeningHourly.toFixed(2)}/hr` },
    { label: 'Amortized other costs', value: `$${r.amortizedOtherCostHourly.toFixed(2)}/hr` },
    { label: 'Gross spread', value: `$${r.grossSpreadHourly.toFixed(2)}/hr`, note: GROSS_SPREAD_LABEL },
    { label: 'Estimated contribution', value: `$${r.estimatedContributionHourly.toFixed(2)}/hr`, note: 'Not guaranteed profit' },
  ];
  if (r.overtimeGrossSpreadHourly !== null) {
    rows.push({ label: 'Overtime gross spread', value: `$${r.overtimeGrossSpreadHourly.toFixed(2)}/hr`, note: GROSS_SPREAD_LABEL });
  }
  return rows;
}
