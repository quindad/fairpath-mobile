// Generates supabase/migrations/20260901000100_baseline_constraints_security_logic.sql
// from the production definitions export produced by
// supabase/baseline/export_prod_definitions.sql.
//
//   node supabase/baseline/generate-baseline-logic.mjs [path/to/export.csv|.json]
//
// Default input: supabase/baseline/source/production_definitions.(json|csv)
// Refuses to write anything from an obviously partial export.

import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, parseCsvObjects } from './csv.mjs';

const root = process.cwd();
// BASELINE_OUT is a test-only override so fixture runs never touch supabase/migrations/.
const outFile = process.env.BASELINE_OUT
  ? path.resolve(process.env.BASELINE_OUT)
  : path.join(root, 'supabase/migrations/20260901000100_baseline_constraints_security_logic.sql');
const sourceDir = path.join(root, 'supabase/baseline/source');

function fail(msg) {
  console.error('generate-baseline-logic: ' + msg);
  process.exit(1);
}

const argPath = process.argv[2];
const inputPath = argPath
  ? path.resolve(argPath)
  : ['production_definitions.json', 'production_definitions.csv'].map((f) => path.join(sourceDir, f)).find((p) => fs.existsSync(p));
if (!inputPath || !fs.existsSync(inputPath)) {
  fail('no definitions export found. Run supabase/baseline/export_prod_definitions.sql on production (read-only) and save the result as supabase/baseline/source/production_definitions.csv');
}

function loadDefinitions(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  if (text.trimStart().startsWith('{')) return JSON.parse(text);
  const rows = parseCsv(text);
  const idx = rows[0]?.indexOf('definitions');
  if (idx == null || idx < 0 || !rows[1]) fail('CSV export must have a "definitions" column and one data row.');
  return JSON.parse(rows[1][idx]);
}

const d = loadDefinitions(inputPath);
for (const k of ['constraints', 'indexes', 'tables', 'policies', 'functions', 'triggers', 'buckets']) {
  if (!Array.isArray(d[k])) fail(`export is missing the "${k}" array — re-run the full export query.`);
}
const allowEmpty = process.argv.includes('--allow-empty');
if (!allowEmpty) {
  if (d.constraints.length < 30) fail(`only ${d.constraints.length} constraints — this looks like a partial export.`);
  if (d.tables.length !== 36) fail(`expected 36 tables, export has ${d.tables.length}.`);
  if (d.functions.length < 1) fail('export has zero functions — the RPCs (submit_housing_application, marketplace_*) should be present. Use --allow-empty only if that is truly expected.');
  if (d.policies.length < 1) fail('export has zero RLS policies — that would leave DEV unprotected. Use --allow-empty only if that is truly expected.');
}

// ---- helpers ---------------------------------------------------------------
const bare = (t) => String(t).replace(/^"?public"?\./, '').replace(/^"(.*)"$/, '$1');
const pt = (t) => `public."${bare(t)}"`;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const dollar = (tag, body) => `$${tag}$${body}$${tag}$`;
const stripSemi = (s) => String(s).trim().replace(/;\s*$/, '');

const ROLES_OF_INTEREST = ['public', 'anon', 'authenticated', 'service_role'];
function parseAcl(acl) {
  // aclitem text:  grantee=privs/grantor ; empty grantee = PUBLIC
  const out = new Map();
  for (const item of acl || []) {
    const m = /^(.*?)=([A-Za-z*]*)\/(.*)$/.exec(item);
    if (!m) continue;
    const grantee = m[1] === '' ? 'public' : m[1];
    if (!ROLES_OF_INTEREST.includes(grantee)) continue;
    out.set(grantee, m[2].replace(/\*/g, ''));
  }
  return out;
}
const TABLE_PRIV = { r: 'select', a: 'insert', w: 'update', d: 'delete', D: 'truncate', x: 'references', t: 'trigger', m: 'maintain' };

// ---- sections --------------------------------------------------------------
const sec = [];
const push = (...lines) => sec.push(...lines);
const stats = {};

