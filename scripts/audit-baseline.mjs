import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseCsvObjects } from '../supabase/baseline/csv.mjs';

const root = process.cwd();
const failures = [];
const notes = [];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const stripSqlComments = (sql) => sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const norm = (s) => s.replace(/\r\n/g, '\n');
// Destructive = a real DROP TABLE / TRUNCATE / DELETE FROM *statement*. Dollar-quoted bodies
// (function bodies, cron commands) are ignored, and GRANT privilege lists — which contain the
// words "delete"/"truncate" — are not statements.
const stripDollarQuoted = (sql) => sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, '$$$$');
const isDestructive = (sql) => /\bdrop\s+table\b|^\s*truncate\b|\bdelete\s+from\b/im.test(stripDollarQuoted(stripSqlComments(sql)));

const migDir = path.join(root, 'supabase/migrations');
const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();

// ---------------------------------------------------------------------
// 1. Supabase CLI versions: 14-digit, unique, ascending. The CLI keys
//    schema_migrations on the leading digits, so duplicates break `db push`.
// ---------------------------------------------------------------------
const seen = new Map();
for (const f of files) {
  const m = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(f);
  if (!m) { failures.push(`Migration "${f}" must be named <14-digit-version>_<name>.sql (Supabase CLI version key).`); continue; }
  if (seen.has(m[1])) failures.push(`Duplicate migration version ${m[1]}: ${seen.get(m[1])} and ${f}.`);
  seen.set(m[1], f);
}
const baselineTablesFile = files.find((f) => f.endsWith('_baseline_tables.sql'));
const baselineLogicFile = files.find((f) => f.endsWith('_baseline_constraints_security_logic.sql'));
if (!baselineTablesFile) failures.push('Missing baseline tables migration (…_baseline_tables.sql).');
const firstDated = files.find((f) => f.startsWith('20260924'));
if (baselineTablesFile && firstDated && baselineTablesFile > firstDated) failures.push('Baseline tables migration must sort BEFORE the 20260924 Step 0/1 migrations.');
if (baselineLogicFile && firstDated && baselineLogicFile > firstDated) failures.push('Baseline logic migration must sort BEFORE the 20260924 Step 0/1 migrations.');
if (baselineTablesFile && baselineLogicFile && baselineTablesFile > baselineLogicFile) failures.push('Baseline tables must sort before baseline logic.');

// ---------------------------------------------------------------------
// 2. Baseline tables: production refusal guard, exact counts, no drift
// ---------------------------------------------------------------------
const columnsCsv = parseCsvObjects(read('supabase/baseline/source/production_columns.csv'));
const csvTables = new Set(columnsCsv.map((r) => r.table_name));
if (csvTables.size !== 36) failures.push(`production_columns.csv should describe 36 tables, has ${csvTables.size}.`);
if (columnsCsv.length !== 440) failures.push(`production_columns.csv should have 440 columns, has ${columnsCsv.length}.`);

