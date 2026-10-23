import { upsertPlanItem, type PlanItemStatus } from '@/core/opportunity/plan-store';

function browseStatus(resultCount: number): PlanItemStatus {
  return resultCount > 0 ? 'exploring' : 'unresolved';
}

/** Device-local My Path item for an active housing search (not server-synced). */
export async function syncHousingBrowsePlan(input: {
  query: string;
  location: string;
  resultCount: number;
}): Promise<void> {
  const title =
    [input.query.trim() || 'Housing', input.location.trim()].filter(Boolean).join(' · ') || 'Housing search';
  await upsertPlanItem({
    id: 'housing_browse_latest',
    title: title.slice(0, 80),
    status: browseStatus(input.resultCount),
    route: '/find-housing',
    needLabels: ['Housing'],
    note: input.resultCount === 0 ? 'No matches yet — try widening location or filters.' : undefined,
  });
}

/** Device-local My Path item when a member saves a home from browse or detail. */
export async function syncHousingSavedPlan(input: { listingId: string; title: string }): Promise<void> {
  await upsertPlanItem({
    id: `housing_saved_${input.listingId}`,
    title: input.title.slice(0, 80) || 'Saved home',
    status: 'saved',
    route: `/housing/${input.listingId}`,
    needLabels: ['Housing'],
  });
}
