-- Coordinate delivery-level scheduling with per-token retry state.
-- LOCAL ONLY: review migration history before applying to DEV.
create or replace function public.complete_notification_delivery(
 p_id uuid,p_status text,p_message text default null,p_error text default null
) returns void language plpgsql security definer set search_path=public as $$
declare
 v_attempts integer;
 v_pending_due timestamptz;
 v_has_failed boolean;
begin
 if p_status not in ('sent','failed','skipped') then raise exception 'INVALID_STATUS'; end if;
 select attempts into v_attempts from public.notification_deliveries where id=p_id for update;
 if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
 if p_status='failed' then
  select min(a.next_attempt_at) filter (where a.status='pending'),
         coalesce(bool_or(a.status='failed'),false)
  into v_pending_due,v_has_failed
  from public.notification_token_attempts a where a.delivery_id=p_id;
 end if;
 update public.notification_deliveries set
  status=case
   when p_status='failed' and v_pending_due is not null then 'pending'
   when p_status='failed' and v_has_failed then 'failed'
   when p_status='failed' and v_attempts<5 then 'pending'
   else p_status end,
  provider_message_id=case when p_status='sent' then p_message else null end,
  error=case when p_status='failed' then left(coalesce(p_error,'delivery failed'),500) else null end,
  next_attempt_at=case when p_status='failed' then
   coalesce(v_pending_due,now()+make_interval(mins=>least(60,5*greatest(v_attempts,1))))
   else next_attempt_at end,
  sent_at=case when p_status='sent' then now() else sent_at end
 where id=p_id;
end $$;
revoke all on function public.complete_notification_delivery(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_notification_delivery(uuid,text,text,text) to service_role;
