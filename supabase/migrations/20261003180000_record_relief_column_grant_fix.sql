-- Second, deeper part of the same finding as 20261003170000: revoking the over-broad RPC grant on
-- record_relief_active_rules() was not sufficient. All three Record Relief reference tables
-- (record_relief_rules, record_relief_federal_pathways, record_relief_forms) also had a BLANKET
-- `grant select on table ... to authenticated`. RLS restricts which ROWS a member can read (only
-- status = 'verified'), but a table-level GRANT has no column awareness — any authenticated member could call
-- `supabase.from('record_relief_rules').select('staff_notes')` directly via PostgREST and receive it, completely
-- bypassing the app's own client code (which never does this, but that was never what protected the data — the
-- grant was). This is the same class of finding as the RPC over-grant, just at a different layer, and needed a
-- second look to catch.
--
-- Fixed with column-level grants: the same public reference data stays fully readable (verified rules must
-- remain usable by the app), but the four staff-only columns added in 20261003160000 are excluded from what
-- `authenticated` can select at all, at the database privilege layer — not dependent on RLS, not dependent on
-- what any client happens to query today.
revoke select on table public.record_relief_rules from authenticated;
grant select (
  id, rule_key, rule_version, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes,
  excluded_offense_classes, waiting_years, waiting_months, waiting_days, waiting_anchor, requires_fines_paid,
  requires_restitution_paid, requires_no_pending_charges, max_other_convictions, manual_review_flags, fees, filing,
  required_documents, steps, form_keys, source_authority, source_url, citation_text, effective_from, effective_to,
  last_verified_at, status, data_origin, fixture_set, created_at
) on table public.record_relief_rules to authenticated;
-- excluded: next_review_at, researched_by, reviewed_by, staff_notes (staff-only)

revoke select on table public.record_relief_federal_pathways from authenticated;
grant select (
  id, pathway_key, pathway_version, title, description, is_general_expungement, applies_to, source_authority,
  source_url, citation_text, effective_from, last_verified_at, status, data_origin, fixture_set
) on table public.record_relief_federal_pathways to authenticated;
-- excluded: next_review_at, researched_by, reviewed_by, staff_notes (staff-only)

revoke select on table public.record_relief_forms from authenticated;
grant select (
  id, form_key, jurisdiction_code, name, kind, revision, effective_date, official_source_url, last_verified_at,
  remedies, auto_fillable, field_map, status, data_origin, fixture_set
) on table public.record_relief_forms to authenticated;
-- excluded: next_review_at, reviewed_by, staff_notes (staff-only)

-- anon (guests) never had table-level select on these to begin with; confirmed no equivalent grant exists for anon.
