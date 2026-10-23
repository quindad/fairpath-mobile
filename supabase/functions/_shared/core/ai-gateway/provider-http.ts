// Provider HTTP helpers for Signal Edge adapters (Deno). Keys stay in function secrets only.
import { requireEnv } from '../../http.ts';

/** Per-provider fetch timeout (ms). */
export function signalTimeoutMs(): number {
  const raw = requireEnv('SIGNAL_TIMEOUT_MS');
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 5_000 && n <= 120_000) return n;
  return 28_000;
}

/** Whole-workflow ceiling (ms), including failover hops. */
export function signalWorkflowTimeoutMs(): number {
  const raw = requireEnv('SIGNAL_WORKFLOW_TIMEOUT_MS');
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 10_000 && n <= 180_000) return n;
  return Math.min(signalTimeoutMs() * 2 + 5_000, 90_000);
}

export function signalMaxOutputTokens(): number {
  const raw = requireEnv('SIGNAL_MAX_OUTPUT_TOKENS');
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 64 && n <= 4_096) return n;
  return 700;
}

export async function fetchWithSignalTimeout(url: string, init: RequestInit): Promise<Response> {
  const ms = signalTimeoutMs();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw { kind: 'timeout' };
    throw { kind: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
