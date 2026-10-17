-- Expo ticket receipts are distinct from ticket acceptance; service-only storage.
create table if not exists public.notification_push_receipts (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null references public.notification_deliveries(id) on delete cascade,
 token text not null,
 ticket_id text not null unique,
 status text not null default 'pending' check (status in ('pending','ok','error')),
 error_code text,
 error_message text,
 created_at timestamptz not null default now(),
 checked_at timestamptz
);
create index if not exists notification_push_receipts_pending_idx
 on public.notification_push_receipts (created_at) where status='pending';
-- A previously accepted Expo ticket must never be re-sent after a worker crash.
-- A separate receipt worker resolves provider outcomes for accepted tickets.
create or replace function public.notification_delivery_has_ticket(p_delivery_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.notification_push_receipts where delivery_id=p_delivery_id) $$;
revoke all on function public.notification_delivery_has_ticket(uuid) from public,anon,authenticated;
grant execute on function public.notification_delivery_has_ticket(uuid) to service_role;
alter table public.notification_push_receipts enable row level security;
revoke all on public.notification_push_receipts from public, anon, authenticated;
grant select,insert,update,delete on public.notification_push_receipts to service_role;
