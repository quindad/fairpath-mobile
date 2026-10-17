-- Real bug found during tonight's Credit Builder audit: 'resolved' was a first-class dispute status (its own
-- label in credit-format.ts, its own type in credit-service.ts) but could never actually be set. The CASE
-- expression checked `when p_close then 'closed'` FIRST, which already matches whenever p_close is true -- the
-- second branch `when x.status='response_received' and x.outcome is not null and p_close then 'resolved'`
-- required p_close too, so it was unreachable dead code. Every dispute a member closed after getting a response
-- went straight to 'closed', never 'resolved', even when the bureau's outcome was a real win (removed/corrected).
-- Fix: check the resolved condition first, fall back to closed. Same external signature, no other change.
create or replace function public.update_credit_dispute(p_id uuid, p_follow_up_on date default null, p_notes text default null, p_close boolean default false)
returns public.credit_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.credit_disputes%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  update public.credit_disputes x set
    follow_up_on = coalesce(p_follow_up_on, x.follow_up_on),
    notes = case when p_notes is null then x.notes else nullif(left(btrim(p_notes), 1500), '') end,
    status = case
      when p_close and x.status = 'response_received' and x.outcome is not null then 'resolved'
      when p_close then 'closed'
      else x.status end,
    updated_at = now()
  where x.id = p_id and x.user_id = uid returning * into d;
  if not found then raise exception 'DISPUTE_UNAVAILABLE'; end if;
  insert into public.credit_dispute_events (dispute_id, user_id, event_type) values (d.id, uid, case when p_close then 'closed' when p_follow_up_on is not null then 'follow_up_set' else 'notes_updated' end);
  return d;
end;
$$;
