-- Program Scout foundation, step 2: the Source Registry and the candidate-discovery pipeline that feeds
-- incentive_programs. incentive_programs/incentive_program_rule_versions (20261008100000) remain the canonical,
-- Partner/Mobile-visible truth - this migration adds everything UPSTREAM of that: cataloged authoritative
-- sources, retrieval runs, AI/manual extraction candidates, and change detection. A program_candidates row is
-- never itself visible to Partner/Mobile; only a promoted incentive_programs row (research_status=
-- verified_active) is, exactly as before.

create table public.program_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  authority_type text not null check (authority_type in (
    'federal_agency', 'state_agency', 'county', 'city', 'pha', 'continuum_of_care', 'workforce_board',
    'state_workforce_agency', 'state_housing_finance_agency', 'court_judiciary', 'attorney_general_legal_authority',
    'tax_revenue_agency', 'economic_development_agency', 'education_training_authority', 'transit_authority',
    'childcare_human_services_agency', 'approved_nonprofit_institutional', 'other_verified_authority'
  )),
  -- TIER 1 (official government/agency primary source) and TIER 2 (official administering organization) may
  -- back an activation. TIER 3 (approved institutional source) and discovery_only may surface a candidate but
  -- can never alone satisfy the verification gate in incentive_program_rule_versions (verified_at/verified_by).
  source_tier text not null check (source_tier in ('tier_1', 'tier_2', 'tier_3', 'discovery_only')),
  jurisdiction_level text not null check (jurisdiction_level in ('federal', 'state', 'local')),
  jurisdiction_state text,
  jurisdiction_county text,
  jurisdiction_city text,
  official_url text not null,
  discovery_method text not null default 'manual' check (discovery_method in ('manual', 'scheduled_crawl', 'api_feed', 'referral')),
  crawl_strategy text check (crawl_strategy in ('html', 'pdf', 'api', 'csv_json_xml', 'document_download', null)),
  check_cadence text not null default 'monthly' check (check_cadence in ('daily', 'weekly', 'monthly', 'manual_only')),
  active boolean not null default true,
  last_checked_at timestamptz,
  last_successful_retrieval_at timestamptz,
  next_check_at timestamptz,
  failure_count integer not null default 0,
  source_health text not null default 'unknown' check (source_health in ('healthy', 'degraded', 'failing', 'unknown')),
  robots_access_limitations text,
  manual_review_status text not null default 'none' check (manual_review_status in ('none', 'flagged', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.program_sources is
  'Canonical catalog of authoritative sources Program Scout knows about. A random blog can exist here as '
  'discovery_only to help find programs - it can never itself satisfy a rule_version''s verification gate.';

create table public.program_source_domains (
  source_id uuid not null references public.program_sources(id) on delete cascade,
  program_domain text not null references public.program_domains(code),
  primary key (source_id, program_domain)
);

create table public.program_source_retrieval_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.program_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failure')),
  http_status integer,
  content_hash text,
  retrieved_summary text, -- short provenance note, not a full content mirror - avoids storing copyrighted material beyond what's needed for provenance/processing
  error_message text
);
create index program_source_retrieval_runs_source_idx on public.program_source_retrieval_runs (source_id, started_at desc);

-- The staging table. A discovered program lives here through its full lifecycle BEFORE it may ever become an
-- incentive_programs row. Carries the structured extraction fields Program Scout asks of discovery/AI
-- extraction - program identity, normalized benefit type, amounts, dates, and the provenance pointer back to
-- exactly which retrieval run supported it.
create table public.program_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.program_sources(id) on delete restrict,
  retrieval_run_id uuid references public.program_source_retrieval_runs(id) on delete set null,
  lifecycle_status text not null default 'discovered' check (lifecycle_status in (
    'discovered', 'extracted', 'primary_source_found', 'source_verified', 'rule_verified', 'active',
    'needs_review', 'expired', 'suspended', 'superseded', 'source_unavailable', 'rejected'
  )),
  program_name text,
  program_domain text references public.program_domains(code),
  program_subtype text,
  administering_authority text,
  jurisdiction_level text check (jurisdiction_level in ('federal', 'state', 'local', null)),
  jurisdiction_state text,
  jurisdiction_county text,
  jurisdiction_workforce_area text,
  target_recipient text,
  benefit_type text check (benefit_type in (
    'tax_credit', 'tax_deduction', 'wage_reimbursement', 'training_reimbursement', 'grant', 'tax_refund',
    'bond_coverage', 'job_creation_credit', 'payroll_credit',
    'direct_assistance', 'rental_subsidy', 'security_deposit_assistance', 'move_in_assistance', 'lease_up_bonus',
    'vacancy_payment', 'damage_mitigation', 'rent_loss_protection', 'training_funding', 'transportation_assistance',
    'childcare_assistance', 'fee_waiver', 'loan', 'loan_guarantee', 'legal_relief', 'other', null
  )),
  benefit_amount numeric,
  benefit_minimum numeric,
  benefit_maximum numeric,
  benefit_percentage numeric,
  effective_date date,
  expiration_date date,
  application_period text,
  funding_limited boolean not null default false,
  eligibility_criteria text,
  required_documentation text,
  application_process text,
  source_section text, -- page/section identifier within the source document, when available
  extracted_at timestamptz,
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  extraction_method text not null default 'manual' check (extraction_method in ('manual', 'ai_assisted')),
  extraction_notes text,
  -- Set only once a human/process has independently re-verified the extracted facts against the primary
  -- source - mirrors incentive_program_rule_versions.verified_at, never auto-set by extraction alone.
  verified_at timestamptz,
  verified_by text,
  promoted_program_id uuid references public.incentive_programs(id) on delete set null,
  promoted_rule_version_id uuid references public.incentive_program_rule_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.program_candidates is
  'Discovery/extraction staging. extraction_confidence is an internal signal for the review queue - it must '
  'NEVER be surfaced to Partner/Mobile as an eligibility signal. A candidate only affects what a member/employer '
  'sees once lifecycle_status=active AND it has been promoted to a real incentive_programs + rule_version row '
  'with verified_at set - the promotion fields exist to make that link auditable, never implicit.';
create index program_candidates_source_idx on public.program_candidates (source_id);
create index program_candidates_status_idx on public.program_candidates (lifecycle_status);
create index program_candidates_domain_idx on public.program_candidates (program_domain);

-- Change detection. Never overwrites a program/candidate in place - records the diff, and only a verified
-- review creates a NEW rule version (never edits an existing one).
create table public.program_change_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.incentive_programs(id) on delete cascade,
  candidate_id uuid references public.program_candidates(id) on delete cascade,
  source_id uuid references public.program_sources(id) on delete set null,
  change_type text not null check (change_type in (
    'benefit_amount_change', 'eligibility_change', 'new_effective_date', 'expiration', 'application_closure',
    'funding_exhaustion', 'suspension', 'source_disappearance', 'new_document_version', 'other'
  )),
  old_value jsonb,
  new_value jsonb,
  detected_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  resulting_rule_version_id uuid references public.incentive_program_rule_versions(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by text,
  check (program_id is not null or candidate_id is not null)
);
create index program_change_events_status_idx on public.program_change_events (review_status);

-- Human review is the exception path, not the default - this is where ambiguous/conflicting/uncertain items
-- land instead of silently activating.
create table public.program_scout_review_queue (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in (
    'candidate', 'change_event', 'stackability', 'source_health', 'extraction_uncertainty', 'program_status', 'other'
  )),
  reference_id uuid not null,
  reason text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text
);
create index program_scout_review_queue_status_idx on public.program_scout_review_queue (status, priority);

-- Everything above is Command-Center/service-role administered - no authenticated (Partner/Mobile) access at
-- all. A candidate, source, or change event is never directly queryable by a tenant; only the promoted,
-- verified incentive_programs row is (via the existing policy from 20261008100000).
alter table public.program_sources enable row level security;
alter table public.program_source_domains enable row level security;
alter table public.program_source_retrieval_runs enable row level security;
alter table public.program_candidates enable row level security;
alter table public.program_change_events enable row level security;
alter table public.program_scout_review_queue enable row level security;

revoke all on table public.program_sources, public.program_source_domains, public.program_source_retrieval_runs,
  public.program_candidates, public.program_change_events, public.program_scout_review_queue
  from public, anon, authenticated;
grant select, insert, update, delete on table public.program_sources, public.program_source_domains,
  public.program_source_retrieval_runs, public.program_candidates, public.program_change_events,
  public.program_scout_review_queue to service_role;
