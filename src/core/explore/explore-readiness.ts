/** Honest Explore readiness — overrides route-exists defaults in explore.tsx (P0-001). */
export type ExploreReadiness = 'live' | 'in_development' | 'planned';

/**
 * Product truth as of 2026-10-23. Update when a vertical slice is proven on DEV + tests.
 * `live` = real service + primary action verified (automated or DEV harness), not device-only.
 */
export const EXPLORE_READINESS: Record<string, ExploreReadiness> = {
  community: 'live',
  'community-need': 'live',
  'community-give': 'in_development',
  jobs: 'live',
  housing: 'live',
  opportunities: 'in_development',
  'v1-pathways': 'in_development',
  academy: 'in_development',
  entrepreneurship: 'in_development',
  veterans: 'live',
  food: 'in_development',
  resources: 'live',
  credit: 'live',
  'record-relief': 'in_development',
  market: 'live',
  signal: 'in_development',
  plus: 'live',
};

export function effectiveExploreStatus(id: string, fallback: ExploreReadiness): ExploreReadiness {
  return EXPLORE_READINESS[id] ?? fallback;
}
