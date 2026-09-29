-- DEV-ONLY: seeds one fictional coverage market to prove the Early Access lifecycle end to end on the real DEV
-- database, including the part that could not be exercised from the client (coverage activation + entitlement
-- grant firing), which needs a service-role call this session has no REST key for. Migrations run as the database
-- owner via the Supabase CLI's already-authenticated project link, so this is the correct path, not a workaround.
--
-- Fictional, clearly TEST-labeled data (same pattern as the Record Relief TEST fixtures), applied only via an
-- explicit `supabase db push` against the DEV-linked project — this repo's migrations are never applied to
-- production by any automated path. Matches the ZIP (99999) a real disposable DEV member already enrolled in earlier this session, via the real
-- client-side join_early_access() RPC (not seeded) — so activating this market exercises a genuine, pre-existing
-- enrollment, not a fixture I also created.
select public.upsert_coverage_market(
  'test-lifecycle-market', 'Testland Lifecycle Market (TEST DATA)', array['99999'], 'waitlist', 60,
  'TEST DATA — DEV lifecycle verification only, not a real market.'
);
