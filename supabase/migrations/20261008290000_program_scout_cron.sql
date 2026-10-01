-- Wires the existing pg_cron pattern (already used for fairpath-entitlement-reminders) to the Program Scout
-- worker via pg_net. Runs hourly and, because the worker itself caps at 3 due sources per invocation and
-- respects each source's check_cadence/next_check_at, this is conservative by construction - it will not re-hit
-- a source before its cadence says it's due, and with only 2 real sources registered today, most invocations
-- will find nothing due and do nothing. The integration secret is read from Postgres settings (set via
-- `alter database ... set app.program_scout_secret = '...'`), never hardcoded into the migration - the secret
-- used here is for DEV cron wiring only and is rotated independently of the Edge Function's own copy if needed.
create extension if not exists pg_net with schema extensions;

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
  v_secret := current_setting('app.program_scout_secret', true);
  v_url := current_setting('app.program_scout_worker_url', true);
  if v_secret is null or v_url is null then
    raise notice 'program_scout_invoke_worker: app.program_scout_secret or app.program_scout_worker_url not set - skipping (cron wiring present, not yet configured with live values)';
    return;
  end if;
  perform extensions.net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-fairpath-integration-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.program_scout_invoke_worker() from public, anon, authenticated;

select cron.schedule('program-scout-hourly-sweep', '0 * * * *', 'select public.program_scout_invoke_worker()');
