import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, reserve, releaseExpired, redeem, FOOD_CONSUMES_MARKETPLACE_CLAIMS, HOLD_MINUTES, type FoodListing, type Reservation } from '../src/core/food/inventory.ts';

const LISTING: FoodListing = {
  id: 'L1', merchantId: 'M1', title: 'Bread (fixture)', offerType: 'free', quantityTotal: 2, quantityReserved: 0,
  pickupStartIso: '2026-10-07T17:00:00Z', pickupEndIso: '2026-10-07T19:00:00Z', allergens: ['wheat'],
  safetyNote: 'Keep refrigerated until pickup', eligibilityNote: null, status: 'active',
};
const IN_WINDOW = '2026-10-07T18:00:00Z';

test('cannot reserve more than available stock', () => {
  assert.deepEqual(reserve(LISTING, 'm', 3, 'r', IN_WINDOW), { ok: false, reason: 'insufficient_stock' });
});

test('reserving the last unit leaves no stock for a second member', () => {
  const first = reserve(LISTING, 'a', 2, 'r1', IN_WINDOW);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(available(first.listing), 0);
    assert.deepEqual(reserve(first.listing, 'b', 1, 'r2', IN_WINDOW), { ok: false, reason: 'insufficient_stock' });
  }
});

test('reservations outside the pickup window are refused', () => {
  assert.deepEqual(reserve(LISTING, 'a', 1, 'r', '2026-10-07T16:59:00Z'), { ok: false, reason: 'outside_pickup_window' });
  assert.deepEqual(reserve(LISTING, 'a', 1, 'r', '2026-10-07T19:00:00Z'), { ok: false, reason: 'outside_pickup_window' });
});

test('invalid quantities are refused', () => {
  assert.deepEqual(reserve(LISTING, 'a', 0, 'r', IN_WINDOW), { ok: false, reason: 'invalid_quantity' });
  assert.deepEqual(reserve(LISTING, 'a', 1.5, 'r', IN_WINDOW), { ok: false, reason: 'invalid_quantity' });
});

test('paused or withdrawn listings cannot be reserved', () => {
  assert.deepEqual(reserve({ ...LISTING, status: 'paused' }, 'a', 1, 'r', IN_WINDOW), { ok: false, reason: 'not_active' });
});

test('an unclaimed hold expires and returns stock', () => {
  const r = reserve(LISTING, 'a', 2, 'r1', IN_WINDOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    const later = new Date(Date.parse(IN_WINDOW) + (HOLD_MINUTES + 1) * 60_000).toISOString();
    const out = releaseExpired(r.listing, [r.reservation], later);
    assert.equal(out.listing.quantityReserved, 0);
    assert.equal(out.reservations[0]!.status, 'expired');
  }
});

test('a hold that has not expired keeps its stock', () => {
  const r = reserve(LISTING, 'a', 2, 'r1', IN_WINDOW);
  if (r.ok) {
    const soon = new Date(Date.parse(IN_WINDOW) + 60_000).toISOString();
    assert.equal(releaseExpired(r.listing, [r.reservation], soon).listing.quantityReserved, 2);
  }
});

test('a confirmed reservation is never released by expiry sweeps', () => {
  const r = reserve(LISTING, 'a', 1, 'r1', IN_WINDOW);
  if (r.ok) {
    const confirmed: Reservation = { ...r.reservation, status: 'confirmed' };
    const later = new Date(Date.parse(IN_WINDOW) + 999 * 60_000).toISOString();
    assert.equal(releaseExpired(r.listing, [confirmed], later).listing.quantityReserved, 1);
  }
});

test('QR redemption works once inside the window, and never twice', () => {
  const r = reserve(LISTING, 'a', 1, 'r1', IN_WINDOW);
  if (r.ok) {
    const first = redeem(r.reservation, IN_WINDOW, r.listing);
    assert.equal(first.ok, true);
    if (first.ok) assert.deepEqual(redeem(first.reservation, IN_WINDOW, r.listing), { ok: false, reason: 'already_redeemed' });
  }
});

test('redemption refuses expired holds and out-of-window scans', () => {
  const r = reserve(LISTING, 'a', 1, 'r1', IN_WINDOW);
  if (r.ok) {
    const late = new Date(Date.parse(IN_WINDOW) + (HOLD_MINUTES + 5) * 60_000).toISOString();
    assert.deepEqual(redeem(r.reservation, late, r.listing), { ok: false, reason: 'expired' });
    assert.deepEqual(redeem(r.reservation, '2026-10-07T20:00:00Z', r.listing), { ok: false, reason: 'expired' });
  }
});

test('food reservations never consume Marketplace claims', () => {
  assert.equal(FOOD_CONSUMES_MARKETPLACE_CLAIMS, false);
});
