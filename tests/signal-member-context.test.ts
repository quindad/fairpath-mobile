import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { SignalResult } from '../src/core/ai/signal.ts';
import {
  filterSignalSuggestionStrings,
  noteForAskFailure,
  noteForSignalResult,
} from '../src/core/signal/signal-member-context.ts';
import type { MemberCapabilities } from '../src/core/profile/member-capabilities-core.ts';

const noJustice: MemberCapabilities = { justice: 'no', veteran: 'no' };
const justiceOnly: MemberCapabilities = { justice: 'yes', veteran: 'no' };
const veteranOnly: MemberCapabilities = { justice: 'no', veteran: 'yes' };

test('filterSignalSuggestionStrings removes record relief prompts when justice tools disabled', () => {
  const input = [
    'Find jobs that fit my experience.',
    'Help me understand my record relief options.',
    'Can I clear this record?',
    'When might I become eligible?',
  ];
  const out = filterSignalSuggestionStrings(input, noJustice);
  assert.deepEqual(out, ['Find jobs that fit my experience.']);
});

test('filterSignalSuggestionStrings keeps record relief prompts when justice enabled', () => {
  const input = ['Help me understand my record relief options.', 'Can I clear this record?'];
  const out = filterSignalSuggestionStrings(input, justiceOnly);
  assert.equal(out.length, 2);
});

test('filterSignalSuggestionStrings removes veteran prompts when veteran tools disabled', () => {
  const input = ['What veteran benefits and jobs should I look at?', 'Find housing opportunities.'];
  const out = filterSignalSuggestionStrings(input, noJustice);
  assert.deepEqual(out, ['Find housing opportunities.']);
});

test('filterSignalSuggestionStrings keeps veteran prompts when veteran enabled', () => {
  const input = ['What veteran benefits and jobs should I look at?'];
  const out = filterSignalSuggestionStrings(input, veteranOnly);
  assert.equal(out.length, 1);
});

test('noteForSignalResult covers credits and service-unavailable without implying a failed main answer', () => {
  const outOfCredits: SignalResult = { status: 'out_of_credits' };
  const rateLimited: SignalResult = { status: 'rate_limited' };
  assert.match(noteForSignalResult(outOfCredits)!, /out of Signal credits/i);
  assert.match(noteForSignalResult(outOfCredits)!, /built-in/i);
  assert.match(noteForSignalResult(rateLimited)!, /unavailable|busy/i);
  assert.match(noteForSignalResult(rateLimited)!, /built-in answer above/i);
});

test('noteForSignalResult detects offline enrichment errors', () => {
  const offline: SignalResult = { status: 'error', message: 'Network request failed' };
  assert.match(noteForSignalResult(offline)!, /offline/i);
});

test('noteForAskFailure prefers offline guidance for routing failures', () => {
  assert.match(noteForAskFailure(new Error('Failed to fetch')), /offline/i);
  assert.match(noteForAskFailure(new Error('timeout')), /Try again/i);
});

test('signal-suggestions wires capability filter after loadMemberCapabilities', () => {
  const src = fs.readFileSync('src/core/signal/signal-suggestions.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /loadMemberCapabilities/);
  assert.match(src, /filterNextStepsForCapabilities/);
  assert.match(src, /filterSignalSuggestionStrings/);
  assert.match(src, /filterGoalLabels/);
});

test('fairpath-ai uses signal-member-context enrichment notes', () => {
  const src = fs.readFileSync('src/app/fairpath-ai.tsx', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /noteForSignalResult/);
  assert.match(src, /noteForAskFailure/);
  assert.doesNotMatch(src, /signalStatusMessage/);
});
