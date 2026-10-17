import type { IntentId } from './intents.ts';
import type { AiResponse } from './orchestrator.ts';

/** Intents where Signal can add personalized guidance on top of deterministic routing. */
export const SIGNAL_ENRICH_INTENTS: readonly IntentId[] = ['next_steps', 'find_resources', 'need_shelter', 'safety'];

export function mergeSignalText(response: AiResponse, signalText: string): AiResponse {
  const text = signalText.trim();
  if (!text) return response;
  return {
    ...response,
    modelAssisted: true,
    parts: [...response.parts, { text, basis: 'ai' }],
    provenance: { ...response.provenance, engine: 'model', confidence: 'medium' },
  };
}

export type SignalClientStatus = 'ok' | 'signed_out' | 'out_of_credits' | 'rate_limited' | 'error';

export function signalStatusMessage(status: SignalClientStatus): string | null {
  switch (status) {
    case 'signed_out':
      return 'Sign in to use Signal credits for personalized guidance.';
    case 'out_of_credits':
      return 'You are out of Signal credits for now. Your built-in answer above still applies.';
    case 'rate_limited':
      return 'Signal is busy right now. Your built-in answer above still applies.';
    default:
      return null;
  }
}

export function shouldEnrichWithSignal(intent: IntentId): boolean {
  return (SIGNAL_ENRICH_INTENTS as readonly string[]).includes(intent);
}
