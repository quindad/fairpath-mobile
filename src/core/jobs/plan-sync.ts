import { upsertPlanItem, type PlanItemStatus } from '@/core/opportunity/plan-store';

function browseStatus(resultCount: number): PlanItemStatus {
  return resultCount > 0 ? 'exploring' : 'unresolved';
}

/** Device-local My Path item for an active job search (not server-synced). */
export async function syncJobBrowsePlan(input: {
  query: string;
  location: string;
  resultCount: number;
}): Promise<void> {
  const title =
    [input.query.trim() || 'Jobs', input.location.trim()].filter(Boolean).join(' · ') || 'Job search';
  await upsertPlanItem({
    id: 'job_browse_latest',
    title: title.slice(0, 80),
    status: browseStatus(input.resultCount),
    route: '/find-jobs',
    needLabels: ['Jobs'],
    note: input.resultCount === 0 ? 'No matches yet — try widening location or filters.' : undefined,
  });
}

/** Device-local My Path item when a member saves a job from browse or detail. */
export async function syncJobSavedPlan(input: { jobId: string; title: string }): Promise<void> {
  await upsertPlanItem({
    id: `job_saved_${input.jobId}`,
    title: input.title.slice(0, 80) || 'Saved job',
    status: 'saved',
    route: `/job/${input.jobId}`,
    needLabels: ['Jobs'],
  });
}
