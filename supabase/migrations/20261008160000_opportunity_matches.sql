-- Program Scout foundation, step 3: the canonical match/assessment record, context-type-agnostic (member, job,
-- housing lease/application, CRM need) and domain-agnostic, so one engine serves Mobile/Employer/Housing/CRM
-- instead of a separate assessment table per surface. Supersedes incentive_assessment_programs/incentive_claims
-- (20261008100000) as the forward-looking matching table - those tables are left in place (zero rows, harmless)
-- rather than destructively migrated, since no real data exists in them yet.
--
-- Deliberately carries NO sensitive fields - no justice-history text, no case notes, nothing beyond what a
-- permitted viewer may already see. Privacy is enforced by what this table CAN contain, not only by a read
-- policy: there is structurally nothing here for a read policy to accidentally leak.

create table public.opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('member', 'job', 'housing_application', 'housing_lease', 'need')),
  context_id uuid not null,
  -- Exactly one of these is set, matching who may ever read this row - a member's own opportunity, or an
  -- organization's (job/housing/need) opportunity. Never both, never neither.
  member_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.resource_organizations(id) on delete cascade,
  program_id uuid not null references public.incentive_programs(id) on delete cascade,
  rule_version_id uuid not null references public.incentive_program_rule_versions(id) on delete restrict,
  geography_match_basis jsonb not null default '{}'::jsonb,
  match_status text not null default 'potential_match' check (match_status in (
    'potential_match', 'likely_match', 'needs_information', 'verified_eligible', 'application_started',
    'submitted', 'approved', 'received_realized', 'expired', 'unavailable', 'not_eligible'
  )),
  missing_information text[] not null default '{}',
  estimated_value numeric,
  estimated_value_note text,
  approved_value numeric,
  realized_value numeric,
  bond_coverage_value numeric,
  next_action text,
  deadline_at date,
  assessed_at timestamptz not null default now(),
  stale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((member_id is not null) <> (organization_id is not null)),
  unique (context_type, context_id, program_id)
);
comment on table public.opportunity_matches is
  'Canonical per-context opportunity match. match_status distinctions (potential vs likely vs verified vs '
  'approved vs realized) must never be collapsed into one field or one dollar figure - estimated_value, '
  'approved_value, realized_value, and bond_coverage_value are kept separate for the same reason '
  'incentive_claims keeps them separate.';

create index opportunity_matches_member_idx on public.opportunity_matches (member_id) where member_id is not null;
create index opportunity_matches_org_idx on public.opportunity_matches (organization_id) where organization_id is not null;
create index opportunity_matches_context_idx on public.opportunity_matches (context_type, context_id);
create index opportunity_matches_stale_idx on public.opportunity_matches (stale) where stale = true;

alter table public.opportunity_matches enable row level security;
revoke all on table public.opportunity_matches from public, anon, authenticated;

create policy "opportunity_matches_read_own_as_member" on public.opportunity_matches
  for select to authenticated using (member_id = (select auth.uid()));

create policy "opportunity_matches_read_own_as_org_member" on public.opportunity_matches
  for select to authenticated using (
    organization_id is not null and exists (
      select 1 from public.organization_members om
      where om.organization_id = opportunity_matches.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );

grant select on table public.opportunity_matches to authenticated;
grant select, insert, update, delete on table public.opportunity_matches to service_role;
