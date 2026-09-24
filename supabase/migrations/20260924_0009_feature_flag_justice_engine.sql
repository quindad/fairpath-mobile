-- Step 1 Canonical Profile: gate the (future, Step 2) justice-history
-- eligibility engine behind a feature flag.
--
-- Sterling decision #1: the taxonomy remains provisional; production
-- eligibility decisions stay feature-gated pending legal review. This
-- flag defaults false and must be explicitly flipped only after that
-- review clears — nothing in Step 1 or Step 2 should ever flip it
-- programmatically.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

insert into public.feature_flags (key, enabled, description) values
  ('justice_eligibility_engine_enabled', false,
   'Gates production use of the provisional 9-category offense taxonomy and any justice-history eligibility matching (evaluate_justice_eligibility RPC, planned Step 2). Must stay false until formal legal/domain review approves the taxonomy. Flip manually via SQL/Studio only, never programmatically.')
on conflict (key) do nothing;
