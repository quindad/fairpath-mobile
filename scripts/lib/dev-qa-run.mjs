// Shared guards and cleanup helpers for DEV-only QA harnesses (no secrets logged).
import fs from 'node:fs';
import { assertDevTarget, DEV_PROJECT_REF } from '../../supabase/seed/lib/guards.mjs';

export { DEV_PROJECT_REF, assertDevTarget };

export function loadEnvLocal() {
  if (!fs.existsSync('.env.local')) return {};
  return Object.fromEntries(
    fs
      .readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

export function readLinkedRef() {
  const p = 'supabase/.temp/project-ref';
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
}

/** Throws unless CLI passed --confirm-dev and URL/link match DEV (no service role required). */
export function assertDevMutatingSession({ url, linkedRef, confirmDev }) {
  if (!confirmDev) {
    throw new Error('DEV mutating QA requires --confirm-dev.');
  }
  return assertDevTarget({ url, serviceKey: 'unused', linkedRef, confirmDev: true, apply: false });
}

/** Throws for scripts that create/delete auth users or use service role writes. */
export function assertDevMutatingApply({ url, linkedRef, confirmDev, serviceKey }) {
  if (!confirmDev) {
    throw new Error('DEV mutating QA requires --confirm-dev.');
  }
  return assertDevTarget({ url, serviceKey, linkedRef, confirmDev: true, apply: true });
}

export function createRunId(prefix = 'qa') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** DEV seed personas — fictional fixtures, not production members (see scripts/seed-dev-test-users.mjs). */
export function assertDocumentedDevTestAccount(email) {
  const e = email.trim().toLowerCase();
  const allowed = ['dev-free1@fairpath.test', 'dev-plus2@fairpath.test'];
  if (!allowed.includes(e)) {
    throw new Error(
      `Refusing documented-account mode for "${email}": only disposable DEV seed personas ${allowed.join(', ')} are allowed.`,
    );
  }
}

export function isDisposableEmail(email) {
  const e = email.trim().toLowerCase();
  return e.endsWith('@dev-seed.fairpath.test') || e.endsWith('@fairpath.test');
}

export class CleanupRegistry {
  constructor() {
    this.tasks = [];
    this.errors = [];
  }

  add(label, fn) {
    this.tasks.push({ label, fn });
  }

  async runAll() {
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const { label, fn } = this.tasks[i];
      try {
        await fn();
      } catch (e) {
        this.errors.push({ label, error: String(e.message ?? e).slice(0, 400) });
      }
    }
  }

  get failed() {
    return this.errors.length > 0;
  }
}
