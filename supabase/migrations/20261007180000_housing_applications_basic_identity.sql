-- Product-pass finding: partner_housing_applications_for_listing() (20261007130000) excludes ALL profile
-- information, not just the sensitive fields - a housing provider sees a raw UUID instead of a name. That
-- was broader than necessary: this codebase already has an established classification (see
-- organization_person_links, 20261005100000) distinguishing 'basic' identity (name/contact - safe to show once
-- authorized) from 'case_management' and the never-granted 'highly_sensitive' tier. A housing provider
-- reviewing a real application is exactly the "authorized" case basic identity is meant for - CRM and Employer
-- already show real names under the same reasoning. This migration adds ONLY first_name/last_name (from
-- profiles, never from the applicant's answers/applicant_snapshot/consent_snapshot) to the curated projection -
-- it does not touch DOB, address, documents, or any other sensitive field, and does not grant any new table
-- access (profiles has no direct grant to authenticated here; this is still only reachable through the
-- security-definer function, same as before).

drop function if exists public.partner_housing_applications_for_listing(uuid);

create function public.partner_housing_applications_for_listing(p_listing_id uuid)
returns table (
  id uuid, user_id uuid, first_name text, last_name text, listing_id uuid, application_type text, status text,
  submitted_at timestamptz, current_step integer, partner_note text, status_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.user_id, p.first_name, p.last_name, a.listing_id, a.application_type, a.status, a.submitted_at, a.current_step, a.partner_note, a.status_reason
  from public.housing_applications a
  join public.housing_listings h on h.id = a.listing_id
  left join public.profiles p on p.id = a.user_id
  where a.listing_id = p_listing_id
    and (
      h.owner_id = auth.uid()
      or (h.organization_id is not null and exists (
        select 1 from public.organization_members om
        where om.organization_id = h.organization_id and om.user_id = auth.uid() and om.status = 'active'
      ))
    )
  order by a.submitted_at desc nulls last, a.id;
$$;
revoke all on function public.partner_housing_applications_for_listing(uuid) from public, anon;
grant execute on function public.partner_housing_applications_for_listing(uuid) to authenticated, service_role;
