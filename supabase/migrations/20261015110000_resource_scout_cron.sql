-- Real daily cron trigger for resource-scout-worker, mirroring program_scout_invoke_worker's exact pattern
-- (config table holding the secret + worker URL, read inside a SECURITY DEFINER function, invoked via
-- pg_net so the secret never appears directly in cron.job's visible command text).

create table if not exists public.resource_scout_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.resource_scout_config enable row level security;
revoke all on table public.resource_scout_config from public, anon, authenticated;
grant select, insert, update on table public.resource_scout_config to service_role;

create or replace function public.resource_scout_invoke_worker()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from resource_scout_config where key = 'integration_secret';
  select value into v_url from resource_scout_config where key = 'worker_url';
  if v_secret is null or v_url is null then
    raise notice 'resource_scout_invoke_worker: resource_scout_config missing integration_secret/worker_url - skipping';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-fairpath-integration-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.resource_scout_invoke_worker() from public, anon, authenticated;

select cron.schedule('resource-scout-daily-sweep', '0 10 * * *', 'select public.resource_scout_invoke_worker()');
