// Cross-repo justice-match-contract parity. npm run test:justice-contract
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repos = [
  path.join(root, 'src/core/matching/justice-match-contract.ts'),
  path.join(root, '..', 'quindad-fairpath-partner', 'src/lib/justice-match-contract.ts'),
  path.join(root, '..', 'fairpath-admin', 'src/lib/justice-match-contract.ts'),
];

const hashes = repos.map((p) => {
  if (!fs.existsSync(p)) return { p, missing: true };
  const body = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim();
  return { p, hash: crypto.createHash('sha256').update(body).digest('hex') };
});

const present = hashes.filter((h) => !h.missing);
const unique = new Set(present.map((h) => h.hash));
if (present.length < 3) {
  console.error('FAIL  justice contract: missing file(s)');
  for (const h of hashes.filter((x) => x.missing)) console.error('  missing:', h.p);
  process.exit(1);
}
if (unique.size !== 1) {
  console.error('FAIL  justice-match-contract.ts differs across repos');
  for (const h of present) console.error(' ', h.hash.slice(0, 12), h.p);
  process.exit(1);
}
console.log('PASS  justice contract parity (3/3 identical)');
