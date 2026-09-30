-- Impact Evidence layer: a ledger of attributable FACTS, not another outcomes database.
--
-- Explicitly NOT the Program/Assessment/incentive layer (WOTC, Federal Bonding, etc.) - that needs a security
-- boundary review (how does an incentive assessment avoid leaking justice-history to an employer just because
-- FairPath internally needs it to evaluate eligibility) before any table exists. This migration only records
-- what already, factually happened, sourced from real existing records - never a duplicate of them, never a
-- derived/estimated number.
--
-- Every evidence_type here corresponds to a row in the capability matrix marked "Yes" this session:
--   employment_hire    -> job_placements (a real hire, not a job posting or an application status)
--   housing_approval   -> housing_applications.status = 'approved' (approval, NOT move-in/lease/tenancy -
--                         deliberately NOT called "housing_placement", because that fact doesn't exist yet)
--   referral_completed -> referrals.status = 'completed'
--   service_delivered  -> referral_outcomes.outcome_type = 'service_delivered'
--   campaign_recipient  -> campaign_recipients.state = 'queued' (a real queued send, NOT a delivery - actual
--                         delivery has zero evidence today, no provider exists)
-- Nothing about wages, retention, housing stability, or actual message delivery is recorded here, because none
-- of those facts exist in the platform yet (see the capability matrix in the commit message).

create table if not exists public.impact_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'employment_hire', 'housing_approval', 'referral_completed', 'service_delivered', 'campaign_recipient'
  )),
  source_table text not null,
  source_id uuid not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (evidence_type, source_table, source_id)
);
create index if not exists impact_evidence_org_idx on public.impact_evidence (organization_id, evidence_type);
create index if not exists impact_evidence_person_idx on public.impact_evidence (person_id);

comment on table public.impact_evidence is
  'A ledger of attributable facts sourced from real domain records - never invented, never estimated. No '
  'mutable personal information is copied in; every row is a provenance pointer (source_table/source_id) back '
  'to the original record, so "where did this number come from" is always answerable by following the '
  'reference. This is the Evidence layer only - NOT the Program/Assessment/incentive layer, which does not '
  'exist yet pending a security-boundary design review.';

alter table public.impact_evidence enable row level security;
revoke all on table public.impact_evidence from public, anon, authenticated;

drop policy if exists "impact_evidence_read_own_org" on public.impact_evidence;
create policy "impact_evidence_read_own_org" on public.impact_evidence
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id = impact_evidence.organization_id and om.user_id = (select auth.uid()) and om.status = 'active')
  );

grant select on table public.impact_evidence to authenticated;
grant select, insert, update, delete on table public.impact_evidence to service_role;

-- ---------------------------------------------------------------------
-- Append-only by triggers on the real source tables - evidence is recorded automatically the instant the
-- underlying fact becomes true, never backfilled by a human typing a number, and never a second place that
-- could drift from the source of truth.
-- ---------------------------------------------------------------------
create or replace function public.record_impact_evidence_placement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
  select new.organization_id, new.person_id, 'employment_hire', 'job_placements', new.id, new.hired_at
  where new.organization_id is not null
  on conflict (evidence_type, source_table, source_id) do nothing;
  return new;
end;
$$;
drop trigger if exists job_placements_record_evidence on public.job_placements;
create trigger job_placements_record_evidence after insert on public.job_placements
  for each row execute function public.record_impact_evidence_placement();

create or replace function public.record_impact_evidence_housing_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select organization_id into v_org from public.housing_listings where id = new.listing_id;
    if v_org is not null then
      insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
      values (v_org, new.user_id, 'housing_approval', 'housing_applications', new.id, now())
      on conflict (evidence_type, source_table, source_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists housing_applications_record_evidence on public.housing_applications;
create trigger housing_applications_record_evidence after insert or update of status on public.housing_applications
  for each row execute function public.record_impact_evidence_housing_approval();

create or replace function public.record_impact_evidence_referral_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
    values (new.to_organization_id, new.person_id, 'referral_completed', 'referrals', new.id, coalesce(new.completed_at, now()))
    on conflict (evidence_type, source_table, source_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists referrals_record_evidence on public.referrals;
create trigger referrals_record_evidence after insert or update of status on public.referrals
  for each row execute function public.record_impact_evidence_referral_completed();

create or replace function public.record_impact_evidence_service_delivered()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref record;
begin
  if new.outcome_type = 'service_delivered' then
    select * into v_ref from public.referrals where id = new.referral_id;
    if v_ref is not null then
      insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
      values (v_ref.to_organization_id, v_ref.person_id, 'service_delivered', 'referral_outcomes', new.id, new.recorded_at)
      on conflict (evidence_type, source_table, source_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists referral_outcomes_record_evidence on public.referral_outcomes;
create trigger referral_outcomes_record_evidence after insert on public.referral_outcomes
  for each row execute function public.record_impact_evidence_service_delivered();

create or replace function public.record_impact_evidence_campaign_recipient()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if new.state = 'queued' then
    select organization_id into v_org from public.campaigns where id = new.campaign_id;
    if v_org is not null then
      insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
      values (v_org, new.person_id, 'campaign_recipient', 'campaign_recipients', new.id, new.created_at)
      on conflict (evidence_type, source_table, source_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists campaign_recipients_record_evidence on public.campaign_recipients;
create trigger campaign_recipients_record_evidence after insert or update of state on public.campaign_recipients
  for each row execute function public.record_impact_evidence_campaign_recipient();

-- Backfill: the facts above already happened during this session's live testing, before these triggers
-- existed - insert the evidence for them now so the ledger isn't missing real history.
insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
select organization_id, person_id, 'employment_hire', 'job_placements', id, hired_at
from public.job_placements where organization_id is not null
on conflict (evidence_type, source_table, source_id) do nothing;

insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
select h.organization_id, a.user_id, 'housing_approval', 'housing_applications', a.id, a.updated_at
from public.housing_applications a join public.housing_listings h on h.id = a.listing_id
where a.status = 'approved' and h.organization_id is not null
on conflict (evidence_type, source_table, source_id) do nothing;

insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
select to_organization_id, person_id, 'referral_completed', 'referrals', id, coalesce(completed_at, now())
from public.referrals where status = 'completed'
on conflict (evidence_type, source_table, source_id) do nothing;

insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
select r.to_organization_id, r.person_id, 'service_delivered', 'referral_outcomes', o.id, o.recorded_at
from public.referral_outcomes o join public.referrals r on r.id = o.referral_id
where o.outcome_type = 'service_delivered'
on conflict (evidence_type, source_table, source_id) do nothing;

insert into public.impact_evidence (organization_id, person_id, evidence_type, source_table, source_id, occurred_at)
select c.organization_id, cr.person_id, 'campaign_recipient', 'campaign_recipients', cr.id, cr.created_at
from public.campaign_recipients cr join public.campaigns c on c.id = cr.campaign_id
where cr.state = 'queued'
on conflict (evidence_type, source_table, source_id) do nothing;
