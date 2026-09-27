// Regression: DEV harnesses (qa-dev-*.mjs) must query real columns of the tables they touch, and must never swallow a
// PostgREST error silently. This is how `qa-dev-render.mjs` previously reported "no verified resources in DEV" when
// the real cause was `.eq('status', 'verified')` on a table with no `status` column (it has publish_status and
// verification_state) — the query errored, the error was discarded, and the empty result read as "not seeded".
// `npm run test:qa-harness-columns`
import fs from 'node:fs';
import { createLocalDb } from './lib/local-db.mjs';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
async function columnsOf(table) {
  const r = await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [table]);
  return new Set(r.rows.map((x) => x.column_name));
}

const harnesses = fs.readdirSync('scripts').filter((f) => /^qa-dev-.*\.mjs$/.test(f));
check(harnesses.length >= 3, 'expected to find the DEV harnesses, found ' + harnesses.length);

for (const file of harnesses) {
  const src = fs.readFileSync('scripts/' + file, 'utf8');
  // Every .from('table').select(...).eq('col', ...) chain: the column must actually exist on that table.
  for (const m of src.matchAll(/\.from\('(\w+)'\)(?:\s*\.\s*\w+\([^)]*\))*?\s*\.\s*eq\('(\w+)'/g)) {
    const [, table, col] = m;
    const cols = await columnsOf(table);
    if (cols.size === 0) continue; // not a real public table (a typo there is a different, obvious failure)
    check(cols.has(col), `${file}: .eq('${col}') on public.${table}, which has no such column (has: ${[...cols].join(', ')})`);
  }
  // Every admin/service-role query result that is destructured must also check .error, or a silent PostgREST
  // error (bad column, bad table, RLS surprise) reads as "empty" instead of failing loudly.
  for (const m of src.matchAll(/const\s*\{\s*data:\s*(\w+)\s*\}\s*=\s*await\s+(?:admin|A\.client|B\.client)\.from\(/g)) {
    failures.push(`${file}: destructures { data: ${m[1]} } from a query without checking .error — a real failure will look like an empty result`);
  }
}

if (failures.length) { console.error('QA harness column checks FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log(`QA harness column checks passed: ${harnesses.length} harness file(s), every .eq() column verified against the real schema, no silently-discarded query errors.`);
