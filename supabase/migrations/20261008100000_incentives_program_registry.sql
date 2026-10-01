-- Nationwide Economic Value / Incentives Engine, foundation pass.
--
-- Explicitly NOT built around one credit (WOTC). This is a general-purpose registry for federal/state/local
-- employment (and future housing) incentive programs, with versioned rules (never overwritten), a stackability/
-- conflict table, a per-placement assessment engine, and claim/realization tracking kept as distinct stages
-- (potential -> estimated -> approved -> claimed -> realized -> bond coverage), per explicit product direction:
-- never collapse those into one fake ROI number, never call a deduction a credit, never call bond coverage cash.
--
-- Research/verification workflow lives here as data, not code: research_status on incentive_programs tracks
-- whether a program is real/current enough to ever reach a Partner employer screen. Only verified_active
-- programs with a current rule version may be shown to Partner as an opportunity - discovered/needs_verification/
-- proposed_only/expired/superseded/authorization_lapsed must never render as an available incentive. This
-- migration seeds NO program rows - seeding happens in a separate, explicitly-researched migration so that
-- "schema exists" is never confused with "data is verified."

create table public.incentive_programs (
  id uuid primary key default gen_random_uuid(),
  program_code text not null unique,
  program_name text not null,
  program_domain text not null default 'employment' check (program_domain in ('employment', 'housing')),
  benefit_type text not null check (benefit_type in (
    'tax_credit', 'tax_deduction', 'wage_reimbursement', 'training_reimbursement', 'grant', 'tax_refund',
    'bond_coverage', 'job_creation_credit', 'payroll_credit', 'other'
  )),
  jurisdiction_level text not null check (jurisdiction_level in ('federal', 'state', 'local')),
  jurisdiction_state text, -- USPS 2-letter code; null only for jurisdiction_level='federal'
  jurisdiction_county text,
  jurisdiction_workforce_area text,
  justice_specific boolean not null default false,
  administering_authority text not null,
  research_status text not null default 'discovered' check (research_status in (
    'discovered', 'needs_verification', 'verified_active', 'verified_inactive', 'authorization_lapsed',
    'expired', 'proposed_only', 'superseded', 'unknown'
  )),
  requires_employer_application boolean not null default false,
  requires_government_certification boolean not null default false,
  requires_member_documentation boolean not null default false,
  deadline_type text,
  deadline_days_from_hire integer,
  last_verified_at timestamptz,
  last_verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jurisdiction_level <> 'federal' or jurisdiction_state is null)
);
comment on table public.incentive_programs is
  'Nationwide registry of employment/housing incentive programs. research_status gates visibility - only '
  'verified_active programs with a current, verified rule version may ever be shown to a Partner employer as '
  'an opportunity. This table is reference data, not tenant data - no organization_id, no RLS tenant boundary.';

create index incentive_programs_jurisdiction_idx on public.incentive_programs (jurisdiction_level, jurisdiction_state);
create index incentive_programs_status_idx on public.incentive_programs (research_status);

create table public.incentive_program_rule_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.incentive_programs(id) on delete cascade,
  version_number integer not null,
  effective_from date not null,
  effective_through date,
  eligibility_requirements text,
  employer_requirements text,
  worker_requirements text,
  worksite_requirements text,
  wage_requirements text,
  hours_requirements text,
  retention_requirements text,
  training_requirements text,
  application_deadline text,
  required_documents text,
  -- Deliberately not one simplistic numeric formula - some programs are tables/tiers/agency decisions.
  benefit_formula_type text not null check (benefit_formula_type in (
    'percent_of_wages', 'flat_amount', 'tiered_by_year', 'percent_of_training_cost', 'percent_of_fica',
    'per_hour', 'table_based', 'agency_determined', 'other'
  )),
  benefit_formula_detail jsonb not null default '{}'::jsonb,
  maximum_value numeric,
  minimum_value numeric,
  carryforward_rules text,
  certification_requirements text,
  official_source_url text not null,
  official_source_title text,
  source_authority text not null,
  retrieved_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by text,
  research_notes text,
  created_at timestamptz not null default now(),
  unique (program_id, version_number)
);
comment on table public.incentive_program_rule_versions is
  'Versioned rules for a program - never overwritten. A reauthorization (e.g. WOTC returning after its current '
  'authorization lapse) creates a NEW version with new effective dates; history is preserved, never rewritten.';

create index incentive_rule_versions_program_idx on public.incentive_program_rule_versions (program_id, effective_from desc);

create table public.incentive_program_compatibility_rules (
  id uuid primary key default gen_random_uuid(),
  program_a_id uuid not null references public.incentive_programs(id) on delete cascade,
  program_b_id uuid not null references public.incentive_programs(id) on delete cascade,
  relationship text not null check (relationship in (
    'compatible', 'mutually_exclusive', 'same_wage_base_excluded', 'same_training_cost_excluded',
    'requires_manual_review', 'unknown'
  )),
  scope text,
  effective_from date,
  effective_through date,
  source text,
  verified_status text not null default 'needs_verification' check (verified_status in ('needs_verification', 'verified')),
  created_at timestamptz not null default now(),
  check (program_a_id <> program_b_id),
  unique (program_a_id, program_b_id)
);
comment on table public.incentive_program_compatibility_rules is
  'Explicit stacking relationships. Absence of a row means unknown, not compatible - the assessment engine must '
  'never sum two programs'' values unless an explicit compatible row exists. unknown must display as '
  '"stacking needs review", never silently as combinable.';