if (baselineTablesFile) {
  const sql = norm(read('supabase/migrations/' + baselineTablesFile));
  if (!/to_regclass\('public\.profiles'\) is not null/.test(sql) || !/BASELINE REFUSED/.test(sql)) {
    failures.push('Baseline tables migration is missing its production-refusal guard (must abort when public.profiles exists).');
  }
  const created = [...sql.matchAll(/^create table public\."([a-z_]+)" \(/gm)].map((m) => m[1]);
  if (created.length !== 36) failures.push(`Baseline tables migration creates ${created.length} tables, expected 36.`);
  for (const t of csvTables) if (!created.includes(t)) failures.push(`Baseline tables migration is missing table ${t}.`);
  const colCount = [...sql.matchAll(/^  "[a-z_0-9]+" /gm)].length;
  if (colCount !== columnsCsv.length) failures.push(`Baseline tables migration has ${colCount} columns, export has ${columnsCsv.length}.`);
  if (isDestructive(sql)) failures.push('Baseline tables migration contains a destructive statement.');

  // drift: regenerate to a temp file and compare byte-for-byte
  const tmp = path.join(os.tmpdir(), 'fp_baseline_tables_check.sql');
  const r = spawnSync(process.execPath, ['supabase/baseline/generate-baseline-tables.mjs'], { cwd: root, env: { ...process.env, BASELINE_TABLES_OUT: tmp }, encoding: 'utf8' });
  if (r.status !== 0) failures.push('generate-baseline-tables.mjs failed: ' + (r.stderr || r.stdout));
  else if (norm(fs.readFileSync(tmp, 'utf8')) !== sql) failures.push('Baseline tables migration has drifted from its generator/source. Regenerate: node supabase/baseline/generate-baseline-tables.mjs (do not hand-edit).');
}

// ---------------------------------------------------------------------
// 3. Baseline logic migration: pending until the production definitions
//    export exists; once it exists it must be present, guarded, no-drift.
// ---------------------------------------------------------------------
const definitionsSrc = ['production_definitions.csv', 'production_definitions.json'].map((f) => 'supabase/baseline/source/' + f).find(exists);
if (!definitionsSrc) {
  notes.push('Baseline logic (constraints/RLS/RPCs/triggers/storage/cron) is PENDING the read-only production definitions export — see supabase/baseline/README.md. Do not `db push` until it is generated.');
  if (baselineLogicFile) failures.push('Baseline logic migration exists but no production_definitions source is committed to regenerate/verify it.');
} else {
  if (!baselineLogicFile) failures.push('production_definitions export exists but the baseline logic migration has not been generated (node supabase/baseline/generate-baseline-logic.mjs).');
  else {
    const sql = norm(read('supabase/migrations/' + baselineLogicFile));
    if (!/BASELINE LOGIC REFUSED/.test(sql) || !/profiles_pkey/.test(sql)) failures.push('Baseline logic migration is missing its production-refusal guard.');
    if (isDestructive(sql)) failures.push('Baseline logic migration contains a destructive statement.');
    if (!/enable row level security/.test(sql)) failures.push('Baseline logic migration enables RLS on no tables — that would leave DEV unprotected.');
    const tmp = path.join(os.tmpdir(), 'fp_baseline_logic_check.sql');
    const r = spawnSync(process.execPath, ['supabase/baseline/generate-baseline-logic.mjs'], { cwd: root, env: { ...process.env, BASELINE_OUT: tmp }, encoding: 'utf8' });
    if (r.status !== 0) failures.push('generate-baseline-logic.mjs failed: ' + (r.stderr || r.stdout));
    else if (norm(fs.readFileSync(tmp, 'utf8')) !== sql) failures.push('Baseline logic migration has drifted from its export. Regenerate it (do not hand-edit).');
  }
}

// ---------------------------------------------------------------------
// 4. Logic generator regression test against a synthetic fixture
// ---------------------------------------------------------------------
{
  const tmp = path.join(os.tmpdir(), 'fp_baseline_fixture_out.sql');
  const r = spawnSync(process.execPath, ['supabase/baseline/generate-baseline-logic.mjs', 'supabase/baseline/fixtures/sample_definitions.json', '--allow-empty'], { cwd: root, env: { ...process.env, BASELINE_OUT: tmp }, encoding: 'utf8' });
  if (r.status !== 0) failures.push('Logic generator failed on the fixture: ' + (r.stderr || r.stdout));
  else {
    const out = fs.readFileSync(tmp, 'utf8');
    const idx = (s) => out.indexOf(s);
    const checks = [
      ['refusal guard', /BASELINE LOGIC REFUSED: profiles_pkey already exists/.test(out)],
      ['check_function_bodies off', /set check_function_bodies = false;/.test(out)],
      ['primary keys before foreign keys', idx('add constraint "profiles_pkey"') > -1 && idx('add constraint "profiles_pkey"') < idx('add constraint "profiles_id_fkey"')],
      ['check before foreign keys', idx('add constraint "profiles_account_type_check"') < idx('add constraint "profiles_id_fkey"')],
      ['FK to auth.users preserved with ON DELETE rule', /REFERENCES auth\.users\(id\) ON DELETE CASCADE/.test(out)],
      ['function body quoting preserved', /raise exception 'it''s a fixture';/.test(out) && /\$function\$;/.test(out)],
      ['function ACL reproduced (revoke then grant)', /revoke all on function public\.submit_housing_application\(uuid,jsonb,jsonb\) from public, anon, authenticated, service_role;/.test(out) && /grant execute on function public\.handle_new_user\(\) to service_role;/.test(out)],
      ['functions before policies before triggers', idx('CREATE OR REPLACE FUNCTION public.handle_new_user') < idx('create policy "profiles_owner_select"') && idx('create policy "profiles_owner_select"') < idx('CREATE TRIGGER on_auth_user_created')],
      ['RLS enabled', /alter table public\."profiles" enable row level security;/.test(out)],
      ['table grants reproduced', /grant insert, select, update, delete on table public\."profiles" to authenticated;/.test(out)],
      ['public role policy', /for select to public using/.test(out)],
      ['storage policy targets storage.objects', /create policy "housing_docs_owner" on storage\."objects"/.test(out)],
      ['storage bucket seeded', /insert into storage\.buckets .*'housing-application-documents'/.test(out)],
      ['cron job recreated', /cron\.schedule\('expire-marketplace-pickups'/.test(out)],
      ['identity always restored', /alter column "id" set generated always;/.test(out)],
      ['indexes made idempotent', /create unique index if not exists saved_jobs_uidx/.test(out)],
      ['app_config seed', /'fasttrack_payment_enforced', 'false'::jsonb/.test(out)],
    ];
    for (const [name, ok] of checks) if (!ok) failures.push(`Logic generator fixture check failed: ${name}.`);
  }
  // A partial export must be refused, not silently accepted
  const partial = spawnSync(process.execPath, ['supabase/baseline/generate-baseline-logic.mjs', 'supabase/baseline/fixtures/sample_definitions.json'], { cwd: root, env: { ...process.env, BASELINE_OUT: path.join(os.tmpdir(), 'fp_should_not_exist.sql') }, encoding: 'utf8' });
  if (partial.status === 0) failures.push('Logic generator accepted a partial (fixture-sized) export without --allow-empty.');
}

// ---------------------------------------------------------------------
// 5. Dependency invariant: every table a dated (20260924*) migration
//    references/alters/creates-on must already exist by the time it runs
//    (baseline tables, or created by an earlier migration).
// ---------------------------------------------------------------------
if (baselineTablesFile) {
  const known = new Set(csvTables);
  for (const f of files.filter((x) => x.startsWith('20260924'))) {
    const sql = stripSqlComments(norm(read('supabase/migrations/' + f)));
    for (const m of sql.matchAll(/(?:references|alter table|insert into|update|from|join)\s+(?:if exists\s+)?public\.([a-z_]+)/gi)) {
      const t = m[1];
      if (!known.has(t) && !new RegExp(`create table (if not exists )?public\\.${t}\\b`, 'i').test(sql)) {
        failures.push(`${f} depends on public.${t}, which is not in the baseline or created earlier.`);
      }
    }
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)) known.add(m[1]);
  }
}

