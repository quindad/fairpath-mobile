import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { nearMeLocationNudgePart, nearMeRequiresZip } from '../src/core/signal/signal-resource-relevance.ts';

const IPHONE_QA_PROMPT = 'I need a job and transportation near me.';

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Signal chat uses single keyboard strategy (footerScroll + KeyboardFooterLayout)', () => {
  const ui = read('src/app/fairpath-ai.tsx');
  assert.match(ui, /KeyboardFooterLayout/);
  assert.match(ui, /\bfooterScroll\b/);
  assert.match(ui, /chatScrollRef=\{scrollRef\}/);
  assert.match(ui, /useSafeAreaInsets/);
});

test('Signal ask path merges tools, filters resources, and nudges location for near me', () => {
  const ui = read('src/app/fairpath-ai.tsx');
  assert.match(ui, /enrichWithReadTools/);
  assert.match(ui, /shouldKeepResourceResult/);
  assert.match(ui, /nearMeRequiresZip/);
  assert.match(ui, /nearMeLocationNudgePart/);
  assert.match(ui, /fetchFairpathGatewayPlan/);
});

test('near-me without ZIP yields deterministic nudge copy', () => {
  assert.equal(nearMeRequiresZip(IPHONE_QA_PROMPT, null), true);
  const part = nearMeLocationNudgePart();
  assert.match(part.text, /ZIP|location/i);
  assert.equal(part.basis, 'app_state');
});
