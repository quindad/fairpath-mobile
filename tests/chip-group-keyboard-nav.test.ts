// Regression test for a real defect: ChipGroup's radio chips (src/components/ui-kit.tsx) had no aria-checked at
// all (a screen reader could not tell which chip was selected) and no keyboard navigation beyond individually
// tabbing through every chip (13 tab stops for a 2-group form), unlike every native radio-button group. Fixed by
// adding aria-checked, roving tabindex (only the selected chip is a Tab stop), and arrow-key navigation that both
// moves focus and selects, matching the standard WAI-ARIA radiogroup pattern. Checkbox groups (single=false) were
// deliberately left with independent per-chip tabbing, since there is no roving-tabindex convention for a group of
// independent yes/no controls. This file covers the pure index math extracted to make that logic testable without
// a DOM; src/components/chip-group-nav.ts has no imports, so it runs directly under Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNavigationKey, nextChipIndex } from '../src/components/chip-group-nav.ts';

test('ArrowRight and ArrowDown move forward by one', () => {
  assert.equal(nextChipIndex(0, 5, 'ArrowRight'), 1);
  assert.equal(nextChipIndex(0, 5, 'ArrowDown'), 1);
  assert.equal(nextChipIndex(2, 5, 'ArrowRight'), 3);
});

test('ArrowLeft and ArrowUp move backward by one', () => {
  assert.equal(nextChipIndex(2, 5, 'ArrowLeft'), 1);
  assert.equal(nextChipIndex(2, 5, 'ArrowUp'), 1);
});

test('forward wraps from the last chip to the first', () => {
  assert.equal(nextChipIndex(4, 5, 'ArrowRight'), 0);
});

test('backward wraps from the first chip to the last', () => {
  assert.equal(nextChipIndex(0, 5, 'ArrowLeft'), 4);
});

test('a single-option group wraps to itself in either direction', () => {
  assert.equal(nextChipIndex(0, 1, 'ArrowRight'), 0);
  assert.equal(nextChipIndex(0, 1, 'ArrowLeft'), 0);
});

test('only the four arrow keys are treated as navigation keys', () => {
  assert.equal(isNavigationKey('ArrowRight'), true);
  assert.equal(isNavigationKey('ArrowLeft'), true);
  assert.equal(isNavigationKey('ArrowUp'), true);
  assert.equal(isNavigationKey('ArrowDown'), true);
  assert.equal(isNavigationKey('Enter'), false);
  assert.equal(isNavigationKey(' '), false);
  assert.equal(isNavigationKey('Tab'), false);
});
