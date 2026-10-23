import { upsertPlanItem, type PlanItemStatus } from './plan-store.ts';

export function planStatusForCommunityRequest(status: string): PlanItemStatus {
  switch (status) {
    case 'open':
      return 'requested';
    case 'matched':
      return 'offer_received';
    case 'fulfilled':
      return 'completed';
    case 'cancelled':
    case 'expired':
      return 'unresolved';
    default:
      return 'exploring';
  }
}

/** Device-local My Path item for a community help request (not server-synced). */
export async function syncCommunityRequestPlan(input: {
  requestId: string;
  description: string;
  status: string;
}): Promise<void> {
  const title = input.description.slice(0, 80) || 'Community request';
  await upsertPlanItem({
    id: `community_req_${input.requestId}`,
    title,
    status: planStatusForCommunityRequest(input.status),
    route: `/community/need-help/${input.requestId}`,
    needLabels: ['Community exchange'],
    note:
      input.status === 'matched'
        ? 'Offer accepted — mark fulfilled when assistance actually happened.'
        : undefined,
  });
}
