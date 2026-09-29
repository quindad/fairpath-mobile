-- Real gap found in the Record Relief capability-matrix audit (boardroom sprint, Record Relief data-ops pass):
-- record_relief_forms had no field distinguishing a statewide form from a county/municipal/court-specific one.
-- Every other requested concept (rule versioning, effective-date history, source provenance, manual-review
-- flags, verification status, staleness) was already real and correctly enforced - this was the one genuine gap.
-- Without this, nothing in the schema prevents a local Cuyahoga County form from being presented to a member in
-- Franklin County as though it applies statewide.

alter table public.record_relief_forms
  add column if not exists scope text not null default 'statewide'
    check (scope in ('statewide', 'county', 'municipal', 'court_specific', 'other')),
  add column if not exists scope_detail text;

alter table public.record_relief_forms
  add constraint record_relief_forms_scope_detail_required
  check (scope = 'statewide' or scope_detail is not null);

comment on column public.record_relief_forms.scope is
  'statewide (default) means the form applies anywhere in the jurisdiction. Anything else requires scope_detail '
  'naming the specific county/municipality/court, enforced by a CHECK constraint - a local form can never be '
  'silently presented as statewide by omission.';
comment on column public.record_relief_forms.scope_detail is
  'Required whenever scope is not statewide. E.g. "Cuyahoga County Court of Common Pleas".';
