// Approved primary tab order is Home, Explore, My Path, Signal, Profile.
// ProductChrome previously rendered AI before My Path. This reads the BottomNavBar items
// literal so a reorder fails without mounting React Native.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APPROVED: readonly (readonly [string, string])[] = [
  ['Home', '/home'],
  ['Explore', '/explore'],
  ['My Path', '/my-path'],
  ['Signal', '/fairpath-ai'],
  ['Profile', '/me'],
];

test('primary tabs are Home, Explore, My Path, Signal, Profile', () => {
  const src = readFileSync('src/components/ProductChrome.tsx', 'utf8');
  const match = src.match(/const items:[^=]+=\[([\s\S]*?)\];/);
  assert.ok(match, 'BottomNavBar items array not found');
  const tabs = [...match[1].matchAll(/\['([^']+)','([^']+)','([^']+)'\]/g)].map((m) => [m[2], m[3]]);
  assert.deepEqual(tabs, APPROVED.map((pair) => [pair[0], pair[1]]));
});
