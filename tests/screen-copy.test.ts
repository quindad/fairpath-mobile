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

test('Veterans screen keeps the pathway marked in development', () => {
  const text = readFileSync(join(process.cwd(), 'src/app/veterans.tsx'), 'utf8');
  assert.ok(text.includes('in development'));
});

test('Academy screen labels fixture data as not real courses', () => {
  const text = readFileSync(join(process.cwd(), 'src/app/academy.tsx'), 'utf8');
  assert.ok(text.includes('not real courses'));
});
