-- DEV-ONLY: activates the fictional TEST lifecycle market seeded in 20261003110000, to prove on real DEV whether
-- a member who enrolled BEFORE the market existed (market_id was null at enroll time) still receives the grant
-- when the market later activates. This is the real-world scenario ("member waits months, then FairPath
-- launches") and needs to work, not just the case where enroll and activate happen in the same test run.
select public.activate_coverage_market('test-lifecycle-market', 'full', 'dev-lifecycle-test');
