import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('can-help hub exposes four action cards with expected labels and routes', () => {
  const src = read('src/app/community/can-help.tsx');
  const nav = read('src/core/community/food-rescue-nav.ts');

  assert.match(src, /Respond to requests/);
  assert.match(src, /Donate goods/);
  assert.match(src, /Donate food/);
  assert.match(src, /Volunteer & drives/);

  assert.match(nav, /CAN_HELP_OPEN_REQUESTS = '\/community\/open-requests'/);
  assert.match(src, /CAN_HELP_OPEN_REQUESTS/);
  assert.match(src, /CAN_HELP_DONATE_GOODS/);
  assert.match(src, /FOOD_RESCUE_DONATE/);
  assert.match(src, /CAN_HELP_VOLUNTEER/);

  assert.match(src, /accessibilityRole="button"/);
  assert.doesNotMatch(src, /Only completed Marketplace pickups count toward monthly claim limits/);
  assert.doesNotMatch(src, /loadCommunityHelpBoard/);
});

test('can-help is not a marketplace-filter-only screen', () => {
  const src = read('src/app/community/can-help.tsx');
  assert.doesNotMatch(src, /foodRescueOnly/);
  assert.doesNotMatch(src, /LIST A FREE ITEM \(GIVE\)/);
  assert.doesNotMatch(src, /FOOD RESCUE LISTINGS/);
});
