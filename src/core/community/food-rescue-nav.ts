/** Thin route helpers for Food Rescue screens (Agent G). */
export const FOOD_RESCUE_HOME = '/food-rescue';
export const FOOD_RESCUE_BROWSE = '/food-rescue/browse';
export const FOOD_RESCUE_DONATE = '/food-rescue/donate';

export function foodRescueItemRoute(id: string): `/food-rescue/item/${string}` {
  return `/food-rescue/item/${id}`;
}

export function foodRescueClaimRoute(claimId: string): `/marketplace-claim/${string}` {
  return `/marketplace-claim/${claimId}`;
}

export const CAN_HELP_OPEN_REQUESTS = '/community/open-requests';
export const CAN_HELP_DONATE_GOODS = '/marketplace-list-item';
export const CAN_HELP_VOLUNTEER = '/community';
