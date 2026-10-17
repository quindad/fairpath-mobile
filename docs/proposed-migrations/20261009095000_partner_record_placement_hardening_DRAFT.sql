-- PROPOSED ONLY: do not apply to DEV or production without approval.
--
-- Hardens the durable hire-evidence RPC for organization-owned jobs. The
-- legacy individual-employer path is intentionally retained. For organization
-- jobs, the job creator's employer_id alone is not authorization: callers
-- must be an active owner/manager of an active organization with an active
-- employment capability.

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
  v_uid uuid := auth.uid();
  v_app public.job_applications%rowtype;
  v_job public.jobs%rowtype;
  v_allowed boolean := false;
  new_id uuid;
begin
  if v_uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;

  select * into v_app from public.job_applications where id = p_application_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_app.status <> 'hired' then raise exception 'APPLICATION_NOT_HIRED' using errcode = 'P0001'; end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if v_job.organization_id is null then
    -- Existing individual-employer behavior.
    v_allowed := v_job.employer_id = v_uid;
  else
    select exists (
      select 1
      from public.organization_members om
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

  insert into public.job_placements (
    application_id, job_id, person_id, organization_id, employer_id,
    starting_wage, wage_period, employment_type, notes, created_by
  ) values (
    p_application_id, v_app.job_id, v_app.user_id, v_job.organization_id, v_job.employer_id,
    p_starting_wage, p_wage_period, p_employment_type, p_notes, v_uid
  ) on conflict (application_id) do nothing
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.job_placements where application_id = p_application_id;
  end if;
  return new_id;
end;
$$;

-- Defense in depth: a future authenticated UPDATE grant cannot rewrite the
-- durable fact that a particular person was hired for a particular job.
create or replace function public.guard_job_placement_hire_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (
    new.application_id is distinct from old.application_id
    or new.job_id is distinct from old.job_id
    or new.person_id is distinct from old.person_id
    or new.organization_id is distinct from old.organization_id
    or new.employer_id is distinct from old.employer_id
    or new.hired_at is distinct from old.hired_at
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'PLACEMENT_HIRE_EVIDENCE_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.partner_record_placement(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.partner_record_placement(uuid, numeric, text, text, text) to authenticated, service_role;
revoke all on function public.guard_job_placement_hire_evidence() from public, anon, authenticated;
grant execute on function public.guard_job_placement_hire_evidence() to service_role;

drop trigger if exists job_placements_guard_hire_evidence on public.job_placements;
create trigger job_placements_guard_hire_evidence
  before update on public.job_placements
  for each row execute function public.guard_job_placement_hire_evidence();
