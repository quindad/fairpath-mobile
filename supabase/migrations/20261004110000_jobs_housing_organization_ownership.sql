-- Phase 2 of the boardroom sprint: extend the REAL, already-existing Organization model
-- (resource_organizations / organization_members, built for Resources) to Jobs and Housing ownership,
-- instead of inventing a second, competing organization concept.
--
-- Design goal: purely additive. Every existing single-owner (employer_id / owner_id = auth.uid()) policy,
-- grant, search function, and DEV fixture keeps working byte-for-byte unchanged. Organization ownership is a
-- SECOND, optional path layered on top via nullable columns + new RLS policies (Postgres OR's multiple
-- permissive policies together, so adding a policy can only ADD access, never remove existing access).
--
-- Read in full before writing this: resource_organizations/organization_members
-- (20261001100000_resources_core.sql) and the existing jobs/housing_listings owner policies
-- (20260901000100_baseline_constraints_security_logic.sql lines ~1292-1360). Confirmed today: table-level
-- grants already cover insert/select/update/delete for `authenticated` on both tables — RLS is the only gate,
-- so no grant changes are needed here, only new policies.

alter table public.jobs
  add column if not exists organization_id uuid references public.resource_organizations(id) on delete set null;
alter table public.housing_listings
  add column if not exists organization_id uuid references public.resource_organizations(id) on delete set null;

create index if not exists jobs_organization_idx on public.jobs (organization_id) where organization_id is not null;
create index if not exists housing_listings_organization_idx on public.housing_listings (organization_id) where organization_id is not null;

comment on column public.jobs.organization_id is
  'Optional. NULL means this listing is owned by an individual (employer_id), exactly as before this migration. '
  'When set, an active owner/manager member of that organization may manage it in addition to employer_id. '
  'Never implies anything about the individual employer_id column, which remains required and unchanged.';
comment on column public.housing_listings.organization_id is
  'Optional. NULL means this listing is owned by an individual (owner_id), exactly as before this migration. '
  'When set, an active owner/manager member of that organization may manage it in addition to owner_id.';

-- ---------------------------------------------------------------------
-- Close a real gap found while testing this migration locally: employer_id/owner_id policies were written
-- before organization_id existed, so they say nothing about it. Since employer_id = auth.uid() alone still
-- satisfies them, ANY authenticated user could insert/update a job or listing with employer_id = themselves
-- but organization_id = a REAL org they have no membership in - a forged record that would then appear to real
-- org members via the new "Org members read org jobs/housing" policies below, impersonating that organization.
-- Fix: the individual owner/employer path is only valid when organization_id is null (true for every row that
-- existed before this migration); the organization path is the ONLY way to set organization_id from here on.
-- ---------------------------------------------------------------------
drop policy if exists "Employers create own jobs" on public.jobs;
create policy "Employers create own jobs" on public.jobs
  as permissive for insert to authenticated
  with check (employer_id = (select auth.uid()) and organization_id is null);

drop policy if exists "Employers update own jobs" on public.jobs;
create policy "Employers update own jobs" on public.jobs
  as permissive for update to authenticated
  using (employer_id = (select auth.uid()) and organization_id is null)
  with check (employer_id = (select auth.uid()) and organization_id is null);

-- Delete, too: without this, a user whose employer_id/owner_id was recorded on an org job/listing (because
-- they created it while an active manager) could still delete it later via the individual policy alone even
-- after being removed from the organization - the org policy correctly re-checks membership, the individual
-- one must not be allowed to bypass that by matching on employer_id/owner_id.
drop policy if exists "Employers delete own jobs" on public.jobs;
create policy "Employers delete own jobs" on public.jobs
  as permissive for delete to authenticated
  using (employer_id = (select auth.uid()) and organization_id is null);

drop policy if exists "Owners delete housing" on public.housing_listings;
create policy "Owners delete housing" on public.housing_listings
  as permissive for delete to authenticated
  using (owner_id = (select auth.uid()) and organization_id is null);

drop policy if exists "Owners create housing" on public.housing_listings;
create policy "Owners create housing" on public.housing_listings
  as permissive for insert to authenticated
  with check (owner_id = (select auth.uid()) and organization_id is null);

drop policy if exists "Owners update housing" on public.housing_listings;
create policy "Owners update housing" on public.housing_listings
  as permissive for update to authenticated
  using (owner_id = (select auth.uid()) and organization_id is null)
  with check (owner_id = (select auth.uid()) and organization_id is null);

-- ---------------------------------------------------------------------
-- Jobs: additive organization-scoped policies (existing employer_id policies untouched).
-- ---------------------------------------------------------------------
drop policy if exists "Org members create org jobs" on public.jobs;
create policy "Org members create org jobs" on public.jobs
  as permissive for insert to authenticated
  with check (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = jobs.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members update org jobs" on public.jobs;
create policy "Org members update org jobs" on public.jobs
  as permissive for update to authenticated
  using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = jobs.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  )
  with check (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = jobs.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members delete org jobs" on public.jobs;
create policy "Org members delete org jobs" on public.jobs
  as permissive for delete to authenticated
  using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = jobs.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

-- Any active org member (including 'editor') may VIEW their own org's jobs regardless of publish status -
-- read is lower-risk than write, and an editor should be able to see drafts to prepare them.
drop policy if exists "Org members read org jobs" on public.jobs;
create policy "Org members read org jobs" on public.jobs
  as permissive for select to authenticated
  using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = jobs.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

-- ---------------------------------------------------------------------
-- Housing: identical additive shape (existing owner_id policies untouched).
-- ---------------------------------------------------------------------
drop policy if exists "Org members create org housing" on public.housing_listings;
create policy "Org members create org housing" on public.housing_listings
  as permissive for insert to authenticated
  with check (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = housing_listings.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members update org housing" on public.housing_listings;
create policy "Org members update org housing" on public.housing_listings
  as permissive for update to authenticated
  using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = housing_listings.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  )
  with check (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = housing_listings.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members delete org housing" on public.housing_listings;
create policy "Org members delete org housing" on public.housing_listings
  as permissive for delete to authenticated
  using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = housing_listings.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members read org housing" on public.housing_listings;
create policy "Org members read org housing" on public.housing_listings
  as permissive for select to authenticated
  using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = housing_listings.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

-- Ordinary members never gain organization-management privilege merely by being authenticated: every policy
-- above requires a matching row in organization_members with status='active', which nothing grants
-- automatically - membership is only ever service_role-inserted today (no self-serve join path exists),
-- exactly like resource_organizations already works.