push(`-- BASELINE (DEV BOOTSTRAP ONLY): production constraints, RLS, policies,
-- functions/RPCs, triggers, grants, storage and cron.
--
-- Generated from a READ-ONLY definitions export of the production
-- 'fairpath-mobile' project (exported_at ${d.exported_at ?? 'unknown'}, server ${d.server_version ?? 'unknown'})
-- by supabase/baseline/generate-baseline-logic.mjs. DO NOT hand-edit —
-- regenerate instead.
--
-- Runs AFTER 20260901000000_baseline_tables.sql. REFUSES to run if
-- public.profiles_pkey already exists (i.e. production or an already
-- bootstrapped database). Never mark this migration applied on production.

set check_function_bodies = false;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'BASELINE LOGIC REFUSED: public.profiles does not exist — apply 20260901000000_baseline_tables.sql first.';
  end if;
  if exists (select 1 from pg_constraint where conname = 'profiles_pkey' and connamespace = 'public'::regnamespace) then
    raise exception 'BASELINE LOGIC REFUSED: profiles_pkey already exists. This baseline only bootstraps an empty database (fairpath-mobile-dev). It must never run against production.';
  end if;
end $$;
`);

// 1. extensions
const PREINSTALLED = new Set(['plpgsql', 'pg_stat_statements', 'pg_graphql', 'supabase_vault', 'pgcrypto', 'uuid-ossp', 'pgsodium', 'pgjwt']);
const exts = (d.extensions || []).map((e) => e.name).filter((n) => !PREINSTALLED.has(n));
const needsCron = exts.includes('pg_cron') || (d.cron_jobs || []).length > 0;
push('-- 1. extensions');
for (const n of exts.filter((x) => x !== 'pg_cron')) push(`create extension if not exists "${n}" with schema extensions;`);
if (needsCron) push('create extension if not exists pg_cron with schema pg_catalog;');
push('');
stats.extensions = exts.length + (needsCron && !exts.includes('pg_cron') ? 1 : 0);

// 2. identity kinds
push('-- 2. identity columns (baseline tables used "generated by default")');
let identityAlways = 0;
for (const c of d.identity_columns || []) {
  if (c.kind === 'a') {
    push(`alter table ${pt(c.table)} alter column "${c.column}" set generated always;`);
    identityAlways++;
  }
}
push('');

// 3. constraints: p,u -> c -> f -> x
push('-- 3. constraints (primary/unique, then check, then foreign keys)');
const order = { p: 0, u: 1, c: 2, f: 3, x: 4 };
const cons = [...d.constraints].sort((a, b) => (order[a.type] - order[b.type]) || bare(a.table).localeCompare(bare(b.table)) || a.name.localeCompare(b.name));
for (const c of cons) push(`alter table ${pt(c.table)} add constraint "${c.name}" ${stripSemi(c.def)};`);
push('');
stats.constraints = cons.length;

// 4. indexes
push('-- 4. indexes (not backing a constraint)');
for (const i of d.indexes) {
  push(stripSemi(i.def).replace(/^CREATE (UNIQUE )?INDEX /i, (m, u) => `create ${u ? 'unique ' : ''}index if not exists `) + ';');
}
push('');
stats.indexes = d.indexes.length;

// 5. views
push('-- 5. views');
for (const v of d.views || []) {
  const opts = v.options && v.options.length ? `with (${v.options.join(', ')}) ` : '';
  push(`create or replace view public."${v.name}" ${opts}as ${stripSemi(v.def)};`);
}
push('');
stats.views = (d.views || []).length;

