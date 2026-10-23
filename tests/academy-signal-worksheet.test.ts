import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { academySignalWorksheetPrompt, signalWorksheetConsentLine } from '../src/core/academy/signal-worksheet.ts';
import { academyCloudSyncState } from '../src/core/academy/cloud-persistence.ts';

test('academy cloud sync stays device-local until migration', () => {
  assert.equal(academyCloudSyncState(), 'device_local');
});

test('Signal worksheet prompt is consent-aware and lesson-specific', () => {
  const q = academySignalWorksheetPrompt('Choose your idea', 'What problem do you solve?');
  assert.match(q, /Startup Academy worksheet/);
  assert.match(q, /Choose your idea/);
  assert.match(signalWorksheetConsentLine(), /pending_approval|built-in guidance/i);
});

test('lesson screen exposes Signal worksheet entry', () => {
  const src = fs.readFileSync('src/app/entrepreneurship/lesson/[stepId].tsx', 'utf8');
  assert.match(src, /Open Signal worksheet/);
  assert.match(src, /signalWorksheetConsentLine/);
});
