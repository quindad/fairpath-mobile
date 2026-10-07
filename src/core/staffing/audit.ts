// Staffing audit events. Mirrors the existing entitlement_audit_log pattern (append-only, actor + action + details)
// rather than inventing a new audit architecture. Defines exactly which staffing actions are audited and guarantees,
// by construction, that financial fields and provider credentials never appear in a client-facing serialization.

export type StaffingAuditAction =
  | 'requisition_status_changed'
  | 'candidate_submitted'
  | 'screening_requested'
  | 'screening_consent_recorded'
  | 'restricted_screening_state_viewed'
  | 'onboarding_requested'
  | 'provider_state_changed'
  | 'placement_confirmed'
  | 'assignment_status_changed'
  | 'rate_card_changed'
  | 'conversion_to_direct_hire'
  | 'assignment_completed';

/** Actions whose details may include financial fields. These events themselves are still ops/service_role-only;
 * this set exists so a client-bundle serializer (below) knows to redact if it is ever handed one by mistake. */
export const FINANCIAL_ACTIONS: readonly StaffingAuditAction[] = ['rate_card_changed'];

export type AuditEvent = {
  id: string;
  actorId: string;
  action: StaffingAuditAction;
  assignmentId: string | null;
  requisitionId: string | null;
  occurredAt: string;
  details: Record<string, unknown>; // may contain financial fields for FINANCIAL_ACTIONS; never redacted at write time
};

const FINANCIAL_DETAIL_KEYS = new Set([
  'payRateHourly', 'billRateHourly', 'eorCostHourly', 'screeningCostFlat', 'otherAssignmentCostFlat',
  'statutoryBurdenPercent', 'grossSpreadHourly', 'estimatedContributionHourly',
]);
const CREDENTIAL_LIKE_KEYS = /token|secret|key|password|credential|providerRef/i;

/**
 * Produces the version of an audit event that may safely reach a client bundle or log line. Financial detail keys
 * and anything credential-shaped are stripped, never passed through. This is the ONLY function that should ever
 * hand a staffing audit event to a UI.
 */
export function toClientSafeEvent(event: AuditEvent): AuditEvent {
  const safeDetails: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event.details)) {
    if (FINANCIAL_DETAIL_KEYS.has(k) || CREDENTIAL_LIKE_KEYS.test(k)) continue;
    safeDetails[k] = v;
  }
  return { ...event, details: safeDetails };
}

export function isFinancialAction(action: StaffingAuditAction): boolean {
  return FINANCIAL_ACTIONS.includes(action);
}
