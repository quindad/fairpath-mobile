-- ============================================================================
-- READ-ONLY EXPORT of production's schema DEFINITIONS (no user data).
--
-- Run this in the SQL Editor of the PRODUCTION project (fairpath-mobile,
-- ref rqpczemdagoddhuwefxt). It is a single SELECT: it creates nothing,
-- changes nothing, and reads only catalog metadata (pg_catalog,
-- storage.buckets, cron.job) plus non-secret numeric/boolean app_config values.
--
-- It returns ONE row with ONE column ("definitions") containing JSON.
--   1. Run it.
--   2. Click "Download CSV" on the result (or use "Copy cell").
--   3. Save the file as:  supabase/baseline/source/production_definitions.csv
--      (a .json file containing just the cell value also works).
--
-- Feeds: supabase/baseline/generate-baseline-logic.mjs, which writes
-- supabase/migrations/20260901000100_baseline_constraints_security_logic.sql
--
-- If Postgres reports  relation "cron.job" does not exist,  delete the
-- 'cron_jobs' block below and re-run (pg_cron is not installed in that case).
-- ============================================================================
select jsonb_build_object(
  'exported_at', now(),
  'server_version', current_setting('server_version'),

  'extensions', (
    select coalesce(jsonb_agg(jsonb_build_object('name', e.extname, 'schema', n.nspname, 'version', e.extversion) order by e.extname), '[]'::jsonb)
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  ),

  -- PRIMARY KEY / UNIQUE / CHECK / FOREIGN KEY, exact definitions incl. ON DELETE rules
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.conrelid::regclass::text,
      'name', c.conname,
      'type', c.contype,
      'def', pg_get_constraintdef(c.oid)
    ) order by c.conrelid::regclass::text, c.contype, c.conname), '[]'::jsonb)
    from pg_constraint c
    where c.connamespace = 'public'::regnamespace
      and c.contype in ('p', 'u', 'c', 'f', 'x')
      and c.conrelid <> 0
  ),

  -- Indexes that do NOT back a constraint
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_object('table', i.tablename, 'name', i.indexname, 'def', i.indexdef) order by i.tablename, i.indexname), '[]'::jsonb)
    from pg_indexes i
    where i.schemaname = 'public'
      and not exists (select 1 from pg_constraint c where c.conname = i.indexname and c.connamespace = 'public'::regnamespace)
  ),

  -- Row Level Security flags and table privileges (ACLs)
  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity,
      'acl', c.relacl::text[]
    ) order by c.relname), '[]'::jsonb)
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  ),

  -- Identity columns (e.g. product_events.id): 'a' = always, 'd' = by default
  'identity_columns', (
    select coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'column', a.attname, 'kind', a.attidentity::text)), '[]'::jsonb)
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and a.attidentity in ('a', 'd') and not a.attisdropped
  ),

  'views', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', v.viewname,
      'def', v.definition,
      'options', (select c.reloptions::text[] from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname = v.viewname)
    ) order by v.viewname), '[]'::jsonb)
    from pg_views v where v.schemaname = 'public'
  ),

  -- RLS policies for the public schema AND storage (buckets' object policies)
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', p.schemaname, 'table', p.tablename, 'name', p.policyname,
      'permissive', p.permissive, 'roles', p.roles, 'cmd', p.cmd,
      'qual', p.qual, 'with_check', p.with_check
    ) order by p.schemaname, p.tablename, p.policyname), '[]'::jsonb)
    from pg_policies p where p.schemaname in ('public', 'storage')
  ),

  -- Functions / RPCs / trigger functions in public (bodies, security definer, search_path, ACLs)
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'signature', p.oid::regprocedure::text,
      'def', pg_get_functiondef(p.oid),
      'acl', p.proacl::text[]
    ) order by p.proname, p.oid::regprocedure::text), '[]'::jsonb)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ),

  -- Triggers on public tables, plus any on auth.users (e.g. profile auto-creation)
  'triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', n.nspname || '.' || c.relname,
      'name', t.tgname,
      'def', pg_get_triggerdef(t.oid)
    ) order by n.nspname, c.relname, t.tgname), '[]'::jsonb)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
  ),

  'buckets', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'public', b.public,
      'file_size_limit', b.file_size_limit, 'allowed_mime_types', b.allowed_mime_types
    ) order by b.id), '[]'::jsonb)
    from storage.buckets b
  ),

  'cron_jobs', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', j.jobname, 'schedule', j.schedule, 'command', j.command, 'active', j.active
    ) order by j.jobname), '[]'::jsonb)
    from cron.job j
  ),

  -- Only NON-string config values (booleans/numbers) so no secret can be exported.
  'app_config_flags', (
    select coalesce(jsonb_agg(jsonb_build_object('key', a.key, 'value', a.value) order by a.key), '[]'::jsonb)
    from public.app_config a
    where jsonb_typeof(a.value) in ('boolean', 'number')
  )
) as definitions;
