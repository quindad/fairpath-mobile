-- Fixes a real bug found via a full DEV lifecycle test: activate_coverage_market() only matched enrollments
-- already stamped with market_id = this market. But join_early_access() resolves market_id ONCE, at enroll time
-- — if no market was configured yet for that ZIP, market_id is stored as NULL forever. The realistic product
-- scenario is exactly this: a member joins a waitlist for a ZIP with no market configured yet, and MONTHS LATER
-- FairPath configures and activates that market. Under the old code, that member's grant never fires, because
-- their enrollment row was never linked to the market that didn't exist when they joined.
--
-- Proven on real DEV before this fix: seeded a fictional TEST market matching a ZIP a real disposable member had
-- already enrolled in earlier in this project, activated it, and confirmed via /plus that the member's FairPath+
-- status stayed on the free plan — the grant never fired. This migration fixes activate_coverage_market to match
-- by ZIP-PREFIX MEMBERSHIP at activation time (recomputing longest-prefix-wins, same logic as
-- get_market_coverage/join_early_access) instead of trusting the enroll-time snapshot, and backfills market_id
-- on any rows it catches this way so the data stays consistent going forward.
create or replace function public.activate_coverage_market(p_market_code text, p_new_status text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mkt public.coverage_markets%rowtype;
  enrollment record;
  granted_count integer := 0;
  notified_count integer := 0;
  grant_id uuid;
  best_len integer;
begin
  if p_new_status not in ('full', 'growing', 'limited') then raise exception 'INVALID_STATUS' using errcode = 'P0001'; end if;
  select * into mkt from public.coverage_markets where code = p_market_code;
  if not found then raise exception 'MARKET_NOT_FOUND' using errcode = 'P0001'; end if;

  update public.coverage_markets
     set status = p_new_status, activated_at = coalesce(activated_at, now()), updated_at = now()
   where id = mkt.id;

  -- Match by ZIP-prefix membership at activation time, not by a possibly-stale market_id snapshot from enroll
  -- time. This catches every waitlisted enrollment whose ZIP falls under this market's zip_prefixes, whether it
  -- was linked at enroll time or is only now resolvable because this market didn't exist back then.
  for enrollment in
    select e.* from public.market_waitlist_enrollments e
     where e.status = 'waitlisted'
       and (
         e.market_id = mkt.id
         or exists (select 1 from unnest(mkt.zip_prefixes) as prefix where left(e.zip, length(prefix)) = prefix)
       )
  loop
    -- longest-prefix-wins: skip if a DIFFERENT, more specific market also matches this ZIP (that market should
    -- claim this enrollment instead, not this one)
    best_len := -1;
    if exists (
      select 1 from public.coverage_markets m2, unnest(m2.zip_prefixes) as p2
       where m2.id <> mkt.id and left(enrollment.zip, length(p2)) = p2 and length(p2) > (
         select coalesce(max(length(p1)), -1) from unnest(mkt.zip_prefixes) as p1 where left(enrollment.zip, length(p1)) = p1
       )
    ) then
      continue;
    end if;

    grant_id := null;
    if mkt.early_access_benefit_days is not null then
      grant_id := public.issue_entitlement_grant(
        enrollment.user_id, 'early_access_market', mkt.code, 'eam:' || mkt.code || ':' || enrollment.user_id::text,
        mkt.early_access_benefit_days, null, 'Early Access benefit for ' || mkt.label || ' reaching coverage');
      granted_count := granted_count + 1;
    end if;

    update public.market_waitlist_enrollments
       set status = 'converted', converted_at = now(), entitlement_grant_id = grant_id, market_id = mkt.id, updated_at = now()
     where id = enrollment.id;

    if enrollment.notification_consent then
      if public.create_notification(
           enrollment.user_id, 'coverage', mkt.label || ' is now live on FairPath',
           case when mkt.early_access_benefit_days is not null
             then 'Opportunities are available in your area, and your ' || mkt.early_access_benefit_days || '-day FairPath+ Early Access benefit is active.'
             else 'Opportunities are now available in your area.' end,
           '/find-jobs', 'market_activated:' || mkt.code || ':' || enrollment.user_id::text, 'coverage_market', mkt.id,
           jsonb_build_object('market_code', mkt.code)) is not null then
        notified_count := notified_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('market_code', mkt.code, 'status', p_new_status, 'grants_issued', granted_count, 'members_notified', notified_count);
end;
$$;
revoke all on function public.activate_coverage_market(text, text, text) from public, anon, authenticated;
grant execute on function public.activate_coverage_market(text, text, text) to service_role;