// 6. functions + ACLs
push('-- 6. functions / RPCs (bodies exactly as in production) and their EXECUTE grants');
for (const f of d.functions) {
  push(stripSemi(f.def) + ';');
  const sig = /^[^(]*\./.test(f.signature) ? f.signature : `public.${f.signature}`;
  if (f.acl) {
    const acl = parseAcl(f.acl);
    push(`revoke all on function ${sig} from public, anon, authenticated, service_role;`);
    const granted = ROLES_OF_INTEREST.filter((r) => (acl.get(r) || '').includes('X'));
    if (granted.length) push(`grant execute on function ${sig} to ${granted.join(', ')};`);
  }
  push('');
}
stats.functions = d.functions.length;

// 7. RLS + table grants
push('-- 7. row level security flags and table privileges');
for (const t of d.tables) {
  if (t.rls) push(`alter table ${pt(t.name)} enable row level security;`);
  if (t.force_rls) push(`alter table ${pt(t.name)} force row level security;`);
  if (t.acl) {
    const acl = parseAcl(t.acl);
    push(`revoke all on table ${pt(t.name)} from anon, authenticated, service_role;`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const privs = [...(acl.get(role) || '')].map((l) => TABLE_PRIV[l]).filter(Boolean);
      if (privs.length) push(`grant ${privs.join(', ')} on table ${pt(t.name)} to ${role};`);
    }
  }
}
push('');
stats.rls_tables = d.tables.filter((t) => t.rls).length;

// 8. policies
function policySql(p, target) {
  const roles = (p.roles && p.roles.length ? p.roles : ['public']).join(', ');
  let s = `drop policy if exists "${p.name}" on ${target};\ncreate policy "${p.name}" on ${target} as ${String(p.permissive).toLowerCase()} for ${String(p.cmd).toLowerCase()} to ${roles}`;
  if (p.qual) s += ` using (${p.qual})`;
  if (p.with_check) s += ` with check (${p.with_check})`;
  return s + ';';
}
push('-- 8. RLS policies (public schema)');
const pubPolicies = d.policies.filter((p) => p.schema === 'public');
for (const p of pubPolicies) push(policySql(p, pt(p.table)));
push('');
stats.policies = pubPolicies.length;

// 9. triggers
push('-- 9. triggers');
for (const t of d.triggers) {
  const [schema, name] = String(t.table).includes('.') ? String(t.table).split('.') : ['public', t.table];
  push(`drop trigger if exists "${t.name}" on "${schema}"."${name}";`);
  push(stripSemi(t.def) + ';');
}
push('');
stats.triggers = d.triggers.length;

// 10. storage
push('-- 10. storage buckets and object policies');
for (const b of d.buckets) {
  const mimes = b.allowed_mime_types ? `array[${b.allowed_mime_types.map(lit).join(', ')}]` : 'null';
  push(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (${lit(b.id)}, ${lit(b.name)}, ${b.public ? 'true' : 'false'}, ${b.file_size_limit ?? 'null'}, ${mimes}) on conflict (id) do nothing;`);
}
const storagePolicies = d.policies.filter((p) => p.schema === 'storage');
for (const p of storagePolicies) push(policySql(p, `storage."${p.table}"`));
push('');
stats.buckets = d.buckets.length;
stats.storage_policies = storagePolicies.length;

// 11. cron
push('-- 11. scheduled jobs (pg_cron)');
for (const j of d.cron_jobs || []) {
  if (j.active === false) { push(`-- inactive in production, not recreated: ${j.name}`); continue; }
  push(`select cron.schedule(${lit(j.name)}, ${lit(j.schedule)}, ${dollar('fp_cron', j.command)});`);
}
push('');
stats.cron_jobs = (d.cron_jobs || []).length;

// 12. config seeds (non-secret boolean/number values only)
push('-- 12. app_config seeds (boolean/number values only; strings are never exported)');
for (const a of d.app_config_flags || []) {
  push(`insert into public.app_config (key, value) values (${lit(a.key)}, ${lit(JSON.stringify(a.value))}::jsonb) on conflict (key) do nothing;`);
}
push('');

// ---- self-check against the column export ----------------------------------
const colTables = new Set(parseCsvObjects(fs.readFileSync(path.join(sourceDir, 'production_columns.csv'), 'utf8')).map((r) => r.table_name));
const unknown = [...new Set(d.constraints.map((c) => bare(c.table)).concat(d.tables.map((t) => t.name)))].filter((t) => !colTables.has(t));
if (unknown.length) fail(`export references tables not in production_columns.csv: ${unknown.join(', ')}`);
const withPk = new Set(d.constraints.filter((c) => c.type === 'p').map((c) => bare(c.table)));
const noPk = [...colTables].filter((t) => !withPk.has(t));
if (noPk.length) console.warn('warning: tables without a primary key in the export:', noPk.join(', '));

const header = `-- Section counts: ${Object.entries(stats).map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
const body = sec.join('\n').replace(/^(-- BASELINE[\s\S]*?\n--\n)/, `$1`);
fs.writeFileSync(outFile, body.replace('set check_function_bodies = false;', header + 'set check_function_bodies = false;'));
console.log(`Wrote ${path.relative(root, outFile)} — ${Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', ')}${identityAlways ? `, identity-always: ${identityAlways}` : ''}`);