// ---------------------------------------------------------------------
// 5b. Grant invariant: DEV/hosted defaults do not reliably grant table
//     privileges, so every table created after the baseline needs an
//     explicit grant to service_role, and to every role its RLS policies
//     target (otherwise RLS is never reached: "permission denied").
// ---------------------------------------------------------------------
{
  const allSql = files.map((f) => stripSqlComments(norm(read('supabase/migrations/' + f)))).join('\n');
  const granted = (table, role) =>
    [...allSql.matchAll(/grant\s+[a-z,\s]+\s+on\s+(?:table\s+)?([^;]+?)\s+to\s+([^;]+);/gi)].some(
      (g) => new RegExp(`public\\.${table}\\b`, 'i').test(g[1]) && new RegExp(`\\b${role}\\b`, 'i').test(g[2]),
    );
  for (const f of files.filter((x) => x !== baselineTablesFile && x !== baselineLogicFile)) {
    const sql = stripSqlComments(norm(read('supabase/migrations/' + f)));
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)) {
      const t = m[1];
      const roles = new Set(['service_role']);
      for (const p of allSql.matchAll(new RegExp(`create policy[^;]*?on\\s+public\\.${t}\\b[^;]*?\\bto\\s+([a-z_,\\s]+?)\\s+(?:using|with check)`, 'gi'))) {
        for (const r of p[1].split(',')) if (/^(anon|authenticated)$/i.test(r.trim())) roles.add(r.trim().toLowerCase());
      }
      for (const r of roles) if (!granted(t, r)) failures.push(`${f}: public.${t} has no explicit GRANT to ${r} in any migration.`);
    }
  }
}

// ---------------------------------------------------------------------
// 6. Production isolation: no executable migration may mention the
//    production project ref/host
// ---------------------------------------------------------------------
for (const f of files) {
  if (/rqpczemdagoddhuwefxt/.test(read('supabase/migrations/' + f))) failures.push(`${f} mentions the production project ref — migrations must be environment-agnostic.`);
}

// ---------------------------------------------------------------------
// 7. Local link/state hygiene: CLI link state must never be committable
// ---------------------------------------------------------------------
const gitignore = read('.gitignore');
if (!/supabase\/\.temp/.test(gitignore)) failures.push('.gitignore must ignore supabase/.temp/ (local Supabase CLI link state).');
if (!/^\.env\.local$/m.test(gitignore) && !/\.env\*\.local/.test(gitignore)) failures.push('.gitignore must ignore .env.local.');

if (failures.length) {
  console.error('Baseline audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Baseline audit passed: ${files.length} migrations with unique CLI versions, baseline tables (36 tables / ${columnsCsv.length} columns, no drift), production-refusal guards, logic-generator fixture (17 checks), dependency ordering.`);
for (const n of notes) console.log('NOTE: ' + n);
