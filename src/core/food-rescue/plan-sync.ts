import { upsertPlanItem, type PlanItemStatus } from '@/core/opportunity/plan-store';
import { foodRescueItemRoute } from '@/core/community/food-rescue-nav';
import type { FoodRescueStatus } from '@/core/food-rescue/status';

function planStatusForFoodRescue(status: FoodRescueStatus): PlanItemStatus {
  switch (status) {
    case 'available':
      return 'exploring';
    case 'reserved':
      return 'pickup_arranged';
    case 'picked_up':
      return 'completed';
    case 'expired':
    case 'cancelled':
      return 'unresolved';
    default:
      return 'exploring';
  }
}

/** Device-local My Path item for a Food Rescue listing or claim (not server-synced). */
export async function syncFoodRescuePlan(input: {
  itemId: string;
  title: string;
  status: FoodRescueStatus;
  claimId?: string;
}): Promise<void> {
  const route = input.claimId ? `/marketplace-claim/${input.claimId}` : foodRescueItemRoute(input.itemId);
  await upsertPlanItem({
    id: `food_rescue_${input.itemId}`,
    title: input.title.slice(0, 80) || 'Food Rescue',
    status: planStatusForFoodRescue(input.status),
    route,
    needLabels: ['Food Rescue'],
    note:
      input.status === 'reserved'
        ? 'Claim in progress — open your claim for pickup details when approved.'
        : undefined,
  });
}
