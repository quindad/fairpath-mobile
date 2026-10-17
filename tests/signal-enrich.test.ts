import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSignalText, SIGNAL_ENRICH_INTENTS } from '../src/core/ai/signal-enrich.ts';
import type { AiResponse } from '../src/core/ai/orchestrator.ts';

const base: AiResponse = {
  intent: 'next_steps',
  title: 'Next',
  modelAssisted: false,
  parts: [{ text: 'Open My Path.', basis: 'app_state' }],
  actions: [],
  provenance: {
    task: 'next_steps',
    intent: 'next_steps',
    engine: 'deterministic_router',
    route: '/my-path',
    sourceRefs: [],
    ruleVersions: [],
    officialSources: [],
    confidence: 'deterministic',
  },
};

test('Signal enrich intents include focus and resource help', () => {
  assert.ok(SIGNAL_ENRICH_INTENTS.includes('next_steps'));
  assert.ok(SIGNAL_ENRICH_INTENTS.includes('find_resources'));
});

test('mergeSignalText appends AI wording without dropping deterministic parts', () => {
  const merged = mergeSignalText(base, 'Prioritize your housing application follow-up.');
  assert.equal(merged.parts.length, 2);
  assert.equal(merged.parts[1].basis, 'ai');
  assert.equal(merged.modelAssisted, true);
  assert.equal(merged.provenance.engine, 'model');
});
