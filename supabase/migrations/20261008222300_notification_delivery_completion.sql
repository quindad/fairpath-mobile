-- Notification preferences and safe service-only delivery claims.
create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 push_enabled boolean not null default false,
 marketing_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
grant select on public.notification_preferences to authenticated;
grant select,insert,update,delete on public.notification_preferences to service_role;
create policy notification_preferences_own_read on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()));
create or replace function public.get_notification_preferences()
returns table(push_enabled boolean, marketing_enabled boolean)
language sql stable security definer set search_path = public
as $$ select coalesce((select p.push_enabled from public.notification_preferences p where p.user_id=auth.uid()),false),
coalesce((select p.marketing_enabled from public.notification_preferences p where p.user_id=auth.uid()),false) $$;
revoke all on function public.get_notification_preferences() from public,anon;
grant execute on function public.get_notification_preferences() to authenticated;
create or replace function public.set_notification_preferences(p_push boolean,p_marketing boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
 insert into public.notification_preferences(user_id,push_enabled,marketing_enabled)
 values(auth.uid(),coalesce(p_push,false),coalesce(p_marketing,false))
 on conflict(user_id) do update set push_enabled=excluded.push_enabled,marketing_enabled=excluded.marketing_enabled,updated_at=now();
end $$;
revoke all on function public.set_notification_preferences(boolean,boolean) from public,anon;
grant execute on function public.set_notification_preferences(boolean,boolean) to authenticated;
create or replace function public.unregister_push_token(p_token text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
 update public.push_tokens set disabled_at=now() where user_id=auth.uid() and disabled_at is null and (p_token is null or token=p_token);
end $$;
revoke all on function public.unregister_push_token(text) from public,anon;
grant execute on function public.unregister_push_token(text) to authenticated;
alter table public.notification_deliveries add column if not exists next_attempt_at timestamptz not null default now();
create or replace function public.claim_notification_deliveries(p_limit integer default 10)
returns table(delivery_id uuid,notification_id uuid,tokens text[])
language plpgsql security definer set search_path=public as $$
begin
 -- Access controlled by EXECUTE grants; migration owner may invoke directly.
 return query
 with picked as (
  select d.id,d.notification_id,n.user_id from public.notification_deliveries d
  join public.user_notifications n on n.id=d.notification_id
  join public.notification_preferences p on p.user_id=n.user_id and p.push_enabled
   and (coalesce(n.category,'') not in ('marketing','promotion','promotional') or p.marketing_enabled)
  where d.channel='push' and d.status='pending' and d.next_attempt_at<=now()
   and exists(select 1 from public.push_tokens t where t.user_id=n.user_id and t.disabled_at is null)
  order by d.created_at for update of d skip locked limit greatest(0,least(coalesce(p_limit,10),100))
 ), updated as (
  update public.notification_deliveries d set attempts=d.attempts+1,next_attempt_at=now()+interval '15 minutes'
  from picked where d.id=picked.id returning d.id,d.notification_id,picked.user_id
 )
 select u.id,u.notification_id,array(select t.token from public.push_tokens t where t.user_id=u.user_id and t.disabled_at is null order by t.created_at)
 from updated u;
end $$;
revoke all on function public.claim_notification_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;
create or replace function public.complete_notification_delivery(p_id uuid,p_status text,p_message text default null,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 -- Access controlled by EXECUTE grants; migration owner may invoke directly.
 if p_status not in ('sent','failed','skipped') then raise exception 'INVALID_STATUS'; end if;
 update public.notification_deliveries set
 status=case when p_status='failed' and attempts<5 then 'pending' else p_status end,
 provider_message_id=case when p_status='sent' then p_message else null end,
 error=case when p_status='failed' then left(coalesce(p_error,'delivery failed'),500) else null end,
 next_attempt_at=case when p_status='failed' then now()+make_interval(mins=>least(60,5*greatest(attempts,1))) else next_attempt_at end,
 sent_at=case when p_status='sent' then now() else sent_at end
 where id=p_id;
end $$;
revoke all on function public.complete_notification_delivery(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_notification_delivery(uuid,text,text,text) to service_role;
