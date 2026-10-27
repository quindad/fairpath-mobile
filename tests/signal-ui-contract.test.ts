import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Signal tab uses conversation-first layout', () => {
  const src = read('src/app/fairpath-ai.tsx');
  assert.match(src, /FairPath Signal/);
  assert.match(src, /FormScrollView/);
  assert.match(src, /SignalKeyboardFooterLayout/, 'fixed composer stays above iOS keyboard');
  assert.match(src, /s\.composer/, 'composer is pinned outside the scroll region');
  assert.match(src, /ScreenColumn/);
  assert.match(src, /SignalTurn/);
  assert.match(src, /loadSignalSuggestions/);
  assert.match(src, /signalQuickTools/, 'tools menu stays compact');
  assert.match(src, /enrichWithReadTools/);
  assert.match(src, /loadActiveConversation/);
  assert.match(src, /cancelAsk/);
  assert.match(src, /letter-explainer/, 'attachment entry routes to supported document workflow');
});

test('Signal tool registry defines read/write separation', () => {
  const src = read('src/core/signal/signal-tool-registry.ts');
  assert.match(src, /SIGNAL_READ_TOOLS/);
  assert.match(src, /SIGNAL_WRITE_TOOLS/);
  assert.match(src, /risk: 'read'/);
  assert.match(src, /risk: 'write'/);
});
