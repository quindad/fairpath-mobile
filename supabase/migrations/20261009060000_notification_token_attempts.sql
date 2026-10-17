-- Per-device push attempt state prevents a partial Expo rejection from losing other recipients.
create table if not exists public.notification_token_attempts (
 delivery_id uuid not null references public.notification_deliveries(id) on delete cascade,
 token text not null,
 status text not null default 'pending' check (status in ('pending','accepted','dead','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 last_error text,
 updated_at timestamptz not null default now(),
 primary key (delivery_id,token)
);
create index if not exists notification_token_attempts_due_idx on public.notification_token_attempts(next_attempt_at) where status='pending';
alter table public.notification_token_attempts enable row level security;
revoke all on public.notification_token_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.notification_token_attempts to service_role;
create or replace function public.prepare_notification_token_attempts(p_delivery_id uuid,p_tokens text[])
returns table(token text) language plpgsql security definer set search_path=public as $$
begin
 insert into public.notification_token_attempts(delivery_id,token)
 select p_delivery_id,t from unnest(p_tokens) t where t is not null
 on conflict(delivery_id,token) do nothing;
 update public.notification_token_attempts a
 set status='failed', updated_at=now(), last_error='Retry limit reached'
 where a.delivery_id=p_delivery_id and a.status='pending' and a.attempts>=5 and a.next_attempt_at<=now();
 return query with claimed as (
 update public.notification_token_attempts a
 set attempts=a.attempts+1, next_attempt_at=now()+interval '15 minutes',updated_at=now()
 where a.delivery_id=p_delivery_id and a.status='pending' and a.attempts<5 and a.next_attempt_at<=now()
 returning a.token
 ) select claimed.token from claimed order by claimed.token;
end $$;
revoke all on function public.prepare_notification_token_attempts(uuid,text[]) from public,anon,authenticated;
grant execute on function public.prepare_notification_token_attempts(uuid,text[]) to service_role;
