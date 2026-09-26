-- Forward-only fix: least-privilege anon/authenticated table privileges
-- on the Step 0/1 tables.
--
-- These tables were created without explicit grants and DEV's defaults
-- gave anon/authenticated only REFERENCES, TRIGGER, TRUNCATE, so every
-- client read/write failed with "permission denied" before RLS ran.
-- Grants below are derived per table from (a) the RLS policies already in
-- place and (b) the operations the app actually performs. RLS still
-- decides which rows; these grants only make the operations reachable.
--
-- Explicitly NOT granted: TRUNCATE/REFERENCES/TRIGGER to app roles, any
-- anon access to personal/sensitive tables, and DELETE (the app never
-- deletes these rows; add it in the migration that ships the feature,
-- e.g. account deletion).

-- Public reference data: readable by guests and members, never writable.
grant select on table public.feature_flags to anon, authenticated;
grant select on table public.offense_taxonomy_versions to anon, authenticated;
grant select on table public.offense_taxonomy_categories to anon, authenticated;

-- Owner-only sensitive data: signed-in members read/create/update their own rows.
grant select, insert, update on table public.addresses to authenticated;
grant select, insert, update on table public.convictions to authenticated;
grant select, insert, update on table public.supervision_records to authenticated;
grant select, insert, update on table public.registration_records to authenticated;

-- Append-only consent ledger: members may read and add their own events only.
grant select, insert on table public.consent_events to authenticated;
