-- PROPOSED ONLY: do not apply to DEV or production without approval.
-- Authenticated, membership-scoped Partner organization resolver.
-- Returns one row per active organization, ordered deterministically.
-- Capabilities are staff-granted in organization_capabilities, never inferred from role or org_type.
create or replace function public.partner_org_context()
returns table (
  organization_id uuid,
  organization_name text,
  roles text[],
  capabilities text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ro.id as organization_id,
    ro.name as organization_name,
    array[om.member_role]::text[] as roles,
    coalesce((
      select array_agg(oc.capability order by oc.capability)
      from public.organization_capabilities oc
      where oc.organization_id = ro.id
        and oc.status = 'active'
    ), array[]::text[]) as capabilities
  from public.organization_members om
  join public.resource_organizations ro on ro.id = om.organization_id
  where auth.uid() is not null
    and om.user_id = auth.uid()
    and om.status = 'active'
    and ro.status = 'active'
  order by ro.name, ro.id;
$$;
revoke all on function public.partner_org_context() from public, anon;
grant execute on function public.partner_org_context() to authenticated, service_role;
