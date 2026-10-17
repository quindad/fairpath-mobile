-- Job application content belongs to the applicant at submission time. Employers and
-- organization managers may progress review status, but must never be able to rewrite
-- the applicant, target job, answers, or submission time while doing so.
create or replace function public.guard_job_application_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Administrative/service workflows retain their existing repair capability. The
  -- client-facing authenticated role may change only status and updated_at.
  if auth.role() <> 'service_role' and (
    new.user_id is distinct from old.user_id
    or new.job_id is distinct from old.job_id
    or new.answers is distinct from old.answers
    or new.submitted_at is distinct from old.submitted_at
    or new.id is distinct from old.id
  ) then
    raise exception 'JOB_APPLICATION_IMMUTABLE_FIELDS' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_job_application_update() from public, anon, authenticated;
grant execute on function public.guard_job_application_update() to service_role;

drop trigger if exists job_applications_guard_update on public.job_applications;
create trigger job_applications_guard_update
  before update on public.job_applications
  for each row execute function public.guard_job_application_update();
