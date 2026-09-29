-- National Record Relief data-operations foundation. Read in full against the real schema/engine/importer
-- before writing this (see docs/RECORD_RELIEF_NATIONWIDE_CAPABILITY_MATRIX.md for the capability audit this
-- migration is based on). Purely additive: no existing table, function, or RLS policy is modified except one
-- new column set on record_relief_federal_pathways. record_relief_rules, its RLS, and evaluate_record_relief_case
-- are completely untouched by this migration.
--
-- The three required states, concretely:
--   1. RESEARCH CANDIDATE  = legal_rule_candidates.lifecycle_state in ('researched','normalized','needs_review').
--      Lives ONLY in this new staging table. NEVER selectable by an authenticated member (no member RLS policy
--      exists on this table at all - only service_role can touch it).
--   2. HUMAN-VERIFIED CANDIDATE = legal_rule_candidates.lifecycle_state = 'verified'. Still staging-only, still
--      not member-readable, still not in record_relief_rules.
--   3. PUBLISHED RULE VERSION = a record_relief_rules row with status = 'verified' (the existing, unchanged,
--      already-audited publication gate). Getting there from a verified candidate requires TWO deliberate acts:
--      promote_legal_rule_candidate() (candidate -> a NEW record_relief_rules row, status='draft', exactly like
--      the existing importer), then a human separately flips that row to status='verified' - the same act that
--      already publishes ordinary candidate imports today. Nothing here shortcuts that second step.

-- ---------------------------------------------------------------------
-- 1. Federal pathway typing - real gap: "pardon ≠ expungement" was not a structural fact before this.
-- ---------------------------------------------------------------------
alter table public.record_relief_federal_pathways
  add column if not exists pathway_type text not null default 'other'
    check (pathway_type in ('pardon', 'commutation', 'remission', 'reprieve', 'judicial_expungement',
                             'statutory_relief', 'firearm_rights_restoration', 'other')),
  add column if not exists effect_summary text,
  add column if not exists rights_not_restored text;

comment on column public.record_relief_federal_pathways.pathway_type is
  'Structural distinction so the engine never collapses legally distinct federal mechanisms into one label. '
  'A pardon does not expunge; firearm-rights restoration does not pardon; commutation is not a pardon.';
comment on column public.record_relief_federal_pathways.effect_summary is
  'Plain-language statement of what this pathway actually does (e.g. "removes civil disabilities, does not '
  'erase the conviction record").';
comment on column public.record_relief_federal_pathways.rights_not_restored is
  'Explicit statement of what this pathway does NOT restore, when known - never left implicit.';

-- ---------------------------------------------------------------------
-- 2. Source monitoring registry - the DISCOVERY/MONITORING layer, independent of publication.
-- ---------------------------------------------------------------------
create table if not exists public.legal_source_registry (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  pathway_key text,
  authority_name text not null check (length(btrim(authority_name)) between 2 and 160),
  source_title text not null check (length(btrim(source_title)) between 2 and 200),
  source_url text not null check (source_url ~ '^https://'),
  source_type text not null default 'webpage' check (source_type in ('webpage', 'pdf', 'api', 'manual')),
  priority text not null default 'secondary_research'
    check (priority in ('primary_statute', 'primary_court', 'primary_agency', 'primary_form', 'secondary_research')),
  parser_type text not null default 'manual' check (parser_type in ('html', 'pdf', 'api', 'manual')),
  active boolean not null default true,
  check_frequency text not null default 'monthly' check (check_frequency in ('weekly', 'monthly', 'quarterly')),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  content_hash text,
  etag text,
  last_modified text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists legal_source_registry_jurisdiction_idx on public.legal_source_registry (jurisdiction_code, active);

create table if not exists public.legal_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.legal_source_registry(id) on delete cascade,
  content_hash text,
  fetched_at timestamptz not null default now(),
  http_status integer,
  outcome text not null check (outcome in ('success', 'not_modified', 'http_error_404', 'http_error_403',
                                            'http_error_other', 'redirect', 'timeout', 'extraction_failed',
                                            'source_disappeared')),
  raw_excerpt text check (raw_excerpt is null or length(raw_excerpt) <= 20000),
  created_at timestamptz not null default now()
);
create index if not exists legal_source_snapshots_source_idx on public.legal_source_snapshots (source_id, fetched_at desc);

