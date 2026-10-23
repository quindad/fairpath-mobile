import type { Conviction } from '../profile/conviction-service.ts';
import type { ReliefCase } from '../record-relief/relief-service.ts';
import type { JusticeRecordSource, UnifiedJusticeCase } from './types.ts';
import {
  convictionToUnifiedCase,
  docketMergeKey,
  recordReliefCaseToUnified,
} from './mappers.ts';

/**
 * Builds a de-duplicated list of dockets from the two live member stores.
 * Does not write to the database; avoids inventing a third store before migration approval.
 */
export function assembleUnifiedJusticeCases(
  convictions: readonly Conviction[],
  reliefCases: readonly ReliefCase[],
): UnifiedJusticeCase[] {
  const manualConvictions = convictions.filter((c) => c.origin === 'manual');
  const byKey = new Map<string, UnifiedJusticeCase>();
  const standalone: UnifiedJusticeCase[] = [];

  for (const c of manualConvictions) {
    const row = convictionToUnifiedCase(c);
    const key = docketMergeKey(row.jurisdictionCode, row.caseNumber);
    if (key) byKey.set(key, row);
    else standalone.push(row);
  }

  for (const rr of reliefCases) {
    const row = recordReliefCaseToUnified(rr);
    const key = docketMergeKey(row.jurisdictionCode, row.caseNumber);
    if (key && byKey.has(key)) {
      const existing = byKey.get(key)!;
      byKey.set(key, {
        ...existing,
        id: `merged:${existing.id}:${row.id}`,
        docketLabel: existing.docketLabel || row.docketLabel,
        sources: Array.from(new Set([...existing.sources, 'record_relief'])) as JusticeRecordSource[],
        charges: [...existing.charges, ...row.charges],
        memberNotes: existing.memberNotes ?? row.memberNotes,
        updatedAt: [existing.updatedAt, row.updatedAt].filter(Boolean).sort().pop() ?? null,
        verificationState:
          existing.verificationState === 'needs_review' || row.verificationState === 'needs_review'
            ? 'needs_review'
            : existing.verificationState,
      });
    } else if (key) {
      byKey.set(key, row);
    } else {
      standalone.push(row);
    }
  }

  const merged = [...byKey.values(), ...standalone];
  merged.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return merged;
}
