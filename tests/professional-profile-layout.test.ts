import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Static layout contract checks (Node) — not a substitute for real iPhone device QA.
 * Web/responsive simulation in Expo web is optional manual follow-up.
 */
const preview = readFileSync('src/app/opportunity-profile/preview.tsx', 'utf8');
const card = readFileSync('src/components/opportunity/ProfessionalProfileCard.tsx', 'utf8');
const fit = readFileSync('src/components/jobs/JobProfileFitPanel.tsx', 'utf8');
const apply = readFileSync('src/app/job-apply/[id].tsx', 'utf8');

test('professional preview uses scroll container for small screens', () => {
  assert.match(preview, /ScrollView/);
  assert.match(preview, /paddingHorizontal/);
});

test('professional card uses panel stack without fixed heights', () => {
  assert.match(card, /gap:\s*12/);
  assert.match(card, /export function ProfessionalProfileCard/);
});

test('job fit panel stays collapsible to reduce scroll', () => {
  assert.match(fit, /WHY THIS JOB MAY FIT/);
  assert.match(fit, /expanded/);
});

test('easy apply includes share preview when sections selected', () => {
  assert.match(apply, /ApplicationSharePreviewPanel/);
  assert.match(apply, /summary/);
});
