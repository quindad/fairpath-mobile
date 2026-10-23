import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

describe('screen scroll contract', () => {
  it('ScreenFrame uses flex body slot for tab bar layout', () => {
    const chrome = fs.readFileSync('src/components/ProductChrome.tsx', 'utf8');
    assert.match(chrome, /bodySlot.*flex:1.*minHeight:0/s);
    assert.match(chrome, /export function ScreenScroll/);
  });
});
