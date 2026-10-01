-- Bug fix: extensions.net.http_post is invalid (cross-database/cross-schema reference error) - pg_net creates
-- its own `net` schema regardless of the extension's declared schema; the earlier manual verification call
-- that worked used `net.http_post` directly, proving this is the correct reference.
create or replace function public.program_scout_invoke_worker()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from program_scout_config where key = 'integration_secret';
  select value into v_url from program_scout_config where key = 'worker_url';
  if v_secret is null or v_url is null then
    raise notice 'program_scout_invoke_worker: program_scout_config missing integration_secret/worker_url - skipping';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-fairpath-integration-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;
