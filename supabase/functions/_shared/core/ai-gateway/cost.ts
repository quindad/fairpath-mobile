// Cost estimation from token counts. Prices are configuration, never code. A model with no verified price returns null,
// so telemetry shows "unknown" rather than a number someone guessed. Units are micro-USD per million tokens.
export type Price = { inputPerMTokMicroUsd: number; outputPerMTokMicroUsd: number };
export type PriceTable = Record<string, Price>;

export function estimateCostMicroUsd(usage: { model: string; inputTokens: number; outputTokens: number }, prices: PriceTable): number | null {
  const p = prices[usage.model];
  if (!p) return null;
  return Math.round((usage.inputTokens * p.inputPerMTokMicroUsd + usage.outputTokens * p.outputPerMTokMicroUsd) / 1_000_000);
}
