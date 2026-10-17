import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Home does not promise vague FairPath+ automation', () => {
  const home = readFileSync('src/app/home.tsx', 'utf8');
  assert.equal(/automation and guided tools/i.test(home), false);
  assert.ok(home.includes('member-facing-copy'));
});

test('Bottom nav labels the AI tab Signal', () => {
  const chrome = readFileSync('src/components/ProductChrome.tsx', 'utf8');
  assert.ok(chrome.includes("['bot','Signal','/fairpath-ai']"));
});

test('FairPath+ benefits list matches honest member perks', () => {
  const benefits = readFileSync('src/core/membership/fairpath-plus.ts', 'utf8');
  assert.ok(benefits.includes('marketplace_claims'));
  assert.equal(/fasttrack_discount/.test(benefits), false);
  assert.ok(benefits.includes('signal_credits'));
  assert.equal(/ai_interview/.test(benefits), false);
});
