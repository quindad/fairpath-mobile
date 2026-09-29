-- DEV-ONLY cleanup: removes the fictional TEST lifecycle market and everything it produced, now that the real
-- bug it surfaced (20261003130000) is fixed and proven. The fix itself is permanent; this only undoes the
-- disposable test artifacts (market, grant, notification, enrollment state) so the real DEV member this ran
-- against is left clean for future testing, same spirit as the Record Relief TEST fixture reset pattern.
do $$
declare
  mkt_id uuid;
begin
  select id into mkt_id from public.coverage_markets where code = 'test-lifecycle-market';
  if mkt_id is null then return; end if;

  -- revoke the grant this test issued (audited, not deleted)
  perform public.revoke_entitlement_grant(g.id, 'dev-lifecycle-test-cleanup', 'DEV lifecycle test cleanup: TEST market removed')
    from public.entitlement_grants g
   where g.source_type = 'early_access_market' and g.source_ref = 'test-lifecycle-market';

  -- remove the notification this test created
  delete from public.user_notifications where dedupe_key like 'market_activated:test-lifecycle-market:%';

  -- put the real member's enrollment back to a clean waitlisted state, unlinked from the removed test market
  update public.market_waitlist_enrollments
     set status = 'waitlisted', converted_at = null, entitlement_grant_id = null, market_id = null, updated_at = now()
   where market_id = mkt_id;

  delete from public.coverage_markets where id = mkt_id;
end $$;
