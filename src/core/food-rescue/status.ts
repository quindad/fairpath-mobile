import { isPickupWindowClosed } from './pickup-window.ts';

type ListingStatus = 'draft' | 'available' | 'paused' | 'pending_pickup' | 'claimed' | 'removed';
type ClaimStatus =
  | 'requested'
  | 'approved'
  | 'ready'
  | 'picked_up'
  | 'cancelled'
  | 'expired'
  | 'declined'
  | 'no_show';

/** Member-facing Food Rescue lifecycle (distinct from raw marketplace row status). */
export type FoodRescueStatus =
  | 'available'
  | 'reserved'
  | 'picked_up'
  | 'expired'
  | 'cancelled';

export const FOOD_RESCUE_STATUS_LABEL: Record<FoodRescueStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  picked_up: 'Picked up',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function mapFoodRescueListingStatus(
  item: { status: ListingStatus; pickup_window_end: string | null; is_food_rescue: boolean },
  claim?: { status: ClaimStatus } | null,
  nowMs = Date.now(),
): FoodRescueStatus {
  if (!item.is_food_rescue) {
    if (item.status === 'removed' || item.status === 'paused' || item.status === 'draft') return 'cancelled';
    if (item.status === 'claimed') return 'picked_up';
    if (item.status === 'pending_pickup') return 'reserved';
    if (isPickupWindowClosed(item.pickup_window_end, nowMs)) return 'expired';
    return 'available';
  }

  if (claim?.status === 'picked_up') return 'picked_up';
  if (claim && ['requested', 'approved', 'ready'].includes(claim.status)) return 'reserved';
  if (claim && ['cancelled', 'declined', 'expired', 'no_show'].includes(claim.status)) {
    if (item.status === 'available' && !isPickupWindowClosed(item.pickup_window_end, nowMs)) return 'available';
    if (isPickupWindowClosed(item.pickup_window_end, nowMs)) return 'expired';
    return 'cancelled';
  }

  if (item.status === 'removed' || item.status === 'paused' || item.status === 'draft') return 'cancelled';
  if (item.status === 'claimed') return 'picked_up';
  if (item.status === 'pending_pickup') return 'reserved';
  if (isPickupWindowClosed(item.pickup_window_end, nowMs)) return 'expired';
  return 'available';
}
