// Credit Studio utilization and plan logic. Pure functions on member-entered numbers. No score is fabricated: the
// utilization figures describe the entered balances and limits only. Any projection must be labeled hypothetical by the UI.

export type RevolvingAccount = { name: string; balanceUsd: number; limitUsd: number };

export type UtilizationResult =
  | { status: 'ok'; overallPercent: number; perAccount: { name: string; percent: number }[] }
  | { status: 'missing_limits'; accounts: string[] }
  | { status: 'no_accounts' };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function utilization(accounts: readonly RevolvingAccount[]): UtilizationResult {
  if (accounts.length === 0) return { status: 'no_accounts' };
  const missing = accounts.filter((a) => !(a.limitUsd > 0)).map((a) => a.name);
  if (missing.length > 0) return { status: 'missing_limits', accounts: missing };
  const limit = accounts.reduce((s, a) => s + a.limitUsd, 0);
  const balance = accounts.reduce((s, a) => s + Math.max(0, a.balanceUsd), 0);
  return {
    status: 'ok',
    overallPercent: round1((balance / limit) * 100),
    perAccount: accounts.map((a) => ({ name: a.name, percent: round1((Math.max(0, a.balanceUsd) / a.limitUsd) * 100) })),
  };
}

/** Plain-language band. Descriptive only; not a credit score and not a prediction. */
export function utilizationBand(percent: number): 'low' | 'moderate' | 'high' {
  if (percent < 30) return 'low';
  if (percent < 60) return 'moderate';
  return 'high';
}

/** Hypothetical single-month projection: how much balance must move to reach a target utilization. Never a score. */
export function paydownToTarget(balanceUsd: number, limitUsd: number, targetPercent: number): number {
  if (!(limitUsd > 0)) return 0;
  const targetBalance = (targetPercent / 100) * limitUsd;
  return Math.max(0, Math.round((balanceUsd - targetBalance) * 100) / 100);
}
