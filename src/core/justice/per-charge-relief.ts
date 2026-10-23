import { executeRecordRelief } from '../record-relief/engine-executor.ts';
import { daysUntil } from '../record-relief/shared-engine.ts';
import type { CaseBundle } from '../record-relief/jurisdiction-engine.ts';
import type { ChargeReliefPreview } from './types.ts';

/** In-memory Record Relief preview per charge (no persistence). Never invents countdowns without dates. */
export function previewReliefForBundle(bundle: CaseBundle, asOf = new Date()): ChargeReliefPreview[] {
  const out = executeRecordRelief(bundle, { today: asOf.toISOString().slice(0, 10) });
  const byCharge = new Map<string, ChargeReliefPreview>();
  for (const r of out.results) {
    for (const chargeId of r.chargeIds) {
      const prior = byCharge.get(chargeId);
      const eligibilityDate = r.eligibilityDate ?? null;
      const daysRemaining =
        eligibilityDate && /^\d{4}-\d{2}-\d{2}$/.test(eligibilityDate) ? daysUntil(eligibilityDate, asOf) : null;
      const next: ChargeReliefPreview = {
        chargeId,
        outcome: r.outcome,
        eligibilityDate,
        daysRemaining: daysRemaining === null ? null : Math.max(daysRemaining, 0),
        reasons: r.reasons.map((t) => ({ code: 'rule', text: t })),
        missingFacts: r.missingFacts,
        ruleKey: r.source?.citation ?? null,
        evaluatedAt: asOf.toISOString(),
      };
      if (!prior || (next.eligibilityDate && !prior.eligibilityDate)) byCharge.set(chargeId, next);
    }
  }
  return [...byCharge.values()];
}
