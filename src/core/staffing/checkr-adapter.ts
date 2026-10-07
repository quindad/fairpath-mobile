// Checkr (employment background-screening) integration boundary. No real Checkr API shape is known or fabricated
// here. Screening only ever starts after explicit member consent, and a result never auto-rejects or auto-ranks
// anyone — it is handed to an authorized human who decides, same rule as src/core/matching/fair-chance.ts.

export type ScreeningState = 'consent_pending' | 'requested' | 'provider_processing' | 'result_available' | 'provider_error';

const ALLOWED_NEXT: Record<ScreeningState, ScreeningState[]> = {
  consent_pending: ['requested'],
  requested: ['provider_processing', 'provider_error'],
  provider_processing: ['result_available', 'provider_error'],
  result_available: [],
  provider_error: ['requested'],
};

export function canTransition(from: ScreeningState, to: ScreeningState): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

/** Screening may be requested only after the member has given consent. This is the single gate every caller must pass. */
export function mayRequestScreening(state: ScreeningState, consentGiven: boolean): boolean {
  return consentGiven && state === 'consent_pending';
}

export type ScreeningResult = { status: 'clear' | 'consider' | 'needs_review'; reportRef: string };

export interface ScreeningAdapter {
  requestScreening(candidateRef: string): Promise<{ ok: true; providerRef: string } | { ok: false; error: string }>;
  getResult(providerRef: string): Promise<ScreeningResult | null>;
}

/** DEV-only mock. Never calls a real provider. Always routes to a human review step, never an auto-decision. */
export function createMockScreeningAdapter(): ScreeningAdapter {
  const results = new Map<string, ScreeningResult>();
  return {
    async requestScreening(candidateRef) {
      const providerRef = `mock-checkr-${candidateRef}`;
      results.set(providerRef, { status: 'needs_review', reportRef: providerRef });
      return { ok: true, providerRef };
    },
    async getResult(providerRef) {
      return results.get(providerRef) ?? null;
    },
  };
}

/** No function in this module may be called 'autoReject', 'autoRank', or similar. Enforced by a test that greps this file. */
export const FORBIDDEN_FUNCTION_NAME_PATTERNS = [/auto.?reject/i, /auto.?rank/i, /auto.?deny/i, /auto.?score/i];
