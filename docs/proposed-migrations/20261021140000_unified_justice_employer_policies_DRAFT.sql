-- SUPERSEDED by 20261021150000_canonical_justice_reconciliation_DRAFT.sql (do not apply this file alone).
-- DRAFT ONLY — DO NOT APPLY.
-- Unified justice docket + multi-charge rows + versioned employer job conviction policies + explainable match records.
-- Complements (does not replace) 20261023100000_record_relief_charge_venue_engine_DRAFT.sql:
--   * That draft normalizes record_relief_cases → record_relief_charges.
--   * This draft adds a member-facing justice_cases shell that can link convictions + RR without a third disconnected store.
--
-- Rollback (after apply, in reverse order):
--   1. drop table justice_match_evaluations;
--   2. drop table employer_job_conviction_policy_versions;
--   3. drop table employer_job_conviction_policies;
--   4. drop table justice_charge_corrections;
--   5. drop table justice_charges;
--   6. drop table justice_cases;
--   7. drop type if exists justice_verification_state;
-- Backfill rows in convictions / record_relief_cases remain untouched.

-- ---------------------------------------------------------------------
-- Member justice docket (one criminal case / docket, many charges)
-- ---------------------------------------------------------------------
create table if not exists public.justice_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jurisdiction_code text not null,
  state_code text,
  county text,
  court_name text,
  case_number text,
  docket_label text not null check (length(btrim(docket_label)) between 2 and 120),
  case_status text not null default 'open'
    check (case_status in ('open', 'closed', 'pending_appeal', 'consolidated', 'unknown')),
  arrest_date date,
  filing_date date,
  source_type text not null default 'self_reported'
    check (source_type in ('self_reported', 'document', 'official_record', 'partner_verified')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  record_relief_case_id uuid references public.record_relief_cases(id) on delete set null,
  related_case_id uuid references public.justice_cases(id) on delete set null,
  member_notes text check (member_notes is null or length(member_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists justice_cases_user_idx on public.justice_cases (user_id, updated_at desc);
create unique index if not exists justice_cases_user_docket_uidx
  on public.justice_cases (user_id, jurisdiction_code, lower(btrim(case_number)))
  where case_number is not null and btrim(case_number) <> '';

create table if not exists public.justice_charges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.justice_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  count_number integer,
  offense_name text not null check (length(btrim(offense_name)) between 2 and 200),
  statute_code text,
  statute_version text,
  offense_catalog_id uuid references public.offense_catalog(id),
  amended_from_charge_id uuid references public.justice_charges(id) on delete set null,
  degree text not null default 'unknown'
    check (degree in ('infraction', 'minor_misdemeanor', 'misdemeanor', 'felony', 'unknown')),
  degree_level integer,
  offense_category text,
  disposition text not null default 'unknown'
    check (disposition in ('conviction', 'dismissal', 'acquittal', 'deferred_adjudication', 'nolle_prosequi', 'arrest_no_charge', 'pending', 'unknown')),
  conviction_date date,
  disposition_date date,
  sentence_completion_date date,
  supervision_completion_date date,
  release_date date,
  fines_paid boolean,
  restitution_paid boolean,
  sealing_history jsonb not null default '[]'::jsonb,
  conviction_id uuid references public.convictions(id) on delete set null,
  record_relief_charge_id uuid,
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, count_number)
);
create index if not exists justice_charges_case_idx on public.justice_charges (case_id, count_number);

create table if not exists public.justice_charge_corrections (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.justice_charges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_name text not null,
  prior_value jsonb,
  new_value jsonb,
  reason text check (reason is null or length(reason) <= 500),
  created_at timestamptz not null default now()
);

alter table public.justice_cases enable row level security;
alter table public.justice_charges enable row level security;
alter table public.justice_charge_corrections enable row level security;

create policy "justice_cases_owner_all" on public.justice_cases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "justice_charges_owner_all" on public.justice_charges for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "justice_corrections_owner_insert" on public.justice_charge_corrections for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "justice_corrections_owner_read" on public.justice_charge_corrections for select to authenticated
  using (user_id = (select auth.uid()));

-- No partner/employer/admin SELECT on justice_* — matching uses security-definer RPCs only (future).

-- ---------------------------------------------------------------------
-- Employer job-specific conviction consideration policies (versioned + admin gate)
-- ---------------------------------------------------------------------
create table if not exists public.employer_job_conviction_policies (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'corrections_requested', 'approved', 'rejected', 'retired')),
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id)
);

create table if not exists public.employer_job_conviction_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.employer_job_conviction_policies(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  effective_from date not null default current_date,
  policy_json jsonb not null,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or length(review_notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (policy_id, version_number)
);

alter table public.employer_job_conviction_policies
  add constraint employer_job_conviction_policies_published_fkey
  foreign key (published_version_id) references public.employer_job_conviction_policy_versions(id);

alter table public.employer_job_conviction_policies enable row level security;
alter table public.employer_job_conviction_policy_versions enable row level security;

-- Partner org members: read own job policies; insert draft versions; cannot set approved/published without admin RPC.
create policy "employer_policy_org_read" on public.employer_job_conviction_policies for select to authenticated
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = employer_job_conviction_policies.organization_id
      and om.user_id = (select auth.uid()) and om.status = 'active'
  ));

-- Writes via security-definer RPCs: partner_submit_job_conviction_policy, admin_review_job_conviction_policy.

-- ---------------------------------------------------------------------
-- Versioned explainable match evaluations (no raw conviction payload)
-- ---------------------------------------------------------------------
create table if not exists public.justice_match_evaluations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  policy_version_id uuid not null references public.employer_job_conviction_policy_versions(id) on delete restrict,
  outcome text not null check (outcome in (
    'appears_compatible', 'individual_review_required', 'confirmed_restriction', 'insufficient_information'
  )),
  explanation jsonb not null,
  charge_fact_refs uuid[] not null default '{}',
  consent_scope text not null default 'none'
    check (consent_scope in ('none', 'categories_only', 'member_authorized_summary')),
  evaluated_at timestamptz not null default now(),
  engine_version text not null,
  unique (member_id, job_id, policy_version_id)
);

alter table public.justice_match_evaluations enable row level security;
create policy "justice_match_evaluations_member_read" on public.justice_match_evaluations for select to authenticated
  using (member_id = (select auth.uid()));

-- Employers never read justice_match_evaluations directly; they see application workflow only unless member discloses.

comment on table public.justice_match_evaluations is
  'Explainable compatibility assessment. Never stores full conviction text; references charge ids + policy criteria only.';
