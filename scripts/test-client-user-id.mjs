// Regression: a client-side .insert() into an owner-only member_* table must supply user_id itself. These tables have
// no `default auth.uid()` on user_id (by design, so service-role backfills/seeds stay explicit), so an insert that
// omits it sends user_id = NULL and is correctly rejected by the RLS insert policy (`user_id = auth.uid()`).
// This exact bug shipped in createResume()/createMeeting() and was invisible to local SQL tests, which insert with
// an explicit user_id directly and never exercise the client service layer. `npm run test:client-user-id`
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// Owner-only member_* tables whose user_id column has NO database default (grep of every migration's `create table`).
const NO_DEFAULT_TABLES = new Set();
for (const f of fs.readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql'))) {
  const sql = read('supabase/migrations/' + f);
  for (const m of sql.matchAll(/create table(?: if not exists)? public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, table, body] = m;
    if (!/^member_/.test(table)) continue;
    const col = /user_id\s+uuid\s+(?:not null\s+)?references auth\.users/.exec(body);
    if (col && !/user_id\s+uuid[^,\n]*\bdefault\b/i.test(body)) NO_DEFAULT_TABLES.add(table);
  }
}
check(NO_DEFAULT_TABLES.size >= 5, 'expected to find several member_* tables with no user_id default, found ' + NO_DEFAULT_TABLES.size);

const src = walk('src').filter((f) => /\.ts$/.test(f)).map((f) => f.replace(/\\/g, '/'));
for (const f of src) {
  const t = read(f);
  for (const m of t.matchAll(/\.from\('(\w+)'\)\s*\.\s*insert\(([^;]*?)\)/gs)) {
    const [, table, args] = m;
    if (!NO_DEFAULT_TABLES.has(table)) continue;
    // The insert argument is either inline (check it directly) or a bare identifier assembled a few lines earlier
    // (check the identifier's own definition, found by scanning backward from the insert call).
    const bareIdent = /^\s*(\w+)\s*$/.exec(args)?.[1];
    let ok = /user_id/.test(args);
    if (!ok && bareIdent) {
      const before = t.slice(Math.max(0, m.index - 400), m.index);
      const def = new RegExp(`\\b${bareIdent}\\s*=\\s*\\{[^}]*\\}`).exec(before);
      ok = Boolean(def && /user_id/.test(def[0]));
    }
    check(ok, `${f}: inserts into ${table} (no user_id default) without setting user_id — the RLS insert policy will reject it`);
  }
}

if (failures.length) { console.error('Client user_id checks FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log(`Client user_id checks passed: every client insert into a no-default member_* table (${[...NO_DEFAULT_TABLES].join(', ')}) sets user_id.`);
