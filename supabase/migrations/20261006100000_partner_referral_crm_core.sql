-- FairPath Partner CRM core: the closed-loop referral workflow.
-- PERSON -> NEED -> REFERRAL -> RECEIVING ORG -> ACCEPT/DECLINE -> IN PROGRESS -> OUTCOME -> FOLLOW-UP -> CLOSED.
--
-- Builds directly on 20261005100000_organization_person_relationships.sql. A need can only be created by an
-- organization that already holds an active case_management-scope link to the person (no new access path is
-- opened here). A referral automatically grants the RECEIVING organization a narrow, purpose-specific link
-- when accepted - closing the loop on "how does Org B get authorized to see Marcus" without a human re-typing
-- a second consent flow. Every write goes through a security-definer RPC (same shape as
-- partner_link_person_to_organization) - no direct insert/update grant to authenticated on any table here.

create table if not exists public.participant_needs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  need_type text not null check (need_type in (
    'employment', 'housing', 'transportation', 'identification', 'food',
    'education_training', 'legal_assistance', 'record_relief', 'financial_services', 'other'
  )),
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (status <> 'closed' or closed_at is not null),
  check (status = 'closed' or closed_at is null)
);
create index if not exists participant_needs_org_idx on public.participant_needs (organization_id, status);
create index if not exists participant_needs_person_idx on public.participant_needs (person_id, status);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.participant_needs(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  need_type text not null,
  from_organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  to_organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'in_progress', 'completed', 'closed')),
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  check (from_organization_id <> to_organization_id)
);
create index if not exists referrals_from_org_idx on public.referrals (from_organization_id, status);
create index if not exists referrals_to_org_idx on public.referrals (to_organization_id, status);
create index if not exists referrals_person_idx on public.referrals (person_id);
create index if not exists referrals_need_idx on public.referrals (need_id);

create table if not exists public.referral_outcomes (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  outcome_type text not null check (outcome_type in (
    'employment_obtained', 'housing_obtained', 'service_delivered', 'training_completed',
    'documentation_obtained', 'assistance_unsuccessful', 'participant_disengaged', 'other'
  )),
  notes text check (notes is null or length(notes) <= 1000),
  recorded_by uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now()
);
create index if not exists referral_outcomes_referral_idx on public.referral_outcomes (referral_id);

create table if not exists public.referral_follow_ups (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  kind text not null check (kind in ('30_day', '60_day', '90_day', '6_month', '12_month', 'other')),
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped')),
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  check (status <> 'completed' or completed_at is not null)
);
create index if not exists referral_follow_ups_referral_idx on public.referral_follow_ups (referral_id, status);
create index if not exists referral_follow_ups_due_idx on public.referral_follow_ups (due_at) where status = 'scheduled';

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  event_type text not null check (event_type in (
    'need_created', 'referral_sent', 'referral_accepted', 'referral_declined',
    'service_started', 'outcome_recorded', 'follow_up_scheduled', 'follow_up_completed', 'referral_closed'
  )),
  actor_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists referral_events_referral_idx on public.referral_events (referral_id, created_at);

create or replace function public.referral_events_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'referral_events is append-only (rows cannot be changed)';
end;
$$;
drop trigger if exists referral_events_no_update on public.referral_events;
create trigger referral_events_no_update before update on public.referral_events
  for each row execute function public.referral_events_block_change();

-- ---------------------------------------------------------------------
-- RLS: an organization sees a need only through its own organization_id; a referral (and everything hanging
-- off it) is visible to EITHER side of it - the from-org and the to-org - never a third organization.
-- ---------------------------------------------------------------------
alter table public.participant_needs enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_outcomes enable row level security;
alter table public.referral_follow_ups enable row level security;
alter table public.referral_events enable row level security;
revoke all on table public.participant_needs, public.referrals, public.referral_outcomes, public.referral_follow_ups, public.referral_events
  from public, anon, authenticated;

drop policy if exists "participant_needs_read_own_org" on public.participant_needs;
create policy "participant_needs_read_own_org" on public.participant_needs
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id = participant_needs.organization_id and om.user_id = (select auth.uid()) and om.status = 'active')
  );

drop policy if exists "referrals_read_either_side" on public.referrals;
create policy "referrals_read_either_side" on public.referrals
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id in (referrals.from_organization_id, referrals.to_organization_id) and om.user_id = (select auth.uid()) and om.status = 'active')
  );

