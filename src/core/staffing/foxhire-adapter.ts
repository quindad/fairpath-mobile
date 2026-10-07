// FoxHire (EOR/back-office partner) integration boundary. No real FoxHire API shape is known or fabricated here —
// this is a replaceable adapter interface with an explicit state machine and a DEV mock. Swapping in the real
// transport later means implementing FoxHireAdapter; nothing else in the app should change.

export type FoxHireState =
  | 'candidate_submitted'
  | 'onboarding_requested'
  | 'onboarding_pending'
  | 'onboarding_complete'
  | 'payroll_active'
  | 'assignment_active'
  | 'assignment_ended'
  | 'provider_error_manual_review';

const ALLOWED_NEXT: Record<FoxHireState, FoxHireState[]> = {
  candidate_submitted: ['onboarding_requested', 'provider_error_manual_review'],
  onboarding_requested: ['onboarding_pending', 'provider_error_manual_review'],
  onboarding_pending: ['onboarding_complete', 'provider_error_manual_review'],
  onboarding_complete: ['payroll_active', 'provider_error_manual_review'],
  payroll_active: ['assignment_active', 'provider_error_manual_review'],
  assignment_active: ['assignment_ended', 'provider_error_manual_review'],
  assignment_ended: [],
  provider_error_manual_review: ['onboarding_requested', 'onboarding_pending'], // a human can retry from review
};

export function canTransition(from: FoxHireState, to: FoxHireState): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

export type FoxHireCandidate = { assignmentId: string; firstName: string; lastName: string; email: string };

export interface FoxHireAdapter {
  submitCandidate(candidate: FoxHireCandidate): Promise<{ ok: true; providerRef: string } | { ok: false; error: string }>;
  getState(providerRef: string): Promise<FoxHireState>;
}

/**
 * DEV-only mock. Never makes a network call, never fabricates a real FoxHire response shape. Deterministic so it is
 * safe to use in tests and local development before real credentials exist.
 */
export function createMockFoxHireAdapter(): FoxHireAdapter {
  const states = new Map<string, FoxHireState>();
  return {
    async submitCandidate(candidate) {
      const providerRef = `mock-foxhire-${candidate.assignmentId}`;
      states.set(providerRef, 'candidate_submitted');
      return { ok: true, providerRef };
    },
    async getState(providerRef) {
      return states.get(providerRef) ?? 'provider_error_manual_review';
    },
  };
}
