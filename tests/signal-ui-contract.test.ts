import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Signal tab uses conversation-first layout', () => {
  const src = read('src/app/fairpath-ai.tsx');
  assert.match(src, /FairPath Signal/);
  assert.match(src, /KeyboardFooterLayout/);
  assert.match(src, /ScreenColumn/);
  assert.match(src, /SignalTurn/);
  assert.match(src, /loadSignalSuggestions/);
  assert.match(src, /Modal visible=\{toolsOpen\}[\s\S]*catalogByCategory/, 'tool catalog lives in tools modal');
  assert.match(src, /Modal visible=\{toolsOpen\}/);
  assert.match(src, /enrichWithReadTools/);
  assert.match(src, /loadActiveConversation/);
  assert.match(src, /cancelAsk/);
});

test('Signal tool registry defines read/write separation', () => {
  const src = read('src/core/signal/signal-tool-registry.ts');
  assert.match(src, /SIGNAL_READ_TOOLS/);
  assert.match(src, /SIGNAL_WRITE_TOOLS/);
  assert.match(src, /risk: 'read'/);
  assert.match(src, /risk: 'write'/);
});
