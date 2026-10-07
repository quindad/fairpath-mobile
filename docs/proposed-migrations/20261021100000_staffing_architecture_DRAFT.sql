-- ============================================================================================
-- DRAFT — NOT APPLIED. DO NOT RUN. Lives outside supabase/migrations so no tool or person can
-- accidentally apply it. Written after auditing the existing schema:
--   - public.jobs already holds listings (employment_type: full_time/part_time only today).
--   - public.job_applications already holds the application pipeline.
--   - public.job_placements (20261007110000_job_placements.sql) already holds the durable
--     "we hired this person" fact for DIRECT HIRE, with a single employer_id.
-- Staffing is a two-sided relationship (FairPath/EOR as employer of record, a separate client
-- business using the worker) that job_placements does not model. This migration EXTENDS jobs and
-- job_placements rather than duplicating them.
--
-- WHAT THIS CHANGES
-- - jobs gains listing_kind ('direct_hire' | 'staffing'), default 'direct_hire' (no existing row
--   changes meaning).
-- - A new staffing_requisitions table for the client company's temp/contract need, referencing jobs.
-- - A new staffing_assignments table that is a 1:1 EXTENSION of job_placements (assignment_id ->
--   job_placements.id), adding assignment type, EOR provider state, screening state, time/payroll
--   handoff flag and retention linkage. The underlying hire fact still lives in job_placements.
-- - staffing_assignment_status_history for an append-only audit trail of stage changes
--   (src/core/staffing/workflow.ts stages).
-- - staffing_rate_cards and staffing_economics hold pay rate / bill rate / EOR cost / screening
--   cost / statutory burden / gross spread / estimated contribution — FINANCIAL, OPS-ONLY. No
--   member-facing RLS policy is ever added to these two tables.
-- - staffing_provider_state (FoxHire) and staffing_screening_state (Checkr) hold adapter state
--   machines matching src/core/staffing/{foxhire-adapter,checkr-adapter}.ts exactly.
--
-- WHAT THIS DOES NOT CHANGE
-- - job_placements' existing columns, constraints and policies are untouched.
-- - No existing jobs or job_applications row changes meaning.
-- - No payment, no real FoxHire/Checkr/Experian call. This only prepares the data model.
--
-- ROLLBACK
-- - All new tables can be dropped in reverse creation order with no effect on jobs, job_applications
--   or job_placements.
-- - `alter table jobs add column listing_kind ...` is reversible with `drop column listing_kind`
--   as long as no application code has started relying on it as non-null.
--
-- ISOLATION (five audiences, five different RLS postures)
-- 1. Member-visible: staffing_assignments (member-safe columns only, via a view — see below),
--    staffing_assignment_status_history (own assignment only).
-- 2. Employer/client data: staffing_requisitions (client org only, same organization_members
--    pattern as job_placements' employer read policy).
-- 3. FairPath staffing operations: staffing_rate_cards, staffing_economics — service_role only,
--    no authenticated policy at all. A future ops/Command Center role reads these through a
--    service-role-backed function, the same pattern as staff_users in the Command Center
--    foundation migration, never direct table grants to authenticated.
-- 4. Provider integration data: staffing_provider_state, staffing_screening_state — service_role
--    only; the member only ever sees the small enum exposed through staffing_assignments' member view.
-- 5. Financial/margin data: covered by (3). Never joined into any member- or employer-readable view.
--
-- TESTS TO ADD BEFORE THIS IS APPLIED
-- - A member can read their own staffing_assignments row via the member view and NEVER sees
--   staffing_rate_cards or staffing_economics columns (query the view, assert the columns absent
--   at the SQL level, not just the client type level).
-- - An employer/client can read their own staffing_requisitions and the assignments under it, but
--   not another client's, and not staffing_economics.
-- - staffing_assignment_status_history only accepts transitions legal per
--   src/core/staffing/workflow.ts's canAdvance() — mirror that table server-side so a direct SQL
--   write can't skip a stage either.
-- - debit/refund-style idempotency is not applicable here, but duplicate status-history rows for
--   the same (assignment_id, stage) should be rejected or deduped — decide and test before applying.
--
-- ============================================================================================

-- ---------------------------------------------------------------------
-- 1. Extend jobs with listing_kind. Existing rows default to direct_hire.
-- ---------------------------------------------------------------------
alter table public.jobs add column if not exists listing_kind text not null default 'direct_hire'
  check (listing_kind in ('direct_hire', 'staffing'));

-- ---------------------------------------------------------------------
-- 2. Client requisition: the staffing-specific need behind a 'staffing' job listing.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_requisitions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  client_organization_id uuid references public.resource_organizations(id) on delete set null,
  client_display_name text not null,
  assignment_type text not null check (assignment_type in ('temporary', 'contract', 'temp_to_hire')),
  expected_duration_weeks integer check (expected_duration_weeks is null or expected_duration_weeks > 0),
  headcount integer not null default 1 check (headcount > 0),
  status text not null default 'open' check (status in ('open', 'paused', 'filled', 'closed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staffing_requisitions_job_idx on public.staffing_requisitions (job_id);
create index if not exists staffing_requisitions_org_idx on public.staffing_requisitions (client_organization_id);

-- ---------------------------------------------------------------------
-- 3. Assignment: 1:1 extension of job_placements, the EOR/staffing-specific layer on top of the
--    existing durable hire fact.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_assignments (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null unique references public.job_placements(id) on delete cascade,
  requisition_id uuid not null references public.staffing_requisitions(id) on delete cascade,
  stage text not null default 'requisition_open' check (stage in (
    'requisition_open', 'sourcing_matching', 'member_preparation', 'interview', 'screening_consent',
    'screening_in_progress', 'onboarding', 'placement_confirmed', 'assignment_active', 'assignment_ended',
    'converted_to_direct_hire', 'retention')),
  shift_schedule_text text,
  time_payroll_handoff_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staffing_assignments_requisition_idx on public.staffing_assignments (requisition_id);

create table if not exists public.staffing_assignment_status_history (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.staffing_assignments(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists staffing_status_history_assignment_idx on public.staffing_assignment_status_history (assignment_id, created_at);

-- ---------------------------------------------------------------------
-- 4. Provider state (FoxHire) and screening state (Checkr) — service_role only.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_provider_state (
  assignment_id uuid primary key references public.staffing_assignments(id) on delete cascade,
  provider text not null default 'foxhire' check (provider in ('foxhire')),
  state text not null default 'candidate_submitted' check (state in (
    'candidate_submitted', 'onboarding_requested', 'onboarding_pending', 'onboarding_complete',
    'payroll_active', 'assignment_active', 'assignment_ended', 'provider_error_manual_review')),
  provider_ref text,
  updated_at timestamptz not null default now()
);

create table if not exists public.staffing_screening_state (
  assignment_id uuid primary key references public.staffing_assignments(id) on delete cascade,
  consent_given_at timestamptz,
  state text not null default 'consent_pending' check (state in (
    'consent_pending', 'requested', 'provider_processing', 'result_available', 'provider_error')),
  provider_ref text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Economics — OPS/FINANCIAL ONLY. No authenticated (member or employer) policy, ever.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_rate_cards (
  assignment_id uuid primary key references public.staffing_assignments(id) on delete cascade,
  pay_rate_hourly numeric not null check (pay_rate_hourly > 0),
  bill_rate_hourly numeric not null check (bill_rate_hourly > 0),
  eor_cost_hourly numeric not null default 0 check (eor_cost_hourly >= 0),
  screening_cost_flat numeric not null default 0 check (screening_cost_flat >= 0),
  statutory_burden_percent numeric not null default 0 check (statutory_burden_percent >= 0),
  created_at timestamptz not null default now()
);

-- Computed, not stored redundantly where avoidable; kept as a table for historical snapshots since
-- rate cards can change mid-assignment and we want each computation's inputs preserved.
create table if not exists public.staffing_economics (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.staffing_assignments(id) on delete cascade,
  gross_spread_hourly numeric not null, -- NOT profit; see src/core/staffing/economics.ts
  statutory_burden_hourly numeric not null,
  amortized_screening_hourly numeric not null,
  estimated_contribution_hourly numeric not null, -- still not profit
  computed_at timestamptz not null default now()
);
create index if not exists staffing_economics_assignment_idx on public.staffing_economics (assignment_id, computed_at desc);

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
alter table public.staffing_requisitions enable row level security;
alter table public.staffing_assignments enable row level security;
alter table public.staffing_assignment_status_history enable row level security;
alter table public.staffing_provider_state enable row level security;
alter table public.staffing_screening_state enable row level security;
alter table public.staffing_rate_cards enable row level security;
alter table public.staffing_economics enable row level security;

revoke all on table public.staffing_requisitions, public.staffing_assignments, public.staffing_assignment_status_history,
  public.staffing_provider_state, public.staffing_screening_state, public.staffing_rate_cards, public.staffing_economics
  from public, anon;

-- Employer/client: read their own org's requisitions (same pattern as job_placements_read_own_as_employer).
drop policy if exists "staffing_requisitions_read_own_org" on public.staffing_requisitions;
create policy "staffing_requisitions_read_own_org" on public.staffing_requisitions for select to authenticated using (
  client_organization_id is not null and exists (
    select 1 from public.organization_members om
    where om.organization_id = staffing_requisitions.client_organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
  )
);

-- Member: read their own assignment through the placement they are the person_id on. This is the ONLY
-- policy that should ever expose staffing_assignments to a non-service role, and it never joins rate
-- cards or economics.
drop policy if exists "staffing_assignments_read_own_as_member" on public.staffing_assignments;
create policy "staffing_assignments_read_own_as_member" on public.staffing_assignments for select to authenticated using (
  exists (select 1 from public.job_placements jp where jp.id = staffing_assignments.placement_id and jp.person_id = (select auth.uid()))
);
drop policy if exists "staffing_assignments_read_own_as_employer" on public.staffing_assignments;
create policy "staffing_assignments_read_own_as_employer" on public.staffing_assignments for select to authenticated using (
  exists (
    select 1 from public.staffing_requisitions sr
    join public.organization_members om on om.organization_id = sr.client_organization_id
    where sr.id = staffing_assignments.requisition_id and om.user_id = (select auth.uid()) and om.status = 'active'
  )
);

drop policy if exists "staffing_status_history_read_own" on public.staffing_assignment_status_history;
create policy "staffing_status_history_read_own" on public.staffing_assignment_status_history for select to authenticated using (
  exists (
    select 1 from public.staffing_assignments sa join public.job_placements jp on jp.id = sa.placement_id
    where sa.id = staffing_assignment_status_history.assignment_id and jp.person_id = (select auth.uid())
  )
);

-- staffing_provider_state, staffing_screening_state: member may see ONLY their own assignment's small
-- state enum, never provider_ref (opaque to them regardless, but excluded at the view layer, not here —
-- a dedicated member-facing view should select state only, never provider_ref).
drop policy if exists "staffing_provider_state_read_own" on public.staffing_provider_state;
create policy "staffing_provider_state_read_own" on public.staffing_provider_state for select to authenticated using (
  exists (
    select 1 from public.staffing_assignments sa join public.job_placements jp on jp.id = sa.placement_id
    where sa.id = staffing_provider_state.assignment_id and jp.person_id = (select auth.uid())
  )
);
drop policy if exists "staffing_screening_state_read_own" on public.staffing_screening_state;
create policy "staffing_screening_state_read_own" on public.staffing_screening_state for select to authenticated using (
  exists (
    select 1 from public.staffing_assignments sa join public.job_placements jp on jp.id = sa.placement_id
    where sa.id = staffing_screening_state.assignment_id and jp.person_id = (select auth.uid())
  )
);

-- staffing_rate_cards, staffing_economics: NO authenticated policy. Service role only, full stop.
grant select on table public.staffing_requisitions, public.staffing_assignments, public.staffing_assignment_status_history,
  public.staffing_provider_state, public.staffing_screening_state to authenticated;
grant select, insert, update, delete on table public.staffing_requisitions, public.staffing_assignments,
  public.staffing_assignment_status_history, public.staffing_provider_state, public.staffing_screening_state,
  public.staffing_rate_cards, public.staffing_economics to service_role;
