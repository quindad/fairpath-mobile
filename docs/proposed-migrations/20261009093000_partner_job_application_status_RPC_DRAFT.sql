-- PROPOSED ONLY: do not apply without approval.
-- Harden employer status mutations; retain member withdrawal RPC.
-- Migration assumes existing 20261009053401 immutable-field trigger.
revoke update on public.job_applications from authenticated;
drop policy if exists "Org managers update org job applications" on public.job_applications;
drop policy if exists "Employers update applications for own jobs" on public.job_applications;
drop policy if exists "Applicants may withdraw own applications" on public.job_applications;

create or replace function public.partner_update_job_application_status(
  p_application_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.job_applications%rowtype;
  v_job public.jobs%rowtype;
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'SIGNED_OUT' using errcode = 'P0001';
  end if;
  if p_status is null or p_status not in ('viewed', 'interview', 'offer', 'hired', 'rejected') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_app from public.job_applications where id = p_application_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if v_job.organization_id is null then
    v_allowed := v_job.employer_id = v_uid;
  else
    select exists (
      select 1 from public.organization_members om
      join public.resource_organizations ro on ro.id = om.organization_id
      join public.organization_capabilities oc on oc.organization_id = om.organization_id
      where om.organization_id = v_job.organization_id
        and om.user_id = v_uid
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
        and ro.status = 'active'
        and oc.capability = 'employment'
        and oc.status = 'active'
    ) into v_allowed;
  end if;
  if not v_allowed then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;

  if not (
    (v_app.status = 'submitted' and p_status in ('viewed', 'rejected'))
    or (v_app.status = 'viewed' and p_status in ('interview', 'rejected'))
    or (v_app.status = 'interview' and p_status in ('offer', 'rejected'))
    or (v_app.status = 'offer' and p_status in ('hired', 'rejected'))
  ) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001';
  end if;

  update public.job_applications
     set status = p_status, updated_at = now()
   where id = p_application_id;
  -- Existing AFTER UPDATE OF status trigger writes the application event.
end;
$$;
revoke all on function public.partner_update_job_application_status(uuid,text) from public, anon;
grant execute on function public.partner_update_job_application_status(uuid,text) to authenticated, service_role;

-- SECURITY DEFINER withdrawal function remains granted to authenticated.
-- Revoke direct table UPDATE even if a future permissive RLS policy is added.
