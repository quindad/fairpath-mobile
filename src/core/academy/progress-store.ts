// Device-local persistence for Academy enrollments. This is NOT server-synced yet: progress stays on this device until the
// server-side enrollment tables and RLS are approved and applied. The loader validates every record, so corrupt or
// tampered storage is dropped rather than trusted.

import type { AssessmentAttempt, Enrollment } from './enrollment.ts';

export const ACADEMY_STORAGE_KEY = 'fairpath.academy.enrollments.v1';

export type EnrollmentMap = Record<string, Enrollment>;

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validAttempt(v: unknown): v is AssessmentAttempt {
  if (!v || typeof v !== 'object') return false;
  const a = v as Record<string, unknown>;
  return isString(a.courseId) && isNumber(a.score) && isNumber(a.maxScore) && a.maxScore > 0 && a.score >= 0 && a.score <= a.maxScore && isString(a.attemptedAt);
}

function validEnrollment(v: unknown): v is Enrollment {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    isString(e.courseId) &&
    isString(e.enrolledAt) &&
    Array.isArray(e.completedLessonIds) && e.completedLessonIds.every(isString) &&
    typeof e.bookmarked === 'boolean' &&
    Array.isArray(e.attempts) && e.attempts.every(validAttempt) &&
    (e.completedAt === null || isString(e.completedAt))
  );
}

/** Parses stored JSON. Invalid records are dropped; an unreadable payload yields an empty map. */
export function parseEnrollments(raw: string | null): EnrollmentMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: EnrollmentMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (validEnrollment(value) && value.courseId === key) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeEnrollments(map: EnrollmentMap): string {
  return JSON.stringify(map);
}

/** Thin storage wrapper. Every failure degrades to an empty state and never throws into the UI. */
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export async function loadEnrollments(store: KeyValueStore): Promise<EnrollmentMap> {
  try {
    return parseEnrollments(await store.getItem(ACADEMY_STORAGE_KEY));
  } catch {
    return {};
  }
}

export async function saveEnrollments(store: KeyValueStore, map: EnrollmentMap): Promise<boolean> {
  try {
    await store.setItem(ACADEMY_STORAGE_KEY, serializeEnrollments(map));
    return true;
  } catch {
    return false;
  }
}
