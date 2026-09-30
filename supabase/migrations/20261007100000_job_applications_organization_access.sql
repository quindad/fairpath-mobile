-- FairPath Partner, Employer Workspace vertical: the real schema gap found during audit.
--
-- 20261004110000_jobs_housing_organization_ownership.sql extended jobs/housing_listings with an optional
-- organization_id path so an active owner/manager org member can manage a listing alongside the individual
-- employer_id/owner_id column. job_applications and job_application_events were never given the equivalent
-- policy - an org-owned job's applications were only ever visible/manageable through employer_id, which for an
-- org-owned job is just whichever member happened to create the listing, not the organization's team. Purely
-- additive: existing employer_id-based policies are untouched.
--
-- Privacy note carried over unchanged from 20260926130000: job_applications stores only a whitelisted
-- profile/answers blob (name/email/phone/education/skills/resume_ready + the employer's own questions) - no
-- date of birth, address, or justice-history field is ever in this table, so an org gaining application access
-- still never gains exposure to anything beyond what a member explicitly submitted in their own application.

drop policy if exists "Org members read org job applications" on public.job_applications;
create policy "Org members read org job applications" on public.job_applications
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where j.id = job_applications.job_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

drop policy if exists "Org managers update org job applications" on public.job_applications;
create policy "Org managers update org job applications" on public.job_applications
  as permissive for update to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where j.id = job_applications.job_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  )
  with check (
    status = any (array['viewed', 'interview', 'offer', 'hired', 'rejected'])
    and exists (
      select 1 from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where j.id = job_applications.job_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members read org job application events" on public.job_application_events;
create policy "Org members read org job application events" on public.job_application_events
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where j.id = job_application_events.job_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );
