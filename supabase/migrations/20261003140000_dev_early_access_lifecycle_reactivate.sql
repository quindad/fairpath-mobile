-- DEV-ONLY: re-runs activation for the fictional TEST lifecycle market now that the late-bound-enrollment fix
-- (20261003130000) is live, to prove on real DEV that the previously-missed enrollment now correctly gets its
-- grant. The first activation (20261003120000) ran under the buggy version and found zero matches.
select public.activate_coverage_market('test-lifecycle-market', 'full', 'dev-lifecycle-test');
