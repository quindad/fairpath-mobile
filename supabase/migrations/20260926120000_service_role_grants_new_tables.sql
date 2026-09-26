-- Forward-only fix: service_role table privileges on the Step 0/1 tables.
--
-- DEV showed these tables carrying only REFERENCES, TRIGGER, TRUNCATE for
-- service_role (no SELECT/INSERT/UPDATE/DELETE), so service-role tooling
-- such as the DEV seed runner failed with "permission denied for table".
-- The baseline tables get explicit grants in 20260901000100; these
-- later tables relied on default privileges, which did not cover them.
--
-- Scope: service_role ONLY. No anon/authenticated privileges are changed
-- here. service_role bypasses RLS, so RLS policies are unaffected.
-- Idempotent: re-granting an existing privilege is a no-op.

grant select, insert, update, delete on table
  public.feature_flags,
  public.offense_taxonomy_versions,
  public.offense_taxonomy_categories,
  public.addresses,
  public.convictions,
  public.supervision_records,
  public.registration_records,
  public.consent_events
to service_role;
