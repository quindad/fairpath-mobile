/**
 * Provider-neutral error-monitoring interface. No provider (e.g. Sentry) is connected — DEV logs to console,
 * production is a no-op until a real vendor is configured. Screens/services call these functions, never a
 * vendor SDK directly, so connecting a real provider later touches this one file's adapter, not every call site.
 *
 * Context passed here goes through the SAME sanitizeProperties() denylist as analytics — an exception's own
 * message/stack is never filtered (that's the whole point of error monitoring), but any structured `extra`
 * context passed alongside it is, so a caller can't accidentally leak a credit-report explanation or a Record
 * Relief case fact into a breadcrumb.
 */
import { sanitizeProperties } from './analytics.ts';

export interface ErrorMonitorAdapter {
  readonly name: string;
  captureException(error: unknown, extra?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;
  setUser(opaqueUserId: string | null): void;
  clearUser(): void;
  setContext(key: string, context: Record<string, unknown>): void;
  addBreadcrumb(message: string, category?: string): void;
}

class ConsoleErrorMonitorAdapter implements ErrorMonitorAdapter {
  readonly name = 'console-dev';
  captureException(error: unknown, extra: Record<string, unknown> = {}) { console.error('[error-monitor] captureException', error, extra); }
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') { console.log('[error-monitor] captureMessage(' + level + ')', message); }
  setUser(opaqueUserId: string | null) { console.log('[error-monitor] setUser', opaqueUserId); }
  clearUser() { console.log('[error-monitor] clearUser'); }
  setContext(key: string, context: Record<string, unknown>) { console.log('[error-monitor] setContext', key, context); }
  addBreadcrumb(message: string, category = 'default') { console.log('[error-monitor] breadcrumb', category, message); }
}

class NoopErrorMonitorAdapter implements ErrorMonitorAdapter {
  readonly name = 'noop';
  captureException() {} captureMessage() {} setUser() {} clearUser() {} setContext() {} addBreadcrumb() {}
}

function defaultAdapter(): ErrorMonitorAdapter {
  return typeof __DEV__ !== 'undefined' && __DEV__ ? new ConsoleErrorMonitorAdapter() : new NoopErrorMonitorAdapter();
}

let adapter: ErrorMonitorAdapter = defaultAdapter();

export function setErrorMonitorAdapter(a: ErrorMonitorAdapter) { adapter = a; }
export function getErrorMonitorAdapter(): ErrorMonitorAdapter { return adapter; }

// Sanitization happens HERE, once, before any adapter is invoked — so every adapter (including a future real
// Sentry/etc integration swapped in via setErrorMonitorAdapter) is automatically protected. An adapter must never
// be trusted to sanitize its own input.
export function captureException(error: unknown, extra: Record<string, unknown> = {}) { const { safe } = sanitizeProperties(extra); adapter.captureException(error, safe); }
export function captureMessage(message: string, level?: 'info' | 'warning' | 'error') { adapter.captureMessage(message, level); }
export function setUser(opaqueUserId: string | null) { adapter.setUser(opaqueUserId); }
export function clearUser() { adapter.clearUser(); }
export function setContext(key: string, context: Record<string, unknown>) { const { safe } = sanitizeProperties(context); adapter.setContext(key, safe); }
export function addBreadcrumb(message: string, category?: string) { adapter.addBreadcrumb(message, category); }
