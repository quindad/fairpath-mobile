import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateFoodRescueDonorIntake } from '../src/core/community/food-listing-rules.ts';
import {
  buildTodayPickupWindowIso,
  isClosingSoon,
  isPickupWindowClosed,
  pickupWindowClosesIn,
} from '../src/core/food-rescue/pickup-window.ts';
import { foodRescueErrorMessage, foodRescueClaimErrorCode } from '../src/core/food-rescue/errors.ts';
import { mapFoodRescueListingStatus } from '../src/core/food-rescue/status.ts';

describe('food rescue donor validation', () => {
  const base = {
    title: 'Canned goods',
    description: 'Sealed cases of vegetables and beans for same-day pickup.',
    quantity: 2,
    bestByNote: 'Best by 12/2026',
    pickupWindowStart: '3:00 PM',
    pickupWindowEnd: '6:00 PM',
    storageNotes: 'Stored in dry back room',
    city: 'Columbus',
    state: 'OH',
    pickupCity: 'Columbus',
    pickupState: 'OH',
  };

  it('accepts valid intake', () => {
    assert.equal(validateFoodRescueDonorIntake(base).ok, true);
  });

  it('rejects homemade food language', () => {
    const r = validateFoodRescueDonorIntake({ ...base, description: 'Homemade lasagna leftovers' });
    assert.equal(r.ok, false);
  });

  it('requires best-by note', () => {
    const r = validateFoodRescueDonorIntake({ ...base, bestByNote: '  ' });
    assert.equal(r.ok, false);
  });
});

describe('pickup window helpers', () => {
  it('detects closed windows', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(isPickupWindowClosed(past), true);
  });

  it('labels closing soon within two hours', () => {
    const end = new Date(Date.now() + 45 * 60_000).toISOString();
    assert.equal(isClosingSoon(end), true);
    const copy = pickupWindowClosesIn(end);
    assert.match(copy.text, /Closes in/);
    assert.equal(copy.urgent, true);
  });

  it('builds today window from meridian times', () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const built = buildTodayPickupWindowIso('2:00 PM', '5:00 PM', now);
    assert.ok(!('ok' in built));
    if ('start' in built) {
      assert.ok(built.end > built.start);
    }
  });
});

describe('status mapping', () => {
  it('maps pending pickup to reserved', () => {
    assert.equal(
      mapFoodRescueListingStatus({ status: 'pending_pickup', pickup_window_end: null, is_food_rescue: true }),
      'reserved',
    );
  });

  it('maps expired window on available listing', () => {
    const end = new Date(Date.now() - 1000).toISOString();
    assert.equal(
      mapFoodRescueListingStatus({ status: 'available', pickup_window_end: end, is_food_rescue: true }),
      'expired',
    );
  });
});

describe('privacy-safe errors', () => {
  it('never exposes raw RPC strings in member copy', () => {
    const msg = foodRescueErrorMessage('ITEM_UNAVAILABLE');
    assert.doesNotMatch(msg.body, /rpc/i);
    assert.doesNotMatch(msg.title, /postgres/i);
  });

  it('detects missing claim RPC', () => {
    assert.equal(
      foodRescueClaimErrorCode(new Error('Could not find the function public.request_marketplace_claim')),
      'RESERVE_RPC_BLOCKED',
    );
  });
});
