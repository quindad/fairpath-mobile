import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_INTRO_SLIDES } from '../src/core/onboarding/intro-slides.ts';

const intro = readFileSync('src/app/intro/index.tsx', 'utf8');

test('intro keeps seven slides from shared config', () => {
  assert.equal(APP_INTRO_SLIDES.length, 7);
  assert.match(intro, /APP_INTRO_SLIDES/);
});

test('intro layout uses flex zones and pager height for native balance', () => {
  assert.match(intro, /middleZone.*flex:\s*1/s);
  assert.match(intro, /bottomZone/);
  assert.match(intro, /justifyContent:\s*'center'/);
  assert.match(intro, /getItemLayout/);
  assert.match(intro, /useSafeAreaInsets/);
});

test('intro primary navigation matches FairPath rounded CTA style', () => {
  assert.match(intro, /borderRadius:\s*14/);
  assert.match(intro, /minHeight:\s*52/);
});
