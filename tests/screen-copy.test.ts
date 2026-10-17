import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['src/app/veterans.tsx', 'src/app/academy.tsx'];
const BANNED = [
  /approved by (the )?(va|dod|department)/i,
  /va[- ]approved/i,
  /gi bill[- ]approved/i,
  /endorsed by (the )?(va|dod|department|us army|u\.s\. army)/i,
  /guaranteed (job|hire|placement|credit|approval)/i,
  /free course/i, // generic free claims must come from cost classification, not hard-coded copy
  /official seal/i,
];

for (const f of FILES) {
  test(`${f} contains no affiliation, endorsement or guarantee claims`, () => {
    const text = readFileSync(join(process.cwd(), f), 'utf8');
    for (const re of BANNED) assert.equal(re.test(text), false, `${f} matches ${re}`);
  });
}

test('Veterans screen is marked live, not in development', () => {
  const text = readFileSync(join(process.cwd(), 'src/app/veterans.tsx'), 'utf8');
  assert.ok(!text.includes('IN DEVELOPMENT'));
});

test('Academy screen is honest that the catalog is development fixtures, not real partner courses', () => {
  const text = readFileSync(join(process.cwd(), 'src/app/academy.tsx'), 'utf8');
  assert.ok(text.includes('development fixtures only'));
});
