import {
  createMarketplaceItem,
  isMarketplaceItemSaved,
  loadMarketplace,
  loadMarketplaceItem,
  loadMarketplaceViewerState,
  loadSavedMarketplaceIds,
  requestMarketplaceClaim,
  saveMarketplaceItem,
  setMarketplaceItemAvailability,
  unsaveMarketplaceItem,
  type MarketplaceItem,
} from '@/core/marketplace/marketplace-service';
import { validateFoodRescueDonorIntake, type FoodRescueDonorIntake } from '@/core/community/food-listing-rules';
import { buildTodayPickupWindowIso, isClosingSoon, isPickupWindowClosed } from '@/core/food-rescue/pickup-window';
import { foodRescueClaimErrorCode } from '@/core/food-rescue/errors';
import { mapFoodRescueListingStatus, type FoodRescueStatus } from '@/core/food-rescue/status';
import { syncFoodRescuePlan } from '@/core/food-rescue/plan-sync';

export type FoodRescueBrowseFilters = {
  location?: string;
  closingSoonOnly?: boolean;
  savedOnly?: boolean;
};

export type FoodRescueBrowseRow = MarketplaceItem & {
  memberStatus: FoodRescueStatus;
  saved: boolean;
};

export async function browseFoodRescue(filters: FoodRescueBrowseFilters = {}): Promise<FoodRescueBrowseRow[]> {
  const rows = await loadMarketplace({ location: filters.location, foodRescueOnly: true });
  let savedIds = new Set<string>();
  try {
    savedIds = new Set(await loadSavedMarketplaceIds());
  } catch {
    savedIds = new Set();
  }

  let visible = rows.filter((r) => !isPickupWindowClosed(r.pickup_window_end));
  if (filters.closingSoonOnly) visible = visible.filter((r) => isClosingSoon(r.pickup_window_end));
  if (filters.savedOnly) visible = visible.filter((r) => savedIds.has(r.id));

  return visible.map((item) => ({
    ...item,
    memberStatus: mapFoodRescueListingStatus(item),
    saved: savedIds.has(item.id),
  }));
}

export async function loadFoodRescueItemDetail(itemId: string) {
  const [item, viewer] = await Promise.all([loadMarketplaceItem(itemId), loadMarketplaceViewerState(itemId)]);
  if (!item.is_food_rescue) {
    throw new Error('NOT_FOOD_RESCUE');
  }
  const memberStatus = mapFoodRescueListingStatus(item, viewer.claim);
  return { item, viewer, memberStatus };
}

export async function toggleFoodRescueSaved(itemId: string, currentlySaved: boolean): Promise<boolean> {
  if (currentlySaved) await unsaveMarketplaceItem(itemId);
  else await saveMarketplaceItem(itemId);
  return !currentlySaved;
}

export async function reserveFoodRescueListing(itemId: string, message = '') {
  try {
    const created = await requestMarketplaceClaim(itemId, message);
    const { item, memberStatus } = await loadFoodRescueItemDetail(itemId);
    await syncFoodRescuePlan({
      itemId,
      title: item.title,
      status: memberStatus,
      claimId: created.id,
    }).catch(() => {});
    return created;
  } catch (e) {
    const code = foodRescueClaimErrorCode(e);
    throw new Error(code === 'UNKNOWN' && e instanceof Error ? e.message : code);
  }
}

export type PublishFoodRescueDonationResult =
  | { ok: true; itemId: string; published: boolean; moderationPending: boolean }
  | { ok: false; reason: string };

export async function publishFoodRescueDonation(
  intake: FoodRescueDonorIntake,
  options: { safePickup?: boolean; sellerType?: 'individual' | 'organization' } = {},
): Promise<PublishFoodRescueDonationResult> {
  const check = validateFoodRescueDonorIntake(intake);
  if (!check.ok) return { ok: false, reason: check.reason };

  const window = buildTodayPickupWindowIso(intake.pickupWindowStart, intake.pickupWindowEnd);
  if ('reason' in window) return { ok: false, reason: window.reason };

  const storageLine = intake.storageNotes.trim();
  const description = storageLine
    ? `${intake.description.trim()}\n\nStorage: ${storageLine}`
    : intake.description.trim();

  try {
    const itemId = await createMarketplaceItem({
      title: intake.title.trim(),
      description,
      category: 'Food',
      condition: 'Good',
      quantity: intake.quantity,
      city: intake.city.trim(),
      state: intake.state.trim(),
      pickup_area: intake.pickupArea?.trim(),
      safe_pickup: options.safePickup ?? true,
      seller_type: options.sellerType ?? 'individual',
      pickup_city: intake.pickupCity.trim(),
      pickup_state: intake.pickupState.trim(),
      isFoodRescue: true,
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
      bestByNote: intake.bestByNote.trim(),
    });

    try {
      await setMarketplaceItemAvailability(itemId, true);
      await syncFoodRescuePlan({ itemId, title: intake.title, status: 'available' }).catch(() => {});
      return { ok: true, itemId, published: true, moderationPending: false };
    } catch (availError) {
      if (availError instanceof Error && availError.message === 'MODERATION_REQUIRED') {
        await syncFoodRescuePlan({ itemId, title: intake.title, status: 'available' }).catch(() => {});
        return { ok: true, itemId, published: false, moderationPending: true };
      }
      throw availError;
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'SIGNED_OUT') return { ok: false, reason: 'SIGNED_OUT' };
    return { ok: false, reason: 'DONATION_FAILED' };
  }
}

export async function refreshFoodRescueSavedMap(itemIds: string[]): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    itemIds.map(async (id) => {
      try {
        return [id, await isMarketplaceItemSaved(id)] as const;
      } catch {
        return [id, false] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
