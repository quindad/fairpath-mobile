import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNAL_CATALOG, catalogByCategory } from '../src/core/ai/signal-catalog.ts';

test('Signal catalog lists live member workflows with unique ids', () => {
  const ids = SIGNAL_CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(SIGNAL_CATALOG.length >= 10);
  for (const e of SIGNAL_CATALOG) {
    assert.ok(e.title && e.description);
    assert.ok(e.route || e.assistantPrompt);
    assert.ok(e.creditCost >= 1);
  }
});

test('catalogByCategory covers every entry once', () => {
  const flat = catalogByCategory().flatMap((g) => g.items);
  assert.equal(flat.length, SIGNAL_CATALOG.length);
});
