import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('food rescue home owns branding and browse entry (not marketplace back nav)', () => {
  const home = read('src/app/food-rescue.tsx');
  const nav = read('src/core/community/food-rescue-nav.ts');

  assert.match(home, /eyebrow="FOOD RESCUE"/);
  assert.match(home, /BROWSE AVAILABLE FOOD/);
  assert.match(nav, /FOOD_RESCUE_BROWSE = '\/food-rescue\/browse'/);
  assert.match(home, /FOOD_RESCUE_BROWSE/);
  assert.doesNotMatch(home, /backTo="\/marketplace"/);
  assert.doesNotMatch(home, /foodRescueOnly/);
});

test('food rescue browse and item routes are first-class', () => {
  const nav = read('src/core/community/food-rescue-nav.ts');
  const browse = read('src/app/food-rescue/browse.tsx');
  const item = read('src/app/food-rescue/item/[id].tsx');
  const donate = read('src/app/food-rescue/donate.tsx');

  assert.match(browse, /eyebrow="FOOD RESCUE"/);
  assert.match(browse, /foodRescueItemRoute/);
  assert.doesNotMatch(browse, /backTo="\/marketplace"/);
  assert.doesNotMatch(browse, /\/market-item\//);

  assert.match(item, /Standalone Food Rescue detail in progress/);
  assert.match(nav, /food-rescue\/item/);

  assert.match(donate, /Donate surplus food/);
  assert.match(donate, /Show in Food Rescue/);
});

test('food rescue UX is more than a marketplace filter banner', () => {
  const home = read('src/app/food-rescue.tsx');
  const browse = read('src/app/food-rescue/browse.tsx');

  assert.match(home, /its own FairPath experience/i);
  assert.doesNotMatch(home, /SAME SAFETY AS MARKETPLACE/);
  assert.doesNotMatch(browse, /SAME SAFETY AS MARKETPLACE/);
});
