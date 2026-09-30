-- Found via real Partner Browser QA: resource_organizations has zero authenticated grant (by original design -
-- only service_role could read it, because only Command Center existed as a client). Partner is a real
-- anon-key + RLS client now (never service-role - see 20261005100000), and requireMember() needs to show a
-- signed-in org member their own organization's name. Additive only: a member may read organizations they are
-- an ACTIVE member of, never any other organization - this is the same tenant boundary every other
-- organization_members-scoped policy in this codebase already uses (jobs/housing/organization_person_links).

drop policy if exists "resource_organizations_read_own_membership" on public.resource_organizations;
create policy "resource_organizations_read_own_membership" on public.resource_organizations
  for select to authenticated using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = resource_organizations.id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

grant select on table public.resource_organizations to authenticated;
