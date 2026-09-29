-- Real Home/Me cohesion gap found this session: member_summary_core() (the function behind Home's readiness/status
-- display and Me's tile counts) has no idea Marketplace or Meetings exist at all - no 'marketplace' or 'meetings'
-- key anywhere in its output, despite the function's own documented extension pattern ("Later modules (credit,
-- record relief, ...) add member_summary_<module>(uuid) returns jsonb; they are merged in when they exist") being
-- built exactly for this. Marketplace is explicitly V1 scope; Meetings has been live all session. Neither was ever
-- wired in.
--
-- Purely additive: two new member_summary_<module> functions following the EXACT existing pattern (read from
-- member_summary_credit() in 20261001160000_credit_workspace.sql before writing this), plus get_member_home_summary()
-- rewritten identically to its current definition except the extension array now includes both new module names.

create or replace function public.member_summary_marketplace(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_claims', (select count(*) from public.marketplace_claims c where c.claimant_id = p_user and c.status in ('requested', 'approved', 'ready')),
    'ready_for_pickup', (select count(*) from public.marketplace_claims c where c.claimant_id = p_user and c.status = 'ready'),
    'pending_requests_on_my_items', (select count(*) from public.marketplace_claims c join public.marketplace_items i on i.id = c.item_id where i.seller_id = p_user and c.status = 'requested'),
    'active_listings', (select count(*) from public.marketplace_items i where i.seller_id = p_user and i.status in ('available', 'pending_pickup')));
$$;
revoke all on function public.member_summary_marketplace(uuid) from public, anon, authenticated;
grant execute on function public.member_summary_marketplace(uuid) to service_role;

create or replace function public.member_summary_meetings(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'upcoming', (select count(*) from public.member_meetings m where m.user_id = p_user and m.start_at >= now() and m.status not in ('cancelled', 'no_show')),
    'next_start_at', (select min(m.start_at) from public.member_meetings m where m.user_id = p_user and m.start_at >= now() and m.status not in ('cancelled', 'no_show')));
$$;
revoke all on function public.member_summary_meetings(uuid) from public, anon, authenticated;
grant execute on function public.member_summary_meetings(uuid) to service_role;

-- Identical to the existing get_member_home_summary() except the extension array now also checks for
-- 'marketplace' and 'meetings' (a to_regprocedure existence check per entry, exactly as already written -
-- neither new function name changes any existing behavior for jurisdictions/modules that don't have one).
create or replace function public.get_member_home_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
  ext text;
  part jsonb;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  res := public.member_summary_core(uid);
  foreach ext in array array['credit', 'record_relief', 'marketplace', 'meetings'] loop
    if to_regprocedure('public.member_summary_' || ext || '(uuid)') is not null then
      execute format('select public.member_summary_%s($1)', ext) into part using uid;
      res := res || jsonb_build_object(ext, coalesce(part, '{}'::jsonb));
    end if;
  end loop;
  return res;
end;
$$;
revoke all on function public.get_member_home_summary() from public, anon;
grant execute on function public.get_member_home_summary() to authenticated, service_role;
