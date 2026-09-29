/**
 * Provider-neutral analytics interface. No provider is connected — DEV uses a console adapter, production uses
 * a no-op adapter, until a real vendor decision is made. This file exists so that decision never has to touch
 * every call site: screens call `track`/`screen`/`identify` here, never a vendor SDK directly.
 *
 * PRIVACY: `sanitizeProperties` strips any key whose name suggests sensitive content before it ever reaches an
 * adapter, even the DEV console one. This is a strict denylist-by-substring, not a per-event allowlist, because
 * new event call sites will be added over time and the safety net must not depend on every future author
 * remembering the rules in this file's comment.
 *
 * FairPath's own forbidden-field list (from the launch-closure pass): name (unless explicitly required later),
 * DOB, street address, justice history, credit details, dispute content, Record Relief case facts, uploaded
 * document names/contents, application answers containing sensitive data.
 */

const FORBIDDEN_KEY_SUBSTRINGS = [
  'dob', 'birth', 'ssn', 'social_security',
  'address', 'street', 'zip', 'postal',
  'conviction', 'offense', 'charge', 'sentence', 'disposition', 'case_fact', 'justice', 'record_relief',
  'credit', 'dispute', 'bureau', 'account_number',
  'document_content', 'file_content', 'upload_content',
  'answer', 'explanation', 'description', 'note', 'reason', 'body', 'text', 'message',
  'email', 'phone', 'password', 'token', 'secret', 'key',
  'name', // 'name' subsumes first_name/last_name/full_name; explicitly not sent unless a future decision reopens it
];

function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase();
  return FORBIDDEN_KEY_SUBSTRINGS.some((bad) => k.includes(bad));
}

/** Strips any property whose key looks sensitive. Returns only what passed, plus which keys were dropped (DEV visibility only). */
export function sanitizeProperties(properties: Record<string, unknown>): { safe: Record<string, unknown>; dropped: string[] } {
  const safe: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (isForbiddenKey(key)) { dropped.push(key); continue; }
    // only primitive, non-huge values pass through — never nested objects that could smuggle sensitive fields
    if (value === null || typeof value === 'number' || typeof value === 'boolean') { safe[key] = value; continue; }
    if (typeof value === 'string' && value.length <= 200) { safe[key] = value; continue; }
    dropped.push(key + ' (non-primitive or oversized)');
  }
  return { safe, dropped };
}

export interface AnalyticsAdapter {
  readonly name: string;
  track(event: string, properties: Record<string, unknown>): void;
  screen(name: string, properties: Record<string, unknown>): void;
  identify(opaqueUserId: string | null): void;
  reset(): void;
}

class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = 'console-dev';
  track(event: string, properties: Record<string, unknown>) { console.log('[analytics] track', event, properties); }
  screen(name: string, properties: Record<string, unknown>) { console.log('[analytics] screen', name, properties); }
  identify(opaqueUserId: string | null) { console.log('[analytics] identify', opaqueUserId); }
  reset() { console.log('[analytics] reset'); }
}

class NoopAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = 'noop';
  track() {} screen() {} identify() {} reset() {}
}

/** __DEV__ gets a visible console adapter; production gets a real no-op until a vendor is actually configured. */
function defaultAdapter(): AnalyticsAdapter {
  return typeof __DEV__ !== 'undefined' && __DEV__ ? new ConsoleAnalyticsAdapter() : new NoopAnalyticsAdapter();
}

let adapter: AnalyticsAdapter = defaultAdapter();

/** Swaps the active adapter — this is the ONE seam a future Sentry/PostHog/etc integration touches. */
export function setAnalyticsAdapter(a: AnalyticsAdapter) { adapter = a; }
export function getAnalyticsAdapter(): AnalyticsAdapter { return adapter; }

export function track(event: string, properties: Record<string, unknown> = {}) {
  const { safe } = sanitizeProperties(properties);
  adapter.track(event, safe);
}
export function screen(name: string, properties: Record<string, unknown> = {}) {
  const { safe } = sanitizeProperties(properties);
  adapter.screen(name, safe);
}
/** Identify with an OPAQUE id only (e.g. auth.users.id) — never an email, name, or other PII. */
export function identify(opaqueUserId: string | null) { adapter.identify(opaqueUserId); }
export function resetAnalytics() { adapter.reset(); }
