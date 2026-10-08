-- Retention Engine, foundation pass.
--
-- Audited first (no duplication): job_placements already has hired_at/employment_status/ended_at - this is the
-- START event, never re-modeled here. impact_evidence already has a trigger-per-event-type pattern - extended,
-- not replaced. participant_needs/referrals already form the CRM Need->Referral->Outcome loop - a retention
-- support request becomes a Need through the SAME loop, never a second one. user_notifications already exists -
-- reused for reminders, no second notification system.
--
-- retention_checkpoint_types is a lookup table (same pattern as program_domains) so DAY 365 is an insert, never
-- a schema change.

create table public.retention_checkpoint_types (
  code text primary key,
  days_after_start integer not null,
  display_name text not null,
  active boolean not null default true
);
insert into public.retention_checkpoint_types (code, days_after_start, display_name) values
  ('day_7', 7, '7-day check'), ('day_30', 30, '30-day check'), ('day_60', 60, '60-day check'),
  ('day_90', 90, '90-day check'), ('day_180', 180, '180-day check');

create table public.retention_checkpoints (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.job_placements(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.resource_organizations(id) on delete set null,
  checkpoint_type text not null references public.retention_checkpoint_types(code),
  due_at date not null,
  status text not null default 'due' check (status in ('due', 'confirmed_active', 'at_risk', 'ended', 'unable_to_verify', 'missed')),
  completed_at timestamptz,
  verification_source text check (verification_source in ('member', 'employer', 'case_manager', 'system', null)),
  verification_method text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id, checkpoint_type)
);
comment on table public.retention_checkpoints is
  'Operational, employer-safe. Carries NO private free text - a member''s explanation of a support need never '
  'lives here, only in retention_support_requests, which the employer has zero access to. Unknown stays honest: '
  'no-response is never auto-interpreted as ended (status stays due/unable_to_verify, never silently ended).';
create index retention_checkpoints_person_idx on public.retention_checkpoints (person_id);
create index retention_checkpoints_org_idx on public.retention_checkpoints (organization_id);
create index retention_checkpoints_due_idx on public.retention_checkpoints (status, due_at) where status = 'due';

-- Private layer. The employer table above never references this; there is no join path from an employer's RLS
-- policy to this table's rows. CRM access is granted the same way Caseload already is - an active
-- organization_person_links row, never a new authorization concept.
create table public.retention_support_requests (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid references public.retention_checkpoints(id) on delete set null,
  person_id uuid not null references auth.users(id) on delete cascade,
  placement_id uuid not null references public.job_placements(id) on delete cascade,
  category text not null check (category in (
    'transportation', 'childcare', 'schedule', 'work_clothing_equipment', 'training',
    'financial_emergency', 'housing_instability', 'employer_reported_concern', 'other'
  )),
  detail text check (detail is null or length(detail) <= 1000),
  status text not null default 'open' check (status in ('open', 'linked_to_need', 'closed')),
  linked_need_id uuid references public.participant_needs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.retention_support_requests is
  'Member-private. detail is the member''s own words about what they need - never readable by any employer RLS '
  'policy (there is none granting employer access to this table). An authorized CRM org (active '
  'organization_person_links to this person) may see it and link it to a real participant_needs row, reusing '
  'the existing Need->Referral->Outcome loop rather than building a parallel one.';
create index retention_support_requests_person_idx on public.retention_support_requests (person_id);

alter table public.retention_checkpoint_types enable row level security;
alter table public.retention_checkpoints enable row level security;
alter table public.retention_support_requests enable row level security;
revoke all on table public.retention_checkpoint_types, public.retention_checkpoints, public.retention_support_requests from public, anon, authenticated;

create policy "retention_checkpoint_types_read_all" on public.retention_checkpoint_types for select to authenticated using (true);
grant select on table public.retention_checkpoint_types to authenticated;
grant select, insert, update, delete on table public.retention_checkpoint_types to service_role;

-- Member reads their own. Employer org reads their own org's checkpoints (operational fields only - this table
-- has no private text to leak). Never any write grant to authenticated - every mutation goes through a
-- security-definer RPC below, which re-checks the caller's actual relationship to the row every time.
create policy "retention_checkpoints_read_own_as_person" on public.retention_checkpoints
  for select to authenticated using (person_id = (select auth.uid()));
