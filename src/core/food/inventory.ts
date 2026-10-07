// Food Rescue inventory and reservations. Pure rules; the server must enforce the same rules atomically with row locks.
// Food reservations never consume Marketplace claims. Holds expire, so an unclaimed hold cannot block stock forever.

export type OfferType = 'free' | 'discounted' | 'sponsored';

export type FoodListing = {
  id: string;
  merchantId: string;
  title: string;
  offerType: OfferType;
  quantityTotal: number;
  quantityReserved: number; // confirmed + active holds
  pickupStartIso: string;
  pickupEndIso: string;
  allergens: readonly string[];
  safetyNote: string;
  /** Sponsored offers may carry eligibility rules. Ordinary offers are open to everyone. */
  eligibilityNote: string | null;
  status: 'active' | 'paused' | 'withdrawn';
};

export type Reservation = {
  id: string;
  listingId: string;
  memberId: string;
  quantity: number;
  status: 'held' | 'confirmed' | 'redeemed' | 'cancelled' | 'expired';
  heldUntilIso: string;
  createdAtIso: string;
};

export const HOLD_MINUTES = 15;

export function available(listing: FoodListing): number {
  return Math.max(0, listing.quantityTotal - listing.quantityReserved);
}

export function inPickupWindow(listing: FoodListing, nowIso: string): boolean {
  return nowIso >= listing.pickupStartIso && nowIso < listing.pickupEndIso;
}

export type ReserveResult =
  | { ok: true; listing: FoodListing; reservation: Reservation }
  | { ok: false; reason: 'not_active' | 'outside_pickup_window' | 'insufficient_stock' | 'invalid_quantity' };

/** Creates a hold. Stock is reduced immediately so two members cannot both take the last unit. */
export function reserve(listing: FoodListing, memberId: string, quantity: number, reservationId: string, nowIso: string): ReserveResult {
  if (listing.status !== 'active') return { ok: false, reason: 'not_active' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: 'invalid_quantity' };
  if (!inPickupWindow(listing, nowIso)) return { ok: false, reason: 'outside_pickup_window' };
  if (quantity > available(listing)) return { ok: false, reason: 'insufficient_stock' };
  const heldUntilIso = new Date(Date.parse(nowIso) + HOLD_MINUTES * 60_000).toISOString();
  return {
    ok: true,
    listing: { ...listing, quantityReserved: listing.quantityReserved + quantity },
    reservation: { id: reservationId, listingId: listing.id, memberId, quantity, status: 'held', heldUntilIso, createdAtIso: nowIso },
  };
}

/** Releases expired holds back to stock. Confirmed and redeemed reservations are never released. */
export function releaseExpired(listing: FoodListing, reservations: readonly Reservation[], nowIso: string): { listing: FoodListing; reservations: Reservation[] } {
  let released = 0;
  const next = reservations.map((r) => {
    if (r.listingId === listing.id && r.status === 'held' && r.heldUntilIso <= nowIso) {
      released += r.quantity;
      return { ...r, status: 'expired' as const };
    }
    return r;
  });
  return {
    listing: { ...listing, quantityReserved: Math.max(0, listing.quantityReserved - released) },
    reservations: next,
  };
}

/** Pickup confirmation by the merchant after a QR scan. A reservation is redeemed once; repeats are refused. */
export function redeem(reservation: Reservation, nowIso: string, listing: FoodListing): { ok: true; reservation: Reservation } | { ok: false; reason: 'not_held' | 'already_redeemed' | 'outside_pickup_window' | 'expired' } {
  if (reservation.status === 'redeemed') return { ok: false, reason: 'already_redeemed' };
  if (reservation.status === 'expired') return { ok: false, reason: 'expired' };
  if (reservation.status !== 'held' && reservation.status !== 'confirmed') return { ok: false, reason: 'not_held' };
  if (reservation.heldUntilIso <= nowIso && reservation.status === 'held') return { ok: false, reason: 'expired' };
  if (!inPickupWindow(listing, nowIso)) return { ok: false, reason: 'outside_pickup_window' };
  return { ok: true, reservation: { ...reservation, status: 'redeemed' } };
}

/**
 * Food claims are a separate ledger from the free-goods Marketplace. Nothing in this module reads or writes claim counts.
 */
export const FOOD_CONSUMES_MARKETPLACE_CLAIMS = false as const;

export function offerLabel(offer: OfferType): string {
  switch (offer) {
    case 'free': return 'Free';
    case 'discounted': return 'Discounted';
    case 'sponsored': return 'Sponsored';
  }
}
