-- ALTER DATABASE SET for custom app.* settings requires superuser, which migrations don't have on Supabase's
-- managed Postgres (confirmed by a real permission-denied error). A small service-role-only config table is the
-- correct substitute - still never readable by authenticated/anon, still never committed with a real value in
-- git (the value-setting migration is applied then deleted, same as the GUC approach would have been).
create table public.program_scout_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.program_scout_config enable row level security;
revoke all on table public.program_scout_config from public, anon, authenticated;
grant select, insert, update, delete on table public.program_scout_config to service_role;

create or replace function public.program_scout_invoke_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from program_scout_config where key = 'integration_secret';
  select value into v_url from program_scout_config where key = 'worker_url';
  if v_secret is null or v_url is null then
    raise notice 'program_scout_invoke_worker: program_scout_config missing integration_secret/worker_url - skipping (cron wiring present, not yet configured with live values)';
    return;
  end if;
  perform extensions.net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-fairpath-integration-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;
