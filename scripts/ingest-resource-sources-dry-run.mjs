/**
 * Dry-run: validate authoritative source catalog (no network, no DB writes).
 *   node scripts/ingest-resource-sources-dry-run.mjs
 */
import fs from 'node:fs';

const path = 'data/resource-sources/authoritative-catalog.json';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const sources = raw.sources ?? [];
const problems = [];

for (const s of sources) {
  if (!s.id || !s.officialUrl?.startsWith('https://')) problems.push(`${s.id ?? '?'}: missing https officialUrl`);
  if (!s.categories?.length) problems.push(`${s.id}: missing categories`);
  if (!s.status) problems.push(`${s.id}: missing status`);
}

const report = {
  at: new Date().toISOString(),
  catalogPath: path,
  sourceCount: sources.length,
  categories: [...new Set(sources.flatMap((s) => s.categories))].sort(),
  problems,
  wroteDatabase: false,
  mode: 'dry-run',
};
fs.writeFileSync('data/resource-sources/last-dry-run.json', JSON.stringify(report, null, 2));

if (problems.length) {
  console.error('Dry-run FAILED:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(`Dry-run OK: ${sources.length} authoritative sources catalogued. Wrote data/resource-sources/last-dry-run.json`);
