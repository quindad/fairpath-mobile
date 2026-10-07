// FairPath Academy canonical course contract. Every course, from any source, is normalized to this shape before it is
// shown to a member. Free means genuinely free: a course is 'free' only when no unavoidable charge applies to learning
// or to its certificate. Provenance and verification timestamps are required so stale or withdrawn courses can be hidden.

export type CostClass =
  | 'free' // no unavoidable charge to learn; certificate free or not offered
  | 'free_with_paid_certificate' // learning free, certificate costs money
  | 'low_cost' // paid, at or below the low-cost threshold
  | 'paid' // paid above the low-cost threshold
  | 'sponsored' // seat funded by a verified sponsor; member pays nothing
  | 'unknown'; // price not verified; never shown as free

export const LOW_COST_THRESHOLD_USD = 100;

export type CourseStatus = 'active' | 'stale' | 'withdrawn';

export type SourceKind = 'official_api' | 'licensed_feed' | 'partner' | 'open_resource' | 'public_dataset' | 'curated';

export type CanonicalCourse = {
  id: string; // FairPath id
  providerId: string;
  externalId: string;
  title: string;
  description: string;
  category: string;
  tags: readonly string[];
  skills: readonly string[];
  occupationCodes: readonly string[]; // reviewed mappings only
  costClass: CostClass;
  priceUsd: number | null;
  certificatePriceUsd: number | null;
  freeAuditAvailable: boolean;
  deliveryFormat: 'online_self_paced' | 'online_live' | 'in_person' | 'hybrid';
  durationHours: number | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'unspecified';
  language: string;
  enrollmentUrl: string;
  eligibility: string;
  location: string | null;
  sourceKind: SourceKind;
  sourceLicense: string;
  lastFetched: string; // ISO
  lastVerified: string | null; // ISO; null means never verified
  lastChanged: string | null;
  status: CourseStatus;
};

/**
 * Classify cost from verified fields only. Unknown inputs classify as 'unknown', never as free.
 */
export function classifyCost(input: {
  priceUsd: number | null;
  certificatePriceUsd: number | null;
  freeAuditAvailable: boolean;
  sponsored: boolean;
}): CostClass {
  if (input.sponsored) return 'sponsored';
  if (input.priceUsd === null) return 'unknown';
  if (input.priceUsd === 0) {
    if (input.certificatePriceUsd && input.certificatePriceUsd > 0) return 'free_with_paid_certificate';
    return 'free';
  }
  if (input.priceUsd > 0) {
    if (input.freeAuditAvailable) return 'free_with_paid_certificate';
    return input.priceUsd <= LOW_COST_THRESHOLD_USD ? 'low_cost' : 'paid';
  }
  return 'unknown';
}

/** Only courses that are active and verified may be presented to members. */
export function presentable(course: CanonicalCourse): boolean {
  return course.status === 'active' && course.lastVerified !== null;
}

/** A course is labeled free only if its classification is 'free' or 'free_with_paid_certificate' with a free learning path. */
export function isGenuinelyFree(course: CanonicalCourse): boolean {
  return course.costClass === 'free';
}
