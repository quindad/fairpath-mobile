-- PROPOSED ONLY: do not apply to DEV or production without approval.
--
-- Closes a real gap found by inspection and proven locally
-- (scripts/test-local-partner-record-placement-capability.mjs): the original partner_record_placement()
-- (supabase/migrations/20261007110000_job_placements.sql, already committed) checks org membership/role
-- but never checks organization_capabilities for an active 'employment' capability -- unlike the newer
-- partner_update_job_application_status() RPC, which does. Plain-English version: if staff revokes a
-- company's ability to hire through FairPath, a manager there could still permanently record "we hired this
-- person" as placement evidence. This migration adds the same capability check the status RPC already has,
-- changing nothing else about the function's behavior (same signature, same table, same idempotent
-- on-conflict-do-nothing insert).
create or replace function public.partner_record_placement(
  p_application_id uuid, p_starting_wage numeric default null, p_wage_period text default null,
  p_employment_type text default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_app record;
  v_job record;
  new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;

  select * into v_app from public.job_applications where id = p_application_id;
  if v_app is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_app.status <> 'hired' then raise exception 'APPLICATION_NOT_HIRED' using errcode = 'P0001'; end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not (
    v_job.employer_id = uid
    or (v_job.organization_id is not null and exists (
      select 1 from public.organization_members om
      join public.resource_organizations ro on ro.id = om.organization_id
      join public.organization_capabilities oc on oc.organization_id = om.organization_id
      where om.organization_id = v_job.organization_id
        and om.user_id = uid
        and om.status = 'active'
        and om.member_role in ('owner', 'manager')
        and ro.status = 'active'
        and oc.capability = 'employment'
        and oc.status = 'active'
    ))
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  insert into public.job_placements (application_id, job_id, person_id, organization_id, employer_id, starting_wage, wage_period, employment_type, notes, created_by)
  values (p_application_id, v_app.job_id, v_app.user_id, v_job.organization_id, v_job.employer_id, p_starting_wage, p_wage_period, p_employment_type, p_notes, uid)
  on conflict (application_id) do nothing
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.job_placements where application_id = p_application_id;
  end if;
  return new_id;
end;
$$;
revoke all on function public.partner_record_placement(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.partner_record_placement(uuid, numeric, text, text, text) to authenticated, service_role;

-- Note: the individual-employer path (v_job.organization_id is null, v_job.employer_id = uid) is unchanged --
-- individual employers were never subject to org capability checks and are not part of this gap.
