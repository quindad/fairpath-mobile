// Course search and filtering over the canonical catalog. Pure functions so the same logic can run in the mobile app,
// the public website and Command Center without duplication.

import { presentable, type CanonicalCourse, type CostClass } from './catalog-contract.ts';

export type CatalogFilters = {
  query?: string;
  category?: string;
  costClasses?: readonly CostClass[];
  difficulty?: CanonicalCourse['difficulty'];
  deliveryFormat?: CanonicalCourse['deliveryFormat'];
  maxDurationHours?: number;
  language?: string;
  occupationCode?: string;
};

export type SortKey = 'relevance' | 'title' | 'duration' | 'price';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function score(course: CanonicalCourse, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const title = normalize(course.title);
  const body = normalize([course.description, ...course.tags, ...course.skills].join(' '));
  let s = 0;
  for (const t of terms) {
    if (title.includes(t)) s += 3;
    if (body.includes(t)) s += 1;
  }
  return s;
}

/**
 * Returns only presentable courses (active and verified), filtered and sorted. Withdrawn, stale and never-verified
 * courses are excluded here, so no UI can accidentally show them.
 */
export function searchCourses(catalog: readonly CanonicalCourse[], filters: CatalogFilters, sort: SortKey = 'relevance'): CanonicalCourse[] {
  const terms = filters.query ? normalize(filters.query).split(' ').filter(Boolean) : [];
  const results = catalog.filter((c) => {
    if (!presentable(c)) return false;
    if (filters.category && c.category !== filters.category) return false;
    if (filters.costClasses && filters.costClasses.length > 0 && !filters.costClasses.includes(c.costClass)) return false;
    if (filters.difficulty && c.difficulty !== filters.difficulty) return false;
    if (filters.deliveryFormat && c.deliveryFormat !== filters.deliveryFormat) return false;
    if (filters.maxDurationHours !== undefined && (c.durationHours === null || c.durationHours > filters.maxDurationHours)) return false;
    if (filters.language && c.language !== filters.language) return false;
    if (filters.occupationCode && !c.occupationCodes.includes(filters.occupationCode)) return false;
    if (terms.length > 0 && score(c, terms) === 0) return false;
    return true;
  });

  const ranked = results.map((c) => ({ c, s: score(c, terms) }));
  ranked.sort((a, b) => {
    switch (sort) {
      case 'title': return a.c.title.localeCompare(b.c.title);
      case 'duration': return (a.c.durationHours ?? Infinity) - (b.c.durationHours ?? Infinity);
      case 'price': return (a.c.priceUsd ?? Infinity) - (b.c.priceUsd ?? Infinity);
      default: return b.s - a.s || a.c.title.localeCompare(b.c.title);
    }
  });
  return ranked.map((r) => r.c);
}
