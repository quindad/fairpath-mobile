-- Real bug found while proving the notification delivery pipeline end to end tonight: this function's
-- `returns table(token text)` creates an implicit PL/pgSQL OUT variable named `token`, which collides with the
-- unqualified `token` in `on conflict(delivery_id,token)` -- ON CONFLICT's column-list form cannot be table-
-- qualified, so plpgsql's variable shadowing wins and raises 42702 "column reference token is ambiguous" on
-- every call. Fixed by switching to `on conflict on constraint <pkey>`, which sidesteps the column-list syntax
-- entirely. No other change; same two other statements in the function body were already correctly qualified.
create or replace function public.prepare_notification_token_attempts(p_delivery_id uuid,p_tokens text[])
returns table(token text) language plpgsql security definer set search_path=public as $$
begin
 insert into public.notification_token_attempts(delivery_id,token)
 select p_delivery_id,t from unnest(p_tokens) t where t is not null
 on conflict on constraint notification_token_attempts_pkey do nothing;
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
