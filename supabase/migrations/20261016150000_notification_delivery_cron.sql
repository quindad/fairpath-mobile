-- Real scheduled delivery for notification-delivery-worker and notification-receipt-worker, mirroring
-- resource_scout_invoke_worker's exact proven pattern (20261015110000): a config table holding the secret +
-- worker URL, read inside a SECURITY DEFINER function, invoked via pg_net so the secret never appears in
-- cron.job's visible command text. This closes the real gap from docs/MASTER_TODO_2026-10-13.md: "Push/email/
-- SMS actually sending — the system that should trigger them is built, nothing is actually being sent yet."
-- The worker code itself (supabase/functions/notification-delivery-worker, notification-receipt-worker) was
-- already written and is now deployed; this migration is what actually invokes it on a schedule.
create table if not exists public.notification_worker_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.notification_worker_config enable row level security;
revoke all on table public.notification_worker_config from public, anon, authenticated;
grant select, insert, update on table public.notification_worker_config to service_role;

create or replace function public.notification_invoke_delivery_worker()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from notification_worker_config where key = 'worker_secret';
  select value into v_url from notification_worker_config where key = 'delivery_worker_url';
  if v_secret is null or v_url is null then
    raise notice 'notification_invoke_delivery_worker: notification_worker_config missing worker_secret/delivery_worker_url - skipping';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;
revoke all on function public.notification_invoke_delivery_worker() from public, anon, authenticated;

create or replace function public.notification_invoke_receipt_worker()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_url text;
begin
  select value into v_secret from notification_worker_config where key = 'worker_secret';
  select value into v_url from notification_worker_config where key = 'receipt_worker_url';
  if v_secret is null or v_url is null then
    raise notice 'notification_invoke_receipt_worker: notification_worker_config missing worker_secret/receipt_worker_url - skipping';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;
revoke all on function public.notification_invoke_receipt_worker() from public, anon, authenticated;

select cron.schedule('fairpath-notification-delivery', '* * * * *', 'select public.notification_invoke_delivery_worker()');
select cron.schedule('fairpath-notification-receipts', '*/5 * * * *', 'select public.notification_invoke_receipt_worker()');
