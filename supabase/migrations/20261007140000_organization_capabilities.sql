-- Organization capabilities: replaces org_type as the signal Partner's workspace resolver uses.
--
-- Why not a new org_type value: an organization can legitimately be more than one thing (a reentry
-- nonprofit that also owns transitional housing; an employer running a training program). org_type stays as
-- the organization's descriptive/contextual identity (unchanged, still used for display); capabilities are
-- the many-to-many, deliberately-granted signal that actually drives which Partner workspace sections a member
-- can see. Tight initial set only - not every capability anyone might eventually want: employment, housing,
-- case_management.
--
-- Deliberately staff-granted, not self-declared: an organization does not get to claim "we do housing" by
-- flipping its own flag - that's a trust/verification concept (verified_at/verified_by), matching how
-- resource_organizations.status already works (service-role only). Partner members get read-only visibility
-- into their own org's capabilities; granting happens from Command Center or service-role tooling, not here.

create table if not exists public.organization_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  capability text not null check (capability in ('employment', 'housing', 'case_management')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, capability)
);
create index if not exists organization_capabilities_org_idx on public.organization_capabilities (organization_id, status);

alter table public.organization_capabilities enable row level security;
revoke all on table public.organization_capabilities from public, anon, authenticated;

drop policy if exists "organization_capabilities_read_own" on public.organization_capabilities;
create policy "organization_capabilities_read_own" on public.organization_capabilities
  for select to authenticated using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_capabilities.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

grant select on table public.organization_capabilities to authenticated;
grant select, insert, update, delete on table public.organization_capabilities to service_role;