create policy "retention_checkpoints_read_own_as_org" on public.retention_checkpoints
  for select to authenticated using (
    organization_id is not null and exists (
      select 1 from public.organization_members om where om.organization_id = retention_checkpoints.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );
grant select on table public.retention_checkpoints to authenticated;
grant select, insert, update, delete on table public.retention_checkpoints to service_role;

-- Member reads only their own support requests directly. CRM read happens through a curated RPC below (same
-- 'basic'/'case_management' pattern as Caseload), never a direct table policy for organizations, since the
-- person-authorization check requires joining organization_person_links.
create policy "retention_support_requests_read_own_as_person" on public.retention_support_requests
  for select to authenticated using (person_id = (select auth.uid()));
grant select on table public.retention_support_requests to authenticated;
grant select, insert, update, delete on table public.retention_support_requests to service_role;

-- Auto-creates the 5 required checkpoints the moment a real placement is recorded - never depends on a human
-- remembering. Proper date arithmetic (hired_at::date + N), no hardcoded examples.
create or replace function public.retention_create_checkpoints_for_placement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.retention_checkpoints (placement_id, person_id, organization_id, checkpoint_type, due_at)
  select new.id, new.person_id, new.organization_id, t.code, (new.hired_at::date + t.days_after_start)
  from public.retention_checkpoint_types t
  where t.active = true
  on conflict (placement_id, checkpoint_type) do nothing;
  return new;
end;
$$;
drop trigger if exists job_placements_create_retention_checkpoints on public.job_placements;
create trigger job_placements_create_retention_checkpoints after insert on public.job_placements
  for each row execute function public.retention_create_checkpoints_for_placement();
revoke all on function public.retention_create_checkpoints_for_placement() from public, anon, authenticated;
grant execute on function public.retention_create_checkpoints_for_placement() to service_role;

-- Member check-in. status_report: 'still_working' | 'ended' | 'support_needed'. A support request's detail text
-- stays in retention_support_requests, never written to the checkpoint row an employer can read.
create or replace function public.member_confirm_retention_checkpoint(
  p_checkpoint_id uuid, p_status_report text, p_support_category text default null, p_support_detail text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
  v_placement_id uuid;
begin
  if p_status_report not in ('still_working', 'ended', 'support_needed') then raise exception 'INVALID_STATUS_REPORT'; end if;
  select person_id, placement_id into v_person_id, v_placement_id from public.retention_checkpoints where id = p_checkpoint_id;
  if v_person_id is null then raise exception 'NOT_FOUND'; end if;
  if v_person_id <> auth.uid() then raise exception 'NOT_AUTHORIZED'; end if;

  if p_status_report = 'still_working' then
    update public.retention_checkpoints set status = 'confirmed_active', completed_at = now(), verification_source = 'member', verification_method = 'member_self_report', updated_at = now() where id = p_checkpoint_id;
  elsif p_status_report = 'ended' then
    update public.retention_checkpoints set status = 'ended', completed_at = now(), verification_source = 'member', verification_method = 'member_self_report', updated_at = now() where id = p_checkpoint_id;
  elsif p_status_report = 'support_needed' then
    if p_support_category is null then raise exception 'SUPPORT_CATEGORY_REQUIRED'; end if;
    update public.retention_checkpoints set status = 'at_risk', completed_at = now(), verification_source = 'member', verification_method = 'member_self_report', updated_at = now() where id = p_checkpoint_id;
    insert into public.retention_support_requests (checkpoint_id, person_id, placement_id, category, detail)
    values (p_checkpoint_id, v_person_id, v_placement_id, p_support_category, p_support_detail);
  end if;
end;
$$;
revoke all on function public.member_confirm_retention_checkpoint(uuid, text, text, text) from public, anon;
grant execute on function public.member_confirm_retention_checkpoint(uuid, text, text, text) to authenticated, service_role;

-- Employer check-in. No free-text detail accepted from the employer - 'support_needed' creates only a generic,
-- category-less flag (category='employer_reported_concern', detail=null), never lets an employer write
-- something that could become sensitive-adjacent text in a system a case manager will later read.
create or replace function public.employer_confirm_retention_checkpoint(p_checkpoint_id uuid, p_status_report text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_person_id uuid;
  v_placement_id uuid;
begin
  if p_status_report not in ('confirmed_active', 'ended', 'support_needed') then raise exception 'INVALID_STATUS_REPORT'; end if;
  select organization_id, person_id, placement_id into v_org_id, v_person_id, v_placement_id from public.retention_checkpoints where id = p_checkpoint_id;
  if v_org_id is null then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id = v_org_id and om.user_id = auth.uid() and om.status = 'active') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if p_status_report = 'confirmed_active' then
    update public.retention_checkpoints set status = 'confirmed_active', completed_at = now(), verification_source = 'employer', verification_method = 'employer_self_report', updated_at = now() where id = p_checkpoint_id;
  elsif p_status_report = 'ended' then
    update public.retention_checkpoints set status = 'ended', completed_at = now(), verification_source = 'employer', verification_method = 'employer_self_report', updated_at = now() where id = p_checkpoint_id;
  elsif p_status_report = 'support_needed' then
    update public.retention_checkpoints set status = 'at_risk', verification_source = 'employer', verification_method = 'employer_self_report', updated_at = now() where id = p_checkpoint_id;
    insert into public.retention_support_requests (checkpoint_id, person_id, placement_id, category, detail)
    values (p_checkpoint_id, v_person_id, v_placement_id, 'employer_reported_concern', null);
  end if;
end;
$$;
revoke all on function public.employer_confirm_retention_checkpoint(uuid, text) from public, anon;
grant execute on function public.employer_confirm_retention_checkpoint(uuid, text) to authenticated, service_role;

-- Curated CRM read, mirroring partner_caseload_for_organization's pattern exactly: only persons with an active
-- organization_person_links row to the calling org, and only non-sensitive operational fields plus the support
-- request's own detail (which the person has already implicitly made visible to their case-management org by
-- being on that org's caseload - same boundary as every other CRM read in this codebase).
create or replace function public.partner_retention_for_organization(p_organization_id uuid)
returns table (
  checkpoint_id uuid, placement_id uuid, person_id uuid, first_name text, last_name text, checkpoint_type text,
  due_at date, status text, completed_at timestamptz, support_request_id uuid, support_category text, support_detail text, support_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.placement_id, c.person_id, p.first_name, p.last_name, c.checkpoint_type, c.due_at, c.status, c.completed_at,
    sr.id, sr.category, sr.detail, sr.status
  from public.retention_checkpoints c
  join public.profiles p on p.id = c.person_id
  left join public.retention_support_requests sr on sr.checkpoint_id = c.id
  where exists (
    select 1 from public.organization_person_links l
    where l.organization_id = p_organization_id and l.person_id = c.person_id and l.status = 'active'
      and 'case_management' = any(l.data_scope)
  )
  and exists (
    select 1 from public.organization_members om where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active'
  )
  order by c.due_at;
$$;
revoke all on function public.partner_retention_for_organization(uuid) from public, anon;
grant execute on function public.partner_retention_for_organization(uuid) to authenticated, service_role;

-- Idempotent reminder sweep: finds checkpoints due within 2 days (or already overdue) that haven't been
-- reminded yet, notifies the member once, and marks reminder_sent_at so a repeat sweep never double-sends.
create or replace function public.retention_send_checkpoint_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with due_soon as (
    select c.id, c.person_id, c.due_at, t.display_name
    from public.retention_checkpoints c
    join public.retention_checkpoint_types t on t.code = c.checkpoint_type
    where c.status = 'due' and c.reminder_sent_at is null and c.due_at <= (current_date + 2)
  ), inserted as (
    insert into public.user_notifications (user_id, category, title, body, route, metadata)
    select person_id, 'retention_checkin', 'How''s the job going?', format('Your %s is coming up. Let FairPath know how it''s going.', display_name), '/retention-checkin?checkpoint=' || id, jsonb_build_object('checkpoint_id', id)
    from due_soon
    returning 1
  )
  select count(*) into v_count from inserted;

  update public.retention_checkpoints set reminder_sent_at = now()
  where id in (select id from public.retention_checkpoints c where c.status = 'due' and c.reminder_sent_at is null and c.due_at <= (current_date + 2));

  -- Overdue, never confirmed, never flagged - move to a safe UNKNOWN state (never auto-interpreted as ended).
  update public.retention_checkpoints set status = 'unable_to_verify', updated_at = now()
  where status = 'due' and due_at < (current_date - 14);

  return v_count;
end;
$$;
revoke all on function public.retention_send_checkpoint_reminders() from public, anon, authenticated;
grant execute on function public.retention_send_checkpoint_reminders() to service_role;

select cron.schedule('retention-checkpoint-reminders', '0 13 * * *', 'select public.retention_send_checkpoint_reminders()');

-- Extends the existing Impact Evidence ledger (never a second provenance model). Only CONFIRMED_ACTIVE at a
-- checkpoint counts as retention evidence - at_risk/unable_to_verify/missed are explicitly NOT evidence of
-- anything, per the standing rule that unknown must never become a fabricated fact.
alter table public.impact_evidence drop constraint if exists impact_evidence_evidence_type_check;
alter table public.impact_evidence add constraint impact_evidence_evidence_type_check check (evidence_type in (
  'employment_hire', 'housing_approval', 'referral_completed', 'service_delivered', 'campaign_recipient',
  'employment_7_day_retention', 'employment_30_day_retention', 'employment_60_day_retention',
  'employment_90_day_retention', 'employment_180_day_retention'
));

create or replace function public.record_impact_evidence_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_evidence_type text;
begin
  if new.status = 'confirmed_active' and (old.status is distinct from 'confirmed_active') and new.organization_id is not null then
    v_evidence_type := case new.checkpoint_type
      when 'day_7' then 'employment_7_day_retention'
      when 'day_30' then 'employment_30_day_retention'
      when 'day_60' then 'employment_60_day_retention'
      when 'day_90' then 'employment_90_day_retention'
      when 'day_180' then 'employment_180_day_retention'
      else null
    end;
    if v_evidence_type is not null then
      insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
      values (new.organization_id, new.person_id, v_evidence_type, 'retention_checkpoints', new.id, now())
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists retention_checkpoints_record_evidence on public.retention_checkpoints;
create trigger retention_checkpoints_record_evidence after update of status on public.retention_checkpoints
  for each row execute function public.record_impact_evidence_retention();
revoke all on function public.record_impact_evidence_retention() from public, anon, authenticated;
grant execute on function public.record_impact_evidence_retention() to service_role;
