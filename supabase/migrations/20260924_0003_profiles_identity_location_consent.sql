-- Step 1 Canonical Profile: additive columns on profiles.
--
-- All new columns are nullable except search_radius_miles, which is
-- NOT NULL with a constant DEFAULT (a fast, safe metadata-only
-- operation on Postgres 11+, even on a non-empty table). Zero risk to
-- existing rows.
--
-- zip_code / search_radius_miles are intentionally NOT required here:
-- per Sterling decision #7, ZIP/radius stays part of progressive
-- onboarding, never account creation. The location-setup UI (Step 1
-- code follow-up) is what prompts for them later; enforcing them as a
-- gate before location-based Jobs/Housing search is Step 2/3 work
-- (the shared search RPC), not this migration.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists date_of_birth date,
  add column if not exists zip_code text,
  add column if not exists search_radius_miles smallint not null default 25
    check (search_radius_miles > 0),
  add column if not exists location_captured_at timestamptz,
  add column if not exists terms_accepted_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_version text,
  add column if not exists privacy_accepted_at timestamptz;

comment on column public.profiles.phone is
  'Canonical phone. Dual-written from profile_answers[identity.phone] during Step 1; profile_answers keeps receiving writes too so existing direct readers (jobs-service/housing-service autofill) stay correct until they are cut over in a later pass.';
comment on column public.profiles.date_of_birth is
  'Canonical DOB (real date type). Dual-written from profile_answers[identity.date_of_birth], which stores MM/DD/YYYY text.';
comment on column public.profiles.zip_code is
  'Captured via progressive onboarding / location-setup screen, not at account creation.';
comment on column public.profiles.search_radius_miles is
  'Default 25 miles, user-editable at any time. Not a hard requirement to set immediately.';
comment on column public.profiles.justice_impacted is
  'DEPRECATED (kept, not dropped): legacy onboarding.tsx yes/no signal. Superseded by the convictions table. Retirement requires verified production stability and a later explicit migration (Sterling decision #8).';

-- Backfill note: profiles.justice_impacted itself is untouched by this
-- migration — see 0010_backfill_canonical_profile.sql for the read-time
-- (not stored) handling of legacy-signal-without-structured-history.
