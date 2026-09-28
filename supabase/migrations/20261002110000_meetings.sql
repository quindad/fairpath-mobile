-- FairPath meeting/appointment orchestration. NOT a video platform: every meeting is a record FairPath owns (type,
-- time, participants, status, reminders) pointing at an EXTERNAL provider URL (Zoom/Meet/Teams/other) the member or
-- host already has. Deeper provider integration can come later without changing this shape.
--
-- Privacy boundary: a meeting belongs to exactly one member (owner-only, same pattern as every other member_* table).
-- There is no employer or partner read path here. An employer-related meeting (an interview) is still private to the
-- member who owns the row; nothing about it is ever exposed through job/employer tables. Host contact info is
-- whatever the member was given and typed in themselves — FairPath never auto-populates it from another member's data.
create table if not exists public.member_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 160),
  meeting_type text not null check (meeting_type in ('employer_interview', 'nonprofit_appointment', 'caseworker_meeting', 'housing_appointment', 'workshop', 'office_hours', 'other')),
  organization_name text check (organization_name is null or length(organization_name) <= 160),
  host_name text check (host_name is null or length(host_name) <= 160),
  host_contact text check (host_contact is null or length(host_contact) <= 160),
  provider text not null default 'other' check (provider in ('zoom', 'google_meet', 'microsoft_teams', 'phone', 'in_person', 'other')),
  meeting_url text check (meeting_url is null or (length(meeting_url) <= 500 and meeting_url ~* '^https?://')),
  location_text text check (location_text is null or length(location_text) <= 300),
  -- Optional, loose links into other FairPath modules. No foreign key to jobs/resources: those rows can be deleted or
  -- may belong to another member's application context, and a meeting must keep its own history either way.
  related_job_id uuid,
  related_resource_id uuid,
  start_at timestamptz not null,
  end_at timestamptz check (end_at is null or end_at > start_at),
  timezone text not null default 'America/New_York' check (length(timezone) <= 64),
  instructions text check (instructions is null or length(instructions) <= 1500),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_minutes_before integer not null default 60 check (reminder_minutes_before between 0 and 10080),
  cancelled_reason text check (cancelled_reason is null or length(cancelled_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_meetings_user_idx on public.member_meetings (user_id, start_at);

create or replace function public.member_meetings_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists member_meetings_touch_trg on public.member_meetings;
create trigger member_meetings_touch_trg before update on public.member_meetings for each row execute function public.member_meetings_touch();

alter table public.member_meetings enable row level security;

drop policy if exists "member_meetings_owner_select" on public.member_meetings;
create policy "member_meetings_owner_select" on public.member_meetings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "member_meetings_owner_insert" on public.member_meetings;
create policy "member_meetings_owner_insert" on public.member_meetings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "member_meetings_owner_update" on public.member_meetings;
create policy "member_meetings_owner_update" on public.member_meetings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "member_meetings_owner_delete" on public.member_meetings;
create policy "member_meetings_owner_delete" on public.member_meetings for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.member_meetings to authenticated;
grant select, insert, update, delete on table public.member_meetings to service_role;

-- Only a small set of transitions make product sense; anything else is refused rather than silently allowed.
create or replace function public.set_meeting_status(p_id uuid, p_status text, p_reason text default null)
returns public.member_meetings
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m public.member_meetings%rowtype;
  result public.member_meetings%rowtype;
  ok boolean;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_status not in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') then raise exception 'INVALID_STATUS'; end if;
  select * into m from public.member_meetings x where x.id = p_id and x.user_id = uid;
  if not found then raise exception 'MEETING_UNAVAILABLE'; end if;
  ok := (m.status = 'scheduled' and p_status in ('confirmed', 'cancelled'))
     or (m.status = 'confirmed' and p_status in ('completed', 'cancelled', 'no_show'))
     or (m.status = p_status);
  if not ok then raise exception 'INVALID_TRANSITION'; end if;
  update public.member_meetings x set status = p_status, cancelled_reason = case when p_status = 'cancelled' then left(p_reason, 500) else x.cancelled_reason end
   where x.id = p_id returning * into result;
  return result;
end;
$$;
revoke all on function public.set_meeting_status(uuid, text, text) from public, anon;
grant execute on function public.set_meeting_status(uuid, text, text) to authenticated, service_role;
