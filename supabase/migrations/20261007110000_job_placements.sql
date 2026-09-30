-- FairPath Partner, Employer Workspace: the durable "we actually hired this person" record.
--
-- Deliberately NOT derived forever from job_applications.status = 'hired' - a status is a point-in-time flag
-- on a mutable row; a placement is a fact that needs to persist (and later support retention checkpoints)
-- even if the application record is later edited. This table is intentionally minimal - it exists so a future
-- Impact/ROI pass has real historical data to calculate from, not to calculate anything itself. No wage totals,
-- retention percentages, or incentive values are computed here.

create table if not exists public.job_placements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.resource_organizations(id) on delete set null,
  employer_id uuid not null references auth.users(id) on delete cascade,
  hired_at timestamptz not null default now(),
  employment_status text not null default 'active' check (employment_status in ('active', 'ended')),
  ended_at timestamptz,
  starting_wage numeric,
  wage_period text check (wage_period is null or wage_period in ('hourly', 'salary_annual')),
  employment_type text check (employment_type is null or employment_type in ('full_time', 'part_time', 'contract', 'seasonal', 'other')),
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (application_id),
  check (employment_status <> 'ended' or ended_at is not null),
  check (employment_status = 'ended' or ended_at is null)
);
create index if not exists job_placements_org_idx on public.job_placements (organization_id);
create index if not exists job_placements_person_idx on public.job_placements (person_id);
create index if not exists job_placements_job_idx on public.job_placements (job_id);

alter table public.job_placements enable row level security;
revoke all on table public.job_placements from public, anon, authenticated;

drop policy if exists "job_placements_read_own_as_person" on public.job_placements;
create policy "job_placements_read_own_as_person" on public.job_placements
  for select to authenticated using (person_id = (select auth.uid()));

drop policy if exists "job_placements_read_own_as_employer" on public.job_placements;
create policy "job_placements_read_own_as_employer" on public.job_placements
  for select to authenticated using (
    employer_id = (select auth.uid())
    or (organization_id is not null and exists (
      select 1 from public.organization_members om
      where om.organization_id = job_placements.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    ))
  );

grant select on table public.job_placements to authenticated;
grant select, insert, update, delete on table public.job_placements to service_role;

-- Record a hire through the real application. Only an owner/manager of the job's employer_id/organization can
-- do this, and only when the application has genuinely reached status='hired' first (this table records a
-- fact that already happened via the normal status transition - it doesn't grant a second way to mark someone
-- hired without going through the application pipeline).
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
      where om.organization_id = v_job.organization_id and om.user_id = uid and om.status = 'active' and om.member_role in ('owner', 'manager')
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
