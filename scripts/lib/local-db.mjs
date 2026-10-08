// Local Postgres (PGlite, real Postgres compiled to WASM) for testing FairPath migrations, RLS and SQL functions
// WITHOUT touching any Supabase project. This is the fast inner loop: it applies the real migration files in order
// over a small Supabase-compatible stub (auth.users, auth.uid(), anon/authenticated/service_role, storage tables).
//
// It is NOT a substitute for the DEV harnesses (Auth, Edge Functions and storage behave differently there), but it
// executes the actual SQL and the actual grants/policies, so most schema/RLS/function mistakes are caught before a push.
//
// PGlite is not a repo dependency (keeps package.json/production installs lean). Install once, outside the repo:
//   mkdir %TEMP%\fp-pglite && cd %TEMP%\fp-pglite && npm init -y && npm i @electric-sql/pglite
// or point PGLITE_PATH at any install of @electric-sql/pglite.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STUB = `
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create schema if not exists cron;
create schema if not exists net;
create table if not exists cron.job (
  jobid bigint generated always as identity primary key,
  jobname text unique not null,
  schedule text not null,
  command text not null
);
create or replace function cron.schedule(name text, schedule text, command text) returns bigint language plpgsql as $f$
declare id bigint;
begin
  insert into cron.job(jobname, schedule, command) values(name, schedule, command)
  on conflict(jobname) do update set schedule=excluded.schedule, command=excluded.command
  returning jobid into id;
  return id;
end $f$;
create or replace function cron.unschedule(name text) returns boolean language plpgsql as $f$
declare removed boolean;
begin
  delete from cron.job where jobname=name;
  get diagnostics removed = row_count;
  return removed;
end $f$;
create or replace function net.http_post(url text, headers jsonb default '{}'::jsonb, body jsonb default '{}'::jsonb)
returns bigint language sql as $f$ select 1::bigint $f$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  email_confirmed_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $f$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$f$;
create or replace function auth.role() returns text language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$f$;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on all tables in schema storage to service_role;
grant select on storage.buckets to anon, authenticated, service_role;
-- Supabase grants table privileges to app roles and relies on RLS policies to restrict them.
grant select, insert, update, delete on storage.objects to authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $f$
  select string_to_array(name, '/')
$f$;
`;

export async function loadPglite() {
  const candidates = [process.env.PGLITE_PATH, path.join(os.tmpdir(), 'fp-pglite', 'node_modules', '@electric-sql', 'pglite')].filter(Boolean);
  for (const c of candidates) {
    const entry = path.join(c, 'dist', 'index.js');
    if (fs.existsSync(entry)) return import(pathToFileURL(entry).href);
  }
  throw new Error('PGlite not found. Install it outside the repo: mkdir %TEMP%\\fp-pglite && cd %TEMP%\\fp-pglite && npm init -y && npm i @electric-sql/pglite');
}

/** Applies every migration (baseline first) in filename order. Returns { db, errors }. */
export async function createLocalDb({ migrationsDir = 'supabase/migrations', upTo = null, quiet = true } = {}) {
  const { PGlite } = await loadPglite();
  const db = new PGlite();
  await db.exec(STUB);
  const errors = [];
  const skipped = [];
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (upTo && f > upTo) break;
    // This migration proves a DEV Edge Function produced an event. A local SQL runner cannot execute that
    // worker and must not fabricate its output. DEV/live QA owns this one proof; all schema around it still runs.
    if (f === '20261008250000_verify_change_detection_strict.sql') {
      skipped.push({ file: f, reason: 'hosted worker evidence; verified only against DEV' });
      if (!quiet) console.log('skipped ' + f + ': hosted worker evidence; verified only against DEV');
      continue;
    }
    // pg_cron and pg_net are hosted-Supabase extensions. STUB supplies their signatures and a durable cron.job
    // catalog so migrations and verification queries exercise real SQL behavior without network side effects.
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/create extension if not exists pg_cron[^;]*;/g, '')
      .replace(/create extension if not exists pg_net[^;]*;/g, '');
    try {
      await db.exec(sql);
      if (!quiet) console.log('applied ' + f);
    } catch (e) {
      errors.push({ file: f, message: e.message });
      if (!quiet) console.log('FAILED  ' + f + ': ' + e.message);
    }
  }
  return { db, errors, skipped };
}

/** Runs `fn` as an authenticated member / anon guest / service role (RLS + grants really apply). */
export async function asRole(db, who, fn) {
  const [role, sub] = who === 'anon' ? ['anon', ''] : who === 'service' ? ['service_role', ''] : ['authenticated', who];
  const claims = JSON.stringify({ sub, role, email: sub ? sub + '@test.local' : null }).split("'").join("''");
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claim.role', '${role}', false); select set_config('request.jwt.claims', '${claims}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

export async function addUser(db, email, accountType = 'member') {
  const r = await db.query('insert into auth.users (email) values ($1) returning id', [email]);
  const id = r.rows[0].id;
  // handle_new_user normally creates the profile; make sure one exists whichever way the trigger behaves locally.
  await db.query(`insert into public.profiles (id, account_type) values ($1, $2) on conflict (id) do nothing`, [id, accountType]);
  return id;
}

/** Executes a statement as `who` and returns { rows } or { error } (never throws) - convenient for security assertions. */
export async function tryAs(db, who, sql, params = []) {
  try {
    const r = await asRole(db, who, () => db.query(sql, params));
    return { rows: r.rows };
  } catch (e) {
    return { error: e.message };
  }
}
