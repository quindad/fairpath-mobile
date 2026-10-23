// In-memory provider health for warm Edge isolates. Opens a short circuit after repeated transient failures.
import type { HealthLike, ProviderId } from './gateway.ts';

type Row = { transientStreak: number; openUntil: number };

const rows = new Map<ProviderId, Row>();
const TRANSIENT_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

export const edgeProviderHealth: HealthLike = {
  isAvailable(provider, now) {
    const r = rows.get(provider);
    if (!r) return true;
    if (r.openUntil > now) return false;
    if (r.openUntil > 0 && r.openUntil <= now) {
      rows.set(provider, { transientStreak: 0, openUntil: 0 });
    }
    return true;
  },
  recordOutcome(provider, outcome, now) {
    const prev = rows.get(provider) ?? { transientStreak: 0, openUntil: 0 };
    if (outcome === 'success') {
      rows.set(provider, { transientStreak: 0, openUntil: 0 });
      return;
    }
    if (outcome === 'transient') {
      const streak = prev.transientStreak + 1;
      rows.set(provider, {
        transientStreak: streak,
        openUntil: streak >= TRANSIENT_THRESHOLD ? now + COOLDOWN_MS : prev.openUntil,
      });
      return;
    }
    rows.set(provider, { transientStreak: prev.transientStreak, openUntil: prev.openUntil });
  },
};
