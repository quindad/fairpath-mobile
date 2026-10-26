/**
 * Honest engineering coverage status for Record Relief jurisdictions.
 * Registry entries ≠ attorney-reviewed legal coverage.
 */
import type { JurisdictionCompleteness } from './rule-contract.ts';
import { NATIONWIDE_COMPLETENESS_BY_CODE } from './nationwide-completeness.ts';

export type JurisdictionCoverageStatus =
  | 'implemented_source_supported'
  | 'implemented_needs_facts'
  | 'source_incomplete'
  | 'no_reliable_source'
  | 'conflicting_or_stale'
  | 'awaiting_independent_review';

export const COVERAGE_STATUS_COPY: Record<JurisdictionCoverageStatus, string> = {
  implemented_source_supported:
    'Engine rules, forms metadata, and automated tests are in place for current statewide law (engineering sign-off only).',
  implemented_needs_facts:
    'Partial engine coverage — outcomes may require additional member facts before calculating.',
  source_incomplete:
    'Official sources located but rule extraction or filing profiles are incomplete.',
  no_reliable_source:
    'No FairPath engine record for this jurisdiction yet — do not infer eligibility.',
  conflicting_or_stale:
    'Sources may be stale or conflict — member should verify with court clerk or legal aid.',
  awaiting_independent_review:
    'Implemented from public sources; independent legal review not recorded.',
};

export function classifyJurisdictionCoverage(code: string): {
  status: JurisdictionCoverageStatus;
  record: JurisdictionCompleteness | undefined;
} {
  const record = NATIONWIDE_COMPLETENESS_BY_CODE.get(code);
  if (!record) {
    return { status: 'no_reliable_source', record: undefined };
  }
  if (record.mayCalculate && record.substantiveRules && record.tests) {
    return { status: 'implemented_source_supported', record };
  }
  if (record.substantiveRules && !record.mayCalculate) {
    return { status: 'implemented_needs_facts', record };
  }
  if (record.remedies && !record.substantiveRules) {
    return { status: 'source_incomplete', record };
  }
  return { status: 'awaiting_independent_review', record };
}

export function coverageMatrixSummary() {
  const codes = [...NATIONWIDE_COMPLETENESS_BY_CODE.keys()];
  const byStatus: Record<JurisdictionCoverageStatus, number> = {
    implemented_source_supported: 0,
    implemented_needs_facts: 0,
    source_incomplete: 0,
    no_reliable_source: 0,
    conflicting_or_stale: 0,
    awaiting_independent_review: 0,
  };
  for (const code of codes) {
    byStatus[classifyJurisdictionCoverage(code).status] += 1;
  }
  return { jurisdictionRecords: codes.length, byStatus };
}
