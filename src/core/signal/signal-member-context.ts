/**
 * Member capability filtering for Signal starters and user-visible enrichment status copy.
 * Pure helpers — safe for Node tests; no Edge Function calls.
 */
import type { SignalResult } from '../ai/signal.ts';
import { justiceToolsEnabled, veteranToolsEnabled, type MemberCapabilities } from '../profile/member-capabilities-core.ts';

const RECORD_RELIEF_PROMPT =
  /\brecord relief\b|\bclear this record\b|\bwhen might i become eligible\b|\bexpung|\bseal(ing)? my record\b/i;

const VETERAN_PROMPT = /\bveteran\b/i;

/** Drop justice- or veteran-specific starters when those tool sets are not enabled. */
export function filterSignalSuggestionStrings(
  lines: readonly string[],
  caps: MemberCapabilities | null | undefined,
): string[] {
  const justice = justiceToolsEnabled(caps);
  const veteran = veteranToolsEnabled(caps);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    if (!justice && RECORD_RELIEF_PROMPT.test(line)) continue;
    if (!veteran && VETERAN_PROMPT.test(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

function looksOffline(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('network error') ||
    m.includes('internet connection') ||
    m.includes('offline') ||
    m.includes('fetch failed')
  );
}

/** Short note appended when optional Signal enrichment did not run (402/503/offline/etc.). */
export function noteForSignalResult(result: SignalResult): string | null {
  if (result.status === 'ok') return null;
  switch (result.status) {
    case 'signed_out':
      return 'Sign in to add personalized Signal guidance on top of this answer. Built-in routing still works without credits.';
    case 'out_of_credits':
      return 'You are out of Signal credits for now. The answer above uses FairPath’s built-in tools only—no credits were used.';
    case 'rate_limited':
      return 'Signal’s AI layer is temporarily unavailable (server busy). Your built-in answer above is complete without waiting.';
    case 'error':
      if (looksOffline(result.message)) {
        return 'You appear to be offline. The built-in answer above does not need a connection; personalized Signal guidance will resume when you are back online.';
      }
      return 'Signal could not add personalized guidance right now. The built-in answer above still applies—try again when you have connection or credits.';
    default:
      return null;
  }
}

/** User-visible copy when the main ask flow throws (routing/tools), without calling Edge Functions. */
export function noteForAskFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (looksOffline(message)) {
    return 'You appear to be offline. Try again when you are connected, or open a workflow from the suggestions below.';
  }
  return 'Try again in a moment, or open a workflow from the suggestions.';
}
