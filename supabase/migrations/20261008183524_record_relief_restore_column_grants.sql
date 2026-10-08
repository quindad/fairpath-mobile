-- DEV corrective migration: 20261009010000 restored required Data API access with blanket table grants,
-- unintentionally reopening staff-only review metadata. Keep member-facing reference columns available while
-- denying staff_notes/reviewer/research scheduling columns at the Postgres privilege layer.
revoke select on table public.record_relief_rules from authenticated;
grant select (
  id, rule_key, rule_version, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes,
  excluded_offense_classes, waiting_years, waiting_months, waiting_days, waiting_anchor, requires_fines_paid,
  requires_restitution_paid, requires_no_pending_charges, max_other_convictions, manual_review_flags, fees, filing,
  required_documents, steps, form_keys, source_authority, source_url, citation_text, effective_from, effective_to,
  last_verified_at, status, data_origin, fixture_set, created_at, court_discretion
) on table public.record_relief_rules to authenticated;

revoke select on table public.record_relief_federal_pathways from authenticated;
grant select (
  id, pathway_key, pathway_version, title, description, is_general_expungement, applies_to, source_authority,
  source_url, citation_text, effective_from, last_verified_at, status, data_origin, fixture_set, jurisdiction_subtype
) on table public.record_relief_federal_pathways to authenticated;

revoke select on table public.record_relief_forms from authenticated;
grant select (
  id, form_key, jurisdiction_code, name, kind, revision, effective_date, official_source_url, last_verified_at,
  remedies, auto_fillable, field_map, status, data_origin, fixture_set, scope, scope_detail
) on table public.record_relief_forms to authenticated;