-- A source change is a fact about the SOURCE. It is never, by itself, a fact about the LAW - the classification
-- starts at 'unknown_needs_review' and can only ever be advanced by research + human/AI-proposed classification,
-- never inferred automatically from the hash diff alone.
create table if not exists public.legal_change_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.legal_source_registry(id) on delete cascade,
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  pathway_key text,
  old_snapshot_id uuid references public.legal_source_snapshots(id),
  new_snapshot_id uuid references public.legal_source_snapshots(id),
  old_hash text,
  new_hash text,
  detected_at timestamptz not null default now(),
  classification text not null default 'unknown_needs_review'
    check (classification in ('no_legal_change', 'form_update', 'fee_change', 'procedural_change',
                               'eligibility_change', 'waiting_period_change', 'exclusion_change',
                               'effective_date_change', 'source_url_change', 'future_legislation', 'repeal',
                               'unknown_needs_review')),
  classified_by text,
  status text not null default 'detected'
    check (status in ('detected', 'research_requested', 'research_in_progress', 'ready_for_review', 'in_review',
                       'resolved_no_change', 'promoted', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists legal_change_candidates_status_idx on public.legal_change_candidates (status, jurisdiction_code);

-- ---------------------------------------------------------------------
-- 3. Rule candidate staging - where RESEARCHED/NORMALIZED/NEEDS_REVIEW/VERIFIED candidates actually live.
--    Never readable by an authenticated member. Never the source of a member-facing query.
-- ---------------------------------------------------------------------
create table if not exists public.legal_rule_candidates (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  pathway_key text not null check (pathway_key ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  kind text not null default 'rule' check (kind in ('rule', 'federal_pathway', 'form')),
  lifecycle_state text not null default 'researched'
    check (lifecycle_state in ('researched', 'normalized', 'needs_review', 'verified', 'rejected', 'promoted')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  schema_blocked boolean not null default false,
  schema_blocked_reason text,
  research_package_ref text,
  red_team_ref text,
  researched_by text,
  reviewed_by text,
  change_candidate_id uuid references public.legal_change_candidates(id),
  promoted_rule_id uuid references public.record_relief_rules(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by is distinct from researched_by),
  check (lifecycle_state <> 'promoted' or promoted_rule_id is not null)
);
create index if not exists legal_rule_candidates_jurisdiction_idx on public.legal_rule_candidates (jurisdiction_code, lifecycle_state);

-- ---------------------------------------------------------------------
-- 4. Review queue - the backend contract for a future Admin "Legal Data Review Queue" screen. No UI here.
-- ---------------------------------------------------------------------
create table if not exists public.legal_review_queue (
  id uuid primary key default gen_random_uuid(),
  change_candidate_id uuid references public.legal_change_candidates(id),
  rule_candidate_id uuid references public.legal_rule_candidates(id),
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  pathway_key text,
  reviewer text,
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'rejected', 'request_more_research', 'marked_no_legal_change')),
  review_notes text,
  approved_at timestamptz,
  publication_scheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (decision <> 'approved' or approved_at is not null)
);
create index if not exists legal_review_queue_decision_idx on public.legal_review_queue (decision, jurisdiction_code);

-- ---------------------------------------------------------------------
-- 5. RLS + grants: service_role only, on every table this migration creates. No member, no anon, ever.
--    This is the structural guarantee behind "the mobile app must never read directly from raw research
--    candidates" - it is not merely a policy, the grant itself excludes authenticated entirely.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['legal_source_registry', 'legal_source_snapshots', 'legal_change_candidates',
                            'legal_rule_candidates', 'legal_review_queue'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- Explicit literal grants (not the dynamic loop above) so the static baseline audit, which scans for literal
-- "grant ... to service_role" text, can verify every new table has one.
grant select, insert, update, delete on table public.legal_source_registry to service_role;
grant select, insert, update, delete on table public.legal_source_snapshots to service_role;
grant select, insert, update, delete on table public.legal_change_candidates to service_role;
grant select, insert, update, delete on table public.legal_rule_candidates to service_role;
grant select, insert, update, delete on table public.legal_review_queue to service_role;

-- ---------------------------------------------------------------------
-- 6. Promotion: the ONLY path from staging into the live (member-facing-eventually) rules table.
--    Mirrors the existing importer's shape exactly (see scripts/lib/record-relief-importer.mjs) - always
--    inserts status='draft', never 'verified'. Requires the candidate to have already been through review
--    (lifecycle_state = 'verified'), not merely researched.
-- ---------------------------------------------------------------------
create or replace function public.promote_legal_rule_candidate(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cand public.legal_rule_candidates%rowtype;
  p jsonb;
  new_rule_id uuid;
begin
  select * into cand from public.legal_rule_candidates where id = p_candidate_id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  if cand.lifecycle_state <> 'verified' then raise exception 'CANDIDATE_NOT_VERIFIED'; end if;
  if cand.kind <> 'rule' then raise exception 'ONLY_RULE_KIND_SUPPORTED_TODAY'; end if;
  if cand.schema_blocked then raise exception 'CANDIDATE_SCHEMA_BLOCKED'; end if;

  p := cand.payload;
  insert into public.record_relief_rules (
    rule_key, rule_version, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes,
    excluded_offense_classes, waiting_years, waiting_months, waiting_days, waiting_anchor,
    requires_fines_paid, requires_restitution_paid, requires_no_pending_charges, max_other_convictions,
    manual_review_flags, fees, filing, required_documents, steps, form_keys,
    source_authority, source_url, citation_text, effective_from, effective_to,
    researched_by, next_review_at, staff_notes, court_discretion, data_origin, fixture_set, status
  ) values (
    p ->> 'rule_key', coalesce((p ->> 'rule_version')::integer, 1), cand.jurisdiction_code, p ->> 'remedy',
    p ->> 'title', p ->> 'summary',
    coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'applies_dispositions') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'applies_offense_classes') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'excluded_offense_classes') x), '{}'),
    coalesce((p ->> 'waiting_years')::integer, 0), coalesce((p ->> 'waiting_months')::integer, 0), coalesce((p ->> 'waiting_days')::integer, 0),
    coalesce(p ->> 'waiting_anchor', 'latest_completion'),
    coalesce((p ->> 'requires_fines_paid')::boolean, false), coalesce((p ->> 'requires_restitution_paid')::boolean, false),
    coalesce((p ->> 'requires_no_pending_charges')::boolean, false), (p ->> 'max_other_convictions')::integer,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'manual_review_flags') x), '{}'),
    coalesce(p -> 'fees', '{}'::jsonb), coalesce(p -> 'filing', '{}'::jsonb), coalesce(p -> 'required_documents', '[]'::jsonb), coalesce(p -> 'steps', '[]'::jsonb),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'form_keys') x), '{}'),
    p ->> 'source_authority', p ->> 'source_url', p ->> 'citation_text', (p ->> 'effective_from')::date, (p ->> 'effective_to')::date,
    coalesce(p ->> 'researched_by', cand.researched_by), (p ->> 'next_review_at')::date, p ->> 'staff_notes',
    coalesce((p ->> 'court_discretion')::boolean, false),
    coalesce(p ->> 'data_origin', 'production'), p ->> 'fixture_set', 'draft'
  ) returning id into new_rule_id;

  update public.legal_rule_candidates set lifecycle_state = 'promoted', promoted_rule_id = new_rule_id, updated_at = now() where id = p_candidate_id;
  if cand.change_candidate_id is not null then
    update public.legal_change_candidates set status = 'promoted', updated_at = now() where id = cand.change_candidate_id;
  end if;
  return new_rule_id;
end;
$$;
revoke all on function public.promote_legal_rule_candidate(uuid) from public, anon, authenticated;
grant execute on function public.promote_legal_rule_candidate(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 7. Impact analysis - "how many stored evaluations used a since-superseded rule." No new columns needed:
--    record_relief_evaluations already carries rule_key/rule_version/superseded. This was already
--    representable; it only needed a query. Read-only, service_role only (Admin backend contract, no UI).
-- ---------------------------------------------------------------------
create or replace function public.record_relief_rule_impact(p_rule_key text, p_rule_version integer)
returns table (affected_case_count bigint, affected_user_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint, count(distinct user_id)::bigint
  from public.record_relief_evaluations
  where rule_key = p_rule_key and rule_version = p_rule_version and not superseded;
$$;
revoke all on function public.record_relief_rule_impact(text, integer) from public, anon, authenticated;
grant execute on function public.record_relief_rule_impact(text, integer) to service_role;