drop policy if exists "referral_outcomes_read_either_side" on public.referral_outcomes;
create policy "referral_outcomes_read_either_side" on public.referral_outcomes
  for select to authenticated using (
    exists (
      select 1 from public.referrals r join public.organization_members om on om.organization_id in (r.from_organization_id, r.to_organization_id)
      where r.id = referral_outcomes.referral_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );

drop policy if exists "referral_follow_ups_read_either_side" on public.referral_follow_ups;
create policy "referral_follow_ups_read_either_side" on public.referral_follow_ups
  for select to authenticated using (
    exists (
      select 1 from public.referrals r join public.organization_members om on om.organization_id in (r.from_organization_id, r.to_organization_id)
      where r.id = referral_follow_ups.referral_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );

drop policy if exists "referral_events_read_either_side" on public.referral_events;
create policy "referral_events_read_either_side" on public.referral_events
  for select to authenticated using (
    exists (
      select 1 from public.referrals r join public.organization_members om on om.organization_id in (r.from_organization_id, r.to_organization_id)
      where r.id = referral_events.referral_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );

grant select on table public.participant_needs, public.referrals, public.referral_outcomes, public.referral_follow_ups, public.referral_events to authenticated;
grant select, insert, update, delete on table public.participant_needs, public.referrals, public.referral_outcomes, public.referral_follow_ups, public.referral_events to service_role;

-- ---------------------------------------------------------------------
-- Write RPCs. Every one re-derives the caller's role from organization_members itself - never trusts a role
-- the client claims. Read-only capability ('.read') is enforced by RLS above; these functions enforce the
-- owner/manager-only WRITE boundary that mirrors partner_link_person_to_organization / jobs+housing policies.
-- ---------------------------------------------------------------------
create or replace function public.partner_is_org_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members om where om.organization_id = p_org and om.user_id = auth.uid() and om.status = 'active' and om.member_role in ('owner', 'manager'));
$$;
revoke all on function public.partner_is_org_manager(uuid) from public, anon;
grant execute on function public.partner_is_org_manager(uuid) to authenticated, service_role;

create or replace function public.partner_create_need(p_organization_id uuid, p_person_id uuid, p_need_type text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(p_organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.organization_person_links l
    where l.organization_id = p_organization_id and l.person_id = p_person_id and l.status = 'active' and 'case_management' = any(l.data_scope)
  ) then raise exception 'NOT_AUTHORIZED_FOR_PERSON' using errcode = 'P0001'; end if;

  insert into public.participant_needs (organization_id, person_id, need_type, notes, created_by)
  values (p_organization_id, p_person_id, p_need_type, p_notes, uid)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.partner_create_need(uuid, uuid, text, text) from public, anon;
grant execute on function public.partner_create_need(uuid, uuid, text, text) to authenticated, service_role;

create or replace function public.partner_create_referral(p_need_id uuid, p_to_organization_id uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_need record; new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_need from public.participant_needs where id = p_need_id;
  if v_need is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_need.status <> 'open' then raise exception 'NEED_NOT_OPEN' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(v_need.organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if p_to_organization_id = v_need.organization_id then raise exception 'CANNOT_REFER_TO_SELF' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.resource_organizations o where o.id = p_to_organization_id and o.status = 'active') then
    raise exception 'RECEIVING_ORG_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.referrals (need_id, person_id, need_type, from_organization_id, to_organization_id, notes, created_by)
  values (p_need_id, v_need.person_id, v_need.need_type, v_need.organization_id, p_to_organization_id, p_notes, uid)
  returning id into new_id;

  insert into public.referral_events (referral_id, event_type, actor_id, notes) values (new_id, 'referral_sent', uid, p_notes);
  return new_id;
end;
$$;
revoke all on function public.partner_create_referral(uuid, uuid, text) from public, anon;
grant execute on function public.partner_create_referral(uuid, uuid, text) to authenticated, service_role;

create or replace function public.partner_respond_to_referral(p_referral_id uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_ref record;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if p_decision not in ('accepted', 'declined') then raise exception 'INVALID_DECISION' using errcode = 'P0001'; end if;
  select * into v_ref from public.referrals where id = p_referral_id;
  if v_ref is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(v_ref.to_organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if v_ref.status <> 'sent' then raise exception 'REFERRAL_NOT_PENDING' using errcode = 'P0001'; end if;

  update public.referrals set status = p_decision, responded_at = now() where id = p_referral_id;

  if p_decision = 'accepted' then
    insert into public.organization_person_links (organization_id, person_id, purpose, data_scope, source, granted_by, notes)
    values (v_ref.to_organization_id, v_ref.person_id, 'referral_coordination', array['basic', 'case_management'], 'accepted_referral', uid, 'Auto-granted on accepting referral ' || p_referral_id)
    on conflict (organization_id, person_id, purpose) where status = 'active' do nothing;
  end if;

  insert into public.referral_events (referral_id, event_type, actor_id, notes)
  values (p_referral_id, case when p_decision = 'accepted' then 'referral_accepted' else 'referral_declined' end, uid, p_notes);
end;
$$;
revoke all on function public.partner_respond_to_referral(uuid, text, text) from public, anon;
grant execute on function public.partner_respond_to_referral(uuid, text, text) to authenticated, service_role;

create or replace function public.partner_start_referral_service(p_referral_id uuid, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_ref record;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_ref from public.referrals where id = p_referral_id;
  if v_ref is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(v_ref.to_organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if v_ref.status <> 'accepted' then raise exception 'REFERRAL_NOT_ACCEPTED' using errcode = 'P0001'; end if;

  update public.referrals set status = 'in_progress', started_at = now() where id = p_referral_id;
  insert into public.referral_events (referral_id, event_type, actor_id, notes) values (p_referral_id, 'service_started', uid, p_notes);
end;
$$;
revoke all on function public.partner_start_referral_service(uuid, text) from public, anon;
grant execute on function public.partner_start_referral_service(uuid, text) to authenticated, service_role;

create or replace function public.partner_record_referral_outcome(p_referral_id uuid, p_outcome_type text, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_ref record; new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_ref from public.referrals where id = p_referral_id;
  if v_ref is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(v_ref.to_organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if v_ref.status <> 'in_progress' then raise exception 'REFERRAL_NOT_IN_PROGRESS' using errcode = 'P0001'; end if;

  insert into public.referral_outcomes (referral_id, outcome_type, notes, recorded_by) values (p_referral_id, p_outcome_type, p_notes, uid) returning id into new_id;
  update public.referrals set status = 'completed', completed_at = now() where id = p_referral_id;
  insert into public.referral_events (referral_id, event_type, actor_id, notes) values (p_referral_id, 'outcome_recorded', uid, p_notes);
  return new_id;
end;
$$;
revoke all on function public.partner_record_referral_outcome(uuid, text, text) from public, anon;
grant execute on function public.partner_record_referral_outcome(uuid, text, text) to authenticated, service_role;

create or replace function public.partner_schedule_follow_up(p_referral_id uuid, p_kind text, p_due_at timestamptz, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_ref record; new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_ref from public.referrals where id = p_referral_id;
  if v_ref is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (public.partner_is_org_manager(v_ref.from_organization_id) or public.partner_is_org_manager(v_ref.to_organization_id)) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  insert into public.referral_follow_ups (referral_id, kind, due_at, notes, created_by) values (p_referral_id, p_kind, p_due_at, p_notes, uid) returning id into new_id;
  insert into public.referral_events (referral_id, event_type, actor_id, notes) values (p_referral_id, 'follow_up_scheduled', uid, p_notes);
  return new_id;
end;
$$;
revoke all on function public.partner_schedule_follow_up(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.partner_schedule_follow_up(uuid, text, timestamptz, text) to authenticated, service_role;

create or replace function public.partner_complete_follow_up(p_follow_up_id uuid, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_fu record; v_ref record;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_fu from public.referral_follow_ups where id = p_follow_up_id;
  if v_fu is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_ref from public.referrals where id = v_fu.referral_id;
  if not (public.partner_is_org_manager(v_ref.from_organization_id) or public.partner_is_org_manager(v_ref.to_organization_id)) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  update public.referral_follow_ups set status = 'completed', completed_by = uid, completed_at = now() where id = p_follow_up_id;
  insert into public.referral_events (referral_id, event_type, actor_id, notes) values (v_fu.referral_id, 'follow_up_completed', uid, p_notes);
end;
$$;
revoke all on function public.partner_complete_follow_up(uuid, text) from public, anon;
grant execute on function public.partner_complete_follow_up(uuid, text) to authenticated, service_role;

create or replace function public.partner_close_referral(p_referral_id uuid, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_ref record;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_ref from public.referrals where id = p_referral_id;
  if v_ref is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (public.partner_is_org_manager(v_ref.from_organization_id) or public.partner_is_org_manager(v_ref.to_organization_id)) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_ref.status not in ('completed', 'declined', 'in_progress') then raise exception 'REFERRAL_NOT_CLOSABLE' using errcode = 'P0001'; end if;

  update public.referrals set status = 'closed', closed_at = now() where id = p_referral_id;
  update public.participant_needs set status = 'closed', closed_at = now() where id = v_ref.need_id and status = 'open';
  insert into public.referral_events (referral_id, event_type, actor_id, notes) values (p_referral_id, 'referral_closed', uid, p_notes);
end;
$$;
revoke all on function public.partner_close_referral(uuid, text) from public, anon;
grant execute on function public.partner_close_referral(uuid, text) to authenticated, service_role;
