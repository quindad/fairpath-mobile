-- Product-pass finding: the Referrals workspace resolved person names with a raw `profiles` select, which has
-- no cross-user RLS read policy (correct - case managers don't get a blanket profile read), so it silently
-- returned nothing and fell back to showing the raw person_id UUID. Same bug class already fixed for Caseload
-- (reuse of partner_caseload_for_organization) and Housing (20261007180000) - this is the same 'basic' identity
-- classification (see 20261005100000_organization_person_relationships.sql) applied to the fourth place it was
-- missed. A referral the organization sent or received is exactly the authorized relationship 'basic' identity
-- is meant for - no new authorization concept, no new data exposed beyond first_name/last_name.

create or replace function public.partner_referral_participants_for_organization(p_organization_id uuid)
returns table (person_id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.first_name, p.last_name
  from public.referrals r
  join public.profiles p on p.id = r.person_id
  where (r.from_organization_id = p_organization_id or r.to_organization_id = p_organization_id)
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active'
    );
$$;
revoke all on function public.partner_referral_participants_for_organization(uuid) from public, anon;
grant execute on function public.partner_referral_participants_for_organization(uuid) to authenticated, service_role;