-- Per-placement assessment. Intentionally carries only the facts a program match needs (worksite, wage,
-- industry, dates) - never justice-history evidence, which stays Command-Center-only per the standing CRM
-- security boundary. Partner reads a curated status via incentive_assessment_programs, never this reasoning.
create table public.incentive_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  placement_id uuid references public.job_placements(id) on delete cascade,
  application_id uuid references public.job_applications(id) on delete set null,
  worksite_state text not null,
  worksite_county text,
  employee_residence_state text,
  industry text,
  organization_size text,
  wage numeric,
  employment_type text,
  hours_per_week numeric,
  apprenticeship_status boolean not null default false,
  training_status boolean not null default false,
  placement_date date not null,
  created_at timestamptz not null default now()
);
create index incentive_assessments_org_idx on public.incentive_assessments (organization_id);

create table public.incentive_assessment_programs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.incentive_assessments(id) on delete cascade,
  program_id uuid not null references public.incentive_programs(id) on delete cascade,
  rule_version_id uuid not null references public.incentive_program_rule_versions(id),
  partner_status text not null check (partner_status in (
    'potential_match', 'information_needed', 'likely_eligible', 'eligibility_verified', 'not_eligible', 'program_unavailable'
  )),
  estimated_value numeric,
  estimated_value_note text,
  missing_information text,
  next_action text,
  deadline_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, program_id)
);
create index incentive_assessment_programs_assessment_idx on public.incentive_assessment_programs (assessment_id);

create table public.incentive_claims (
  id uuid primary key default gen_random_uuid(),
  assessment_program_id uuid not null references public.incentive_assessment_programs(id) on delete cascade,
  claim_status text not null default 'not_started' check (claim_status in (
    'not_started', 'application_in_progress', 'submitted', 'approved', 'denied', 'realized'
  )),
  -- Kept as distinct stages, never summed into one ROI figure - an approved tax credit, a realized wage
  -- reimbursement, and secured bond coverage are not interchangeable dollars.
  approved_value numeric,
  claimed_value numeric,
  realized_value numeric,
  bond_coverage_value numeric,
  submitted_at timestamptz,
  approved_at timestamptz,
  realized_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index incentive_claims_assessment_program_idx on public.incentive_claims (assessment_program_id);

-- Command Center research operations surface - internal only, service-role administered. Tracks the required
-- 51-jurisdiction (50 states + DC) sweep so partial research progress is visible and nothing silently stalls.
create table public.incentive_research_queue (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null unique, -- 'US' for federal, else USPS 2-letter state/DC code
  jurisdiction_name text not null,
  research_status text not null default 'not_started' check (research_status in ('not_started', 'in_progress', 'completed')),
  categories_researched text[] not null default '{}',
  last_researched_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.incentive_programs enable row level security;
alter table public.incentive_program_rule_versions enable row level security;
alter table public.incentive_program_compatibility_rules enable row level security;
alter table public.incentive_assessments enable row level security;
alter table public.incentive_assessment_programs enable row level security;
alter table public.incentive_claims enable row level security;
alter table public.incentive_research_queue enable row level security;

revoke all on table public.incentive_programs, public.incentive_program_rule_versions,
  public.incentive_program_compatibility_rules, public.incentive_assessments,
  public.incentive_assessment_programs, public.incentive_claims, public.incentive_research_queue
  from public, anon, authenticated;

-- Registry/rule-version/compatibility rows are reference data, not tenant data - any authenticated Partner
-- user may read them (Command Center still administers writes via service_role only), but ONLY rows that have
-- cleared verification. A not-yet-verified or expired program must never be queryable by Partner as if it were
-- available - the read policy itself enforces that, not just app-layer filtering.
create policy "incentive_programs_read_verified_active" on public.incentive_programs
  for select to authenticated using (research_status = 'verified_active');
create policy "incentive_rule_versions_read_for_verified_programs" on public.incentive_program_rule_versions
  for select to authenticated using (
    exists (select 1 from public.incentive_programs p where p.id = program_id and p.research_status = 'verified_active')
    and verified_at is not null
  );
create policy "incentive_compatibility_read_verified" on public.incentive_program_compatibility_rules
  for select to authenticated using (verified_status = 'verified');

grant select on table public.incentive_programs, public.incentive_program_rule_versions,
  public.incentive_program_compatibility_rules to authenticated;
grant select, insert, update, delete on table public.incentive_programs, public.incentive_program_rule_versions,
  public.incentive_program_compatibility_rules, public.incentive_research_queue to service_role;

-- Assessments/claims are organization-scoped, same ownership pattern as job_placements - never a second
-- authorization model.
create policy "incentive_assessments_read_own_org" on public.incentive_assessments
  for select to authenticated using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = incentive_assessments.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );
create policy "incentive_assessment_programs_read_own_org" on public.incentive_assessment_programs
  for select to authenticated using (
    exists (
      select 1 from public.incentive_assessments a
      join public.organization_members om on om.organization_id = a.organization_id
      where a.id = assessment_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );
create policy "incentive_claims_read_own_org" on public.incentive_claims
  for select to authenticated using (
    exists (
      select 1 from public.incentive_assessment_programs ap
      join public.incentive_assessments a on a.id = ap.assessment_id
      join public.organization_members om on om.organization_id = a.organization_id
      where ap.id = assessment_program_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );

grant select on table public.incentive_assessments, public.incentive_assessment_programs, public.incentive_claims to authenticated;
grant select, insert, update, delete on table public.incentive_assessments, public.incentive_assessment_programs, public.incentive_claims to service_role;
