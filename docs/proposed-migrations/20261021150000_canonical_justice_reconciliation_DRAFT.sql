-- DRAFT ONLY — DO NOT APPLY to shared DEV or production.
-- Supersedes:
--   20261023100000_record_relief_charge_venue_engine_DRAFT.sql (courts/filing merged; record_relief_charges NOT created)
--   20261021140000_unified_justice_employer_policies_DRAFT.sql (employer + justice merged + RPC enforcement)
--
-- Canonical member model: justice_cases + justice_charges (single charge store for RR, Profile, matching, disclosure).
-- Tests: scripts/test-proposed-justice-schema.mjs (local Postgres only).

-- =============================================================================
-- 1. Reference: courts & local filing (from RR venue draft)
-- =============================================================================
create table if not exists public.record_relief_courts (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  stable_key text not null unique,
  court_name text not null,
  court_level text not null check (court_level in (
    'municipal','county','district','circuit','superior','common_pleas','general','limited','juvenile','federal_district','military','unknown'
  )),
  state_code text, county_name text, city_name text,
  official_url text, clerk_url text, filing_url text,
  address jsonb not null default '{}'::jsonb,
  source_url text not null, last_verified_at date not null,
  status text not null default 'verified' check (status in ('draft','verified','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists record_relief_courts_place_idx on public.record_relief_courts (jurisdiction_code, county_name, city_name);

create table if not exists public.record_relief_local_filing_profiles (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.record_relief_courts(id) on delete cascade,
  remedy text not null check (remedy in ('expungement','sealing','set_aside','certificate','automatic_clearing','other')),
  filing_fee_cents integer check (filing_fee_cents is null or filing_fee_cents >= 0),
  fee_waiver_available boolean,
  forms jsonb not null default '[]'::jsonb,
  filing_steps jsonb not null default '[]'::jsonb,
  source_url text not null, effective_from date not null, effective_to date, last_verified_at date not null,
  status text not null default 'verified' check (status in ('draft','verified','superseded','retired')),
  unique (court_id, remedy, effective_from)
);

-- =============================================================================
-- 2. Canonical member docket + charges
-- =============================================================================
create table if not exists public.justice_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jurisdiction_code text not null,
  state_code text,
  county text,
  court_name text,
  case_number text,
  docket_label text not null check (length(btrim(docket_label)) between 2 and 120),
  case_status text not null default 'open'
    check (case_status in ('open', 'closed', 'pending_appeal', 'consolidated', 'unknown')),
  arrest_date date,
  filing_date date,
  court_id uuid references public.record_relief_courts(id),
  city_name text,
  federal_subtype text check (federal_subtype is null or federal_subtype in (
    'united_states_code','district_of_columbia_code','code_of_federal_regulations','uniform_code_of_military_justice','unknown'
  )),
  source_type text not null default 'self_reported'
    check (source_type in ('self_reported', 'document', 'official_record', 'partner_verified')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  member_notes text check (member_notes is null or length(member_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists justice_cases_user_idx on public.justice_cases (user_id, updated_at desc);
create unique index if not exists justice_cases_user_docket_uidx
  on public.justice_cases (user_id, jurisdiction_code, lower(btrim(case_number)))
  where case_number is not null and btrim(case_number) <> '';

create table if not exists public.justice_charges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.justice_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  count_number integer,
  offense_name text not null check (length(btrim(offense_name)) between 2 and 200),
  statute_code text,
  statute_version text,
  offense_catalog_id uuid references public.offense_catalog(id),
  amended_from_charge_id uuid references public.justice_charges(id) on delete set null,
  degree text not null default 'unknown'
    check (degree in ('infraction', 'minor_misdemeanor', 'misdemeanor', 'felony', 'unknown')),
  degree_level integer,
  offense_category text,
  disposition text not null default 'unknown'
    check (disposition in (
      'conviction', 'dismissal', 'acquittal', 'deferred_adjudication', 'nolle_prosequi', 'arrest_no_charge', 'pending', 'unknown'
    )),
  conviction_date date,
  disposition_date date,
  sentence_completion_date date,
  supervision_completion_date date,
  release_date date,
  fines_paid boolean,
  restitution_paid boolean,
  visibility text not null default 'member'
    check (visibility in ('member', 'sealed', 'expunged', 'sealed_pending_verification')),
  sealing_history jsonb not null default '[]'::jsonb,
  legacy_conviction_id uuid,
  source_type text not null default 'self_reported'
    check (source_type in ('self_reported', 'document', 'official_record', 'partner_verified')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  source_reference text,
  member_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, count_number)
);
create index if not exists justice_charges_case_idx on public.justice_charges (case_id, count_number);
create unique index if not exists justice_charges_legacy_conviction_uidx
  on public.justice_charges (legacy_conviction_id) where legacy_conviction_id is not null;

create table if not exists public.justice_charge_corrections (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.justice_charges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_name text not null,
  prior_value jsonb,
  new_value jsonb,
  reason text check (reason is null or length(reason) <= 500),
  created_at timestamptz not null default now()
);

-- Link legacy stores (nullable until backfill)
alter table public.convictions add column if not exists justice_charge_id uuid references public.justice_charges(id) on delete set null;
create unique index if not exists convictions_justice_charge_uidx on public.convictions (justice_charge_id) where justice_charge_id is not null;

alter table public.record_relief_cases add column if not exists justice_case_id uuid references public.justice_cases(id) on delete set null;
create unique index if not exists record_relief_cases_justice_case_uidx on public.record_relief_cases (justice_case_id) where justice_case_id is not null;
alter table public.record_relief_cases add column if not exists court_id uuid references public.record_relief_courts(id);
alter table public.record_relief_cases add column if not exists county_name text;
alter table public.record_relief_cases add column if not exists city_name text;
alter table public.record_relief_cases add column if not exists federal_subtype text;

alter table public.record_relief_evaluations add column if not exists justice_charge_id uuid references public.justice_charges(id) on delete set null;
create index if not exists record_relief_evaluations_charge_idx on public.record_relief_evaluations (justice_charge_id) where justice_charge_id is not null;

-- =============================================================================
-- 3. Employer policies (versioned, admin-gated publish)
-- =============================================================================
create table if not exists public.employer_job_conviction_policies (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  organization_id uuid references public.resource_organizations(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'corrections_requested', 'approved', 'rejected', 'retired')),
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id)
);

create table if not exists public.employer_job_conviction_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.employer_job_conviction_policies(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  effective_from date not null default current_date,
  policy_json jsonb not null,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or length(review_notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (policy_id, version_number)
);

alter table public.employer_job_conviction_policies
  drop constraint if exists employer_job_conviction_policies_published_fkey;
alter table public.employer_job_conviction_policies
  add constraint employer_job_conviction_policies_published_fkey
  foreign key (published_version_id) references public.employer_job_conviction_policy_versions(id);

create table if not exists public.justice_match_evaluations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  policy_version_id uuid not null references public.employer_job_conviction_policy_versions(id) on delete restrict,
  outcome text not null check (outcome in (
    'appears_compatible', 'individual_review_required', 'confirmed_restriction', 'insufficient_information'
  )),
  explanation jsonb not null,
  charge_fact_refs uuid[] not null default '{}',
  consent_scope text not null default 'none'
    check (consent_scope in ('none', 'categories_only', 'member_authorized_summary')),
  evaluated_at timestamptz not null default now(),
  engine_version text not null,
  unique (member_id, job_id, policy_version_id)
);

-- =============================================================================
-- 4. RLS
-- =============================================================================
alter table public.record_relief_courts enable row level security;
alter table public.record_relief_local_filing_profiles enable row level security;
alter table public.justice_cases enable row level security;
alter table public.justice_charges enable row level security;
alter table public.justice_charge_corrections enable row level security;
alter table public.employer_job_conviction_policies enable row level security;
alter table public.employer_job_conviction_policy_versions enable row level security;
alter table public.justice_match_evaluations enable row level security;

drop policy if exists "rr_courts_verified_read" on public.record_relief_courts;
create policy "rr_courts_verified_read" on public.record_relief_courts for select to authenticated using (status = 'verified');
drop policy if exists "rr_local_filing_verified_read" on public.record_relief_local_filing_profiles;
create policy "rr_local_filing_verified_read" on public.record_relief_local_filing_profiles for select to authenticated using (status = 'verified');

drop policy if exists "justice_cases_owner_all" on public.justice_cases;
create policy "justice_cases_owner_all" on public.justice_cases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "justice_charges_owner_all" on public.justice_charges;
create policy "justice_charges_owner_all" on public.justice_charges for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "justice_corrections_owner_insert" on public.justice_charge_corrections;
create policy "justice_corrections_owner_insert" on public.justice_charge_corrections for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "justice_corrections_owner_read" on public.justice_charge_corrections;
create policy "justice_corrections_owner_read" on public.justice_charge_corrections for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "employer_policy_org_read" on public.employer_job_conviction_policies;
create policy "employer_policy_org_read" on public.employer_job_conviction_policies for select to authenticated
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = employer_job_conviction_policies.organization_id
      and om.user_id = (select auth.uid()) and om.status = 'active'
  ));
drop policy if exists "employer_policy_individual_employer_read" on public.employer_job_conviction_policies;
create policy "employer_policy_individual_employer_read" on public.employer_job_conviction_policies for select to authenticated
  using (exists (
    select 1 from public.jobs j
    where j.id = employer_job_conviction_policies.job_id
      and j.employer_id = (select auth.uid())
      and j.organization_id is null
  ));
-- Versions: no authenticated SELECT (partners see summary via RPC/view later)

drop policy if exists "justice_match_evaluations_member_read" on public.justice_match_evaluations;
create policy "justice_match_evaluations_member_read" on public.justice_match_evaluations for select to authenticated
  using (member_id = (select auth.uid()));

revoke insert, update, delete on public.employer_job_conviction_policies from authenticated;
revoke all on public.employer_job_conviction_policy_versions from authenticated;
grant select on public.employer_job_conviction_policies to authenticated;

-- =============================================================================
-- 5. Block JSONB policy bypass on jobs (authenticated)
-- =============================================================================
create or replace function public.guard_jobs_eligibility_rules_justice_policy()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_j jsonb;
  new_j jsonb;
begin
  new_j := coalesce(new.eligibility_rules, '{}'::jsonb) -> 'justice_policy_v1';
  if new_j is null then return new; end if;
  if tg_op = 'UPDATE' then
    old_j := coalesce(old.eligibility_rules, '{}'::jsonb) -> 'justice_policy_v1';
    if old_j is not distinct from new_j then return new; end if;
  end if;
  if current_setting('request.jwt.claim.role', true) = 'service_role' then return new; end if;
  raise exception 'justice_policy_v1 must be updated via partner/admin RPC, not direct job update';
end;
$$;

drop trigger if exists guard_jobs_justice_policy on public.jobs;
create trigger guard_jobs_justice_policy
  before insert or update of eligibility_rules on public.jobs
  for each row execute function public.guard_jobs_eligibility_rules_justice_policy();

-- =============================================================================
-- 6. Helpers (security definer — not granted to clients)
-- =============================================================================
create or replace function public.justice_assert_active_staff(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor is null then raise exception 'STAFF_ACTOR_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.staff_users su
    where su.user_id = p_actor and su.status = 'active'
      and su.role in ('super_admin', 'admin', 'moderator')
  ) then
    raise exception 'NOT_AUTHORIZED_STAFF' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.justice_assert_active_staff(uuid) from public, anon, authenticated;

create or replace function public.justice_assert_partner_job_manager(p_job_id uuid, p_uid uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs;
begin
  if p_uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_job from public.jobs where id = p_job_id;
  if v_job is null then raise exception 'JOB_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_job.organization_id is null then
    if v_job.employer_id = p_uid then return v_job; end if;
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = v_job.organization_id
      and om.user_id = p_uid and om.status = 'active'
      and om.member_role in ('owner', 'manager', 'editor')
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  return v_job;
end;
$$;
revoke all on function public.justice_assert_partner_job_manager(uuid, uuid) from public, anon, authenticated;

create or replace function public.justice_policy_workflow_status_to_publication(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'approved' then 'approved'
    when 'submitted' then 'submitted'
    when 'rejected' then 'rejected'
    when 'corrections_requested' then 'corrections_requested'
    else 'draft'
  end;
$$;

create or replace function public.justice_validate_policy_json_v1(p_json jsonb)
returns void
language plpgsql
immutable
as $$
begin
  if p_json is null or jsonb_typeof(p_json) <> 'object' then
    raise exception 'POLICY_JSON_INVALID' using errcode = 'P0001';
  end if;
  if coalesce((p_json ->> 'schemaVersion')::int, 0) <> 1 then
    raise exception 'POLICY_SCHEMA_VERSION' using errcode = 'P0001';
  end if;
  if not (p_json ? 'policyType') then
    raise exception 'POLICY_TYPE_REQUIRED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.guard_employer_policy_version_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_pub uuid;
begin
  select p.status, p.published_version_id into v_status, v_pub
  from public.employer_job_conviction_policies p
  where p.id = old.policy_id;
  if v_status = 'approved' and v_pub = old.id then
    raise exception 'PUBLISHED_POLICY_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_employer_policy_version_immutable on public.employer_job_conviction_policy_versions;
create trigger guard_employer_policy_version_immutable
  before update on public.employer_job_conviction_policy_versions
  for each row execute function public.guard_employer_policy_version_immutable();

create or replace function public.guard_employer_policy_header_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'approved' and (
    new.status is distinct from old.status
    or new.published_version_id is distinct from old.published_version_id
    or new.job_id is distinct from old.job_id
    or new.organization_id is distinct from old.organization_id
  ) then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'APPROVED_POLICY_LOCKED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_employer_policy_header_locked on public.employer_job_conviction_policies;
create trigger guard_employer_policy_header_locked
  before update on public.employer_job_conviction_policies
  for each row execute function public.guard_employer_policy_header_locked();

-- =============================================================================
-- 7. Partner / Admin RPCs
-- =============================================================================
create or replace function public.partner_save_job_conviction_policy_draft(
  p_job_id uuid,
  p_policy_json jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_job public.jobs;
  v_policy public.employer_job_conviction_policies;
  v_policy_id uuid;
  v_next_ver integer;
  v_merged jsonb;
  v_version_id uuid;
begin
  v_job := public.justice_assert_partner_job_manager(p_job_id, uid);
  perform public.justice_validate_policy_json_v1(p_policy_json);

  select * into v_policy from public.employer_job_conviction_policies where job_id = p_job_id;
  if v_policy.id is not null and v_policy.status in ('submitted', 'approved') then
    raise exception 'POLICY_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  v_merged := p_policy_json
    || jsonb_build_object(
      'schemaVersion', 1,
      'jobId', p_job_id::text,
      'organizationId', coalesce(v_job.organization_id::text, ''),
      'publicationStatus', public.justice_policy_workflow_status_to_publication(coalesce(v_policy.status, 'draft'))
    );

  if v_policy.id is null then
    insert into public.employer_job_conviction_policies (job_id, organization_id, status)
    values (p_job_id, v_job.organization_id, 'draft')
    returning id into v_policy_id;
    insert into public.employer_job_conviction_policy_versions (policy_id, version_number, policy_json)
    values (v_policy_id, 1, v_merged)
    returning id into v_version_id;
    return v_policy_id;
  end if;

  v_policy_id := v_policy.id;
  select coalesce(max(version_number), 0) + 1 into v_next_ver
  from public.employer_job_conviction_policy_versions where policy_id = v_policy_id;

  insert into public.employer_job_conviction_policy_versions (policy_id, version_number, policy_json)
  values (v_policy_id, v_next_ver, v_merged)
  returning id into v_version_id;

  update public.employer_job_conviction_policies
  set status = case when status = 'corrections_requested' then 'draft' else status end,
      updated_at = now()
  where id = v_policy_id;

  return v_policy_id;
end;
$$;
revoke all on function public.partner_save_job_conviction_policy_draft(uuid, jsonb) from public, anon;
grant execute on function public.partner_save_job_conviction_policy_draft(uuid, jsonb) to authenticated, service_role;

create or replace function public.partner_submit_job_conviction_policy(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_job public.jobs;
  v_policy public.employer_job_conviction_policies;
  v_version public.employer_job_conviction_policy_versions;
  v_merged jsonb;
begin
  v_job := public.justice_assert_partner_job_manager(p_job_id, uid);
  select * into v_policy from public.employer_job_conviction_policies where job_id = p_job_id;
  if v_policy.id is null then raise exception 'POLICY_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_policy.status not in ('draft', 'corrections_requested') then
    raise exception 'POLICY_NOT_SUBMITTABLE' using errcode = 'P0001';
  end if;

  select * into v_version
  from public.employer_job_conviction_policy_versions
  where policy_id = v_policy.id
  order by version_number desc
  limit 1;
  if v_version.id is null then raise exception 'POLICY_VERSION_MISSING' using errcode = 'P0001'; end if;

  v_merged := v_version.policy_json || jsonb_build_object('publicationStatus', 'submitted');

  update public.employer_job_conviction_policy_versions
  set policy_json = v_merged,
      submitted_by = uid,
      submitted_at = now()
  where id = v_version.id;

  update public.employer_job_conviction_policies
  set status = 'submitted', updated_at = now()
  where id = v_policy.id;

  return v_version.id;
end;
$$;
revoke all on function public.partner_submit_job_conviction_policy(uuid) from public, anon;
grant execute on function public.partner_submit_job_conviction_policy(uuid) to authenticated, service_role;

create or replace function public.admin_approve_job_conviction_policy(
  p_job_id uuid,
  p_actor uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.employer_job_conviction_policies;
  v_version public.employer_job_conviction_policy_versions;
  v_merged jsonb;
begin
  perform public.justice_assert_active_staff(p_actor);

  select * into v_policy from public.employer_job_conviction_policies where job_id = p_job_id;
  if v_policy.id is null then raise exception 'POLICY_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_policy.status <> 'submitted' then raise exception 'POLICY_NOT_SUBMITTED' using errcode = 'P0001'; end if;

  select * into v_version
  from public.employer_job_conviction_policy_versions
  where policy_id = v_policy.id and submitted_at is not null
  order by version_number desc
  limit 1;
  if v_version.id is null then raise exception 'SUBMITTED_VERSION_MISSING' using errcode = 'P0001'; end if;

  v_merged := v_version.policy_json || jsonb_build_object(
    'publicationStatus', 'approved',
    'lastReviewedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update public.employer_job_conviction_policy_versions
  set policy_json = v_merged,
      reviewed_by = p_actor,
      reviewed_at = now(),
      review_notes = p_notes
  where id = v_version.id;

  update public.employer_job_conviction_policies
  set status = 'approved',
      published_version_id = v_version.id,
      updated_at = now()
  where id = v_policy.id;

  insert into public.admin_audit_log (actor_user_id, action, target_table, target_id, after_state, notes)
  values (p_actor, 'approve_job_conviction_policy', 'employer_job_conviction_policies', v_policy.id::text,
    jsonb_build_object('job_id', p_job_id, 'published_version_id', v_version.id), p_notes);

  return v_version.id;
end;
$$;
revoke all on function public.admin_approve_job_conviction_policy(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_approve_job_conviction_policy(uuid, uuid, text) to service_role;

create or replace function public.admin_reject_job_conviction_policy(
  p_job_id uuid,
  p_actor uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.employer_job_conviction_policies;
  v_version public.employer_job_conviction_policy_versions;
  v_merged jsonb;
begin
  perform public.justice_assert_active_staff(p_actor);
  select * into v_policy from public.employer_job_conviction_policies where job_id = p_job_id;
  if v_policy.id is null then raise exception 'POLICY_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_policy.status <> 'submitted' then raise exception 'POLICY_NOT_SUBMITTED' using errcode = 'P0001'; end if;

  select * into v_version
  from public.employer_job_conviction_policy_versions
  where policy_id = v_policy.id
  order by version_number desc limit 1;

  if v_version.id is not null then
    v_merged := v_version.policy_json || jsonb_build_object('publicationStatus', 'rejected');
    update public.employer_job_conviction_policy_versions
    set policy_json = v_merged, reviewed_by = p_actor, reviewed_at = now(), review_notes = p_notes
    where id = v_version.id;
  end if;

  update public.employer_job_conviction_policies set status = 'rejected', updated_at = now() where id = v_policy.id;

  insert into public.admin_audit_log (actor_user_id, action, target_table, target_id, notes)
  values (p_actor, 'reject_job_conviction_policy', 'employer_job_conviction_policies', v_policy.id::text, p_notes);
end;
$$;
revoke all on function public.admin_reject_job_conviction_policy(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reject_job_conviction_policy(uuid, uuid, text) to service_role;

create or replace function public.admin_request_job_conviction_policy_corrections(
  p_job_id uuid,
  p_actor uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.employer_job_conviction_policies;
  v_version public.employer_job_conviction_policy_versions;
  v_merged jsonb;
begin
  perform public.justice_assert_active_staff(p_actor);
  if p_notes is null or btrim(p_notes) = '' then raise exception 'NOTES_REQUIRED' using errcode = 'P0001'; end if;

  select * into v_policy from public.employer_job_conviction_policies where job_id = p_job_id;
  if v_policy.id is null then raise exception 'POLICY_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_policy.status <> 'submitted' then raise exception 'POLICY_NOT_SUBMITTED' using errcode = 'P0001'; end if;

  select * into v_version
  from public.employer_job_conviction_policy_versions
  where policy_id = v_policy.id
  order by version_number desc limit 1;

  if v_version.id is not null then
    v_merged := v_version.policy_json || jsonb_build_object('publicationStatus', 'corrections_requested');
    update public.employer_job_conviction_policy_versions
    set policy_json = v_merged, reviewed_by = p_actor, reviewed_at = now(), review_notes = p_notes
    where id = v_version.id;
  end if;

  update public.employer_job_conviction_policies set status = 'corrections_requested', updated_at = now() where id = v_policy.id;

  insert into public.admin_audit_log (actor_user_id, action, target_table, target_id, notes)
  values (p_actor, 'request_job_conviction_policy_corrections', 'employer_job_conviction_policies', v_policy.id::text, p_notes);
end;
$$;
revoke all on function public.admin_request_job_conviction_policy_corrections(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_request_job_conviction_policy_corrections(uuid, uuid, text) to service_role;

-- =============================================================================
-- 8. Member job compatibility evaluation (member-only; no employer access)
-- =============================================================================
create or replace function public.justice_member_disclosure_consent(p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ce.granted
    from public.consent_events ce
    where ce.user_id = p_member
      and ce.event_type = 'justice_history_disclosure_consent'
    order by ce.created_at desc
    limit 1
  ), false);
$$;
revoke all on function public.justice_member_disclosure_consent(uuid) from public, anon, authenticated;

create or replace function public.justice_evaluate_policy_v1_sql(
  p_policy jsonb,
  p_charges jsonb,
  p_has_consent boolean,
  p_as_of date
)
returns jsonb
language plpgsql
stable
as $$
declare
  c jsonb;
  ch jsonb;
  missing text[] := '{}';
  matched text[] := '{}';
  requires_review boolean := false;
  pub text := coalesce(p_policy ->> 'publicationStatus', 'draft');
  policy_type text := coalesce(p_policy ->> 'policyType', 'criteria_based');
  outcome text;
  reason text;
  yrs numeric;
  d date;
  anchor text;
  min_years numeric;
  cat text;
  statutes jsonb;
  s text;
begin
  if pub <> 'approved' then
    return jsonb_build_object(
      'engineVersion', 'justice-match-v1-sql',
      'outcome', 'insufficient_information',
      'reason', 'This job''s conviction consideration policy has not been published yet.',
      'matchedCriteriaIds', '[]'::jsonb,
      'missingInformation', jsonb_build_array('published_employer_policy'),
      'requiresEmployerIndividualReview', false
    );
  end if;

  if policy_type = 'unverified' then
    return jsonb_build_object(
      'engineVersion', 'justice-match-v1-sql',
      'outcome', 'insufficient_information',
      'reason', 'FairPath has not verified this employer''s conviction consideration policy.',
      'matchedCriteriaIds', '[]'::jsonb,
      'missingInformation', jsonb_build_array('verified_employer_policy'),
      'requiresEmployerIndividualReview', false
    );
  end if;

  if policy_type = 'affirmative_fair_chance' then
    return jsonb_build_object(
      'engineVersion', 'justice-match-v1-sql',
      'outcome', 'appears_compatible',
      'reason', 'This employer uses an affirmative fair-chance policy and reviews qualified applicants individually.',
      'matchedCriteriaIds', coalesce(p_policy -> 'criteria', '[]'::jsonb),
      'missingInformation', '[]'::jsonb,
      'requiresEmployerIndividualReview', true
    );
  end if;

  if not p_has_consent or jsonb_array_length(p_charges) = 0 then
    return jsonb_build_object(
      'engineVersion', 'justice-match-v1-sql',
      'outcome', 'insufficient_information',
      'reason', 'Share the justice-history details you want considered to see how this job''s policy may apply.',
      'matchedCriteriaIds', '[]'::jsonb,
      'missingInformation', jsonb_build_array('member_justice_disclosure'),
      'requiresEmployerIndividualReview', false
    );
  end if;

  for c in select * from jsonb_array_elements(coalesce(p_policy -> 'criteria', '[]'::jsonb)) loop
    if c ->> 'kind' in ('individualized_review', 'licensing_restriction', 'job_duty_restriction') then
      requires_review := true;
      matched := array_append(matched, c ->> 'id');
      continue;
    end if;
    if c ->> 'kind' = 'affirmative_fair_chance' then
      matched := array_append(matched, c ->> 'id');
      continue;
    end if;
    if c ->> 'kind' = 'pending_charges' then
      for ch in select * from jsonb_array_elements(p_charges) loop
        if ch ->> 'disposition' = 'pending' then requires_review := true; end if;
      end loop;
      matched := array_append(matched, c ->> 'id');
      continue;
    end if;
    if c ->> 'kind' in ('time_since_conviction', 'time_since_sentence_completion') then
      anchor := coalesce(c ->> 'eventAnchor',
        case when c ->> 'kind' = 'time_since_sentence_completion' then 'sentence_completion_date' else 'conviction_date' end);
      min_years := (c ->> 'minYearsSinceEvent')::numeric;
      if min_years is null then
        missing := array_append(missing, 'criterion_' || (c ->> 'id') || '_min_years');
        continue;
      end if;
      for ch in select * from jsonb_array_elements(p_charges) loop
        d := case anchor
          when 'sentence_completion_date' then (ch ->> 'sentenceCompletionDate')::date
          when 'release_date' then (ch ->> 'releaseDate')::date
          else (ch ->> 'convictionDate')::date
        end;
        if d is null then
          missing := array_append(missing, 'charge_' || (ch ->> 'chargeId') || '_' || anchor);
        else
          yrs := extract(epoch from (p_as_of - d)) / (365.25 * 86400);
          if yrs < min_years then requires_review := true; end if;
        end if;
      end loop;
      matched := array_append(matched, c ->> 'id');
      continue;
    end if;
    if c ->> 'kind' = 'offense_category_exclusion' and jsonb_array_length(coalesce(c -> 'offenseCategories', '[]'::jsonb)) > 0 then
      for ch in select * from jsonb_array_elements(p_charges) loop
        cat := ch ->> 'offenseCategory';
        if cat is null or btrim(cat) = '' then
          missing := array_append(missing, 'charge_' || (ch ->> 'chargeId') || '_offense_category');
        elsif exists (
          select 1 from jsonb_array_elements_text(c -> 'offenseCategories') oc where oc = cat
        ) then
          return jsonb_build_object(
            'engineVersion', 'justice-match-v1-sql',
            'outcome', 'confirmed_restriction',
            'reason', coalesce(c ->> 'narrative', 'This job''s published policy restricts one or more offense categories you shared.'),
            'matchedCriteriaIds', to_jsonb(array_append(matched, c ->> 'id')),
            'missingInformation', to_jsonb(missing),
            'requiresEmployerIndividualReview', true
          );
        end if;
      end loop;
      matched := array_append(matched, c ->> 'id');
      continue;
    end if;
    if c ->> 'kind' = 'statute_exclusion' and jsonb_array_length(coalesce(c -> 'statutes', '[]'::jsonb)) > 0 then
      statutes := c -> 'statutes';
      for ch in select * from jsonb_array_elements(p_charges) loop
        s := lower(coalesce(ch ->> 'statuteCode', ''));
        if s = '' then
          missing := array_append(missing, 'charge_' || (ch ->> 'chargeId') || '_statute');
        elsif exists (
          select 1 from jsonb_array_elements_text(statutes) st where strpos(s, lower(st)) > 0
        ) then
          return jsonb_build_object(
            'engineVersion', 'justice-match-v1-sql',
            'outcome', 'confirmed_restriction',
            'reason', coalesce(c ->> 'narrative', 'This job''s published policy restricts a statute you shared.'),
            'matchedCriteriaIds', to_jsonb(array_append(matched, c ->> 'id')),
            'missingInformation', to_jsonb(missing),
            'requiresEmployerIndividualReview', true
          );
        end if;
      end loop;
      matched := array_append(matched, c ->> 'id');
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    return jsonb_build_object(
      'engineVersion', 'justice-match-v1-sql',
      'outcome', 'insufficient_information',
      'reason', 'Some dates or charge details are missing, so FairPath cannot apply every part of this policy yet.',
      'matchedCriteriaIds', to_jsonb(matched),
      'missingInformation', to_jsonb(missing),
      'requiresEmployerIndividualReview', requires_review
    );
  end if;

  outcome := case when requires_review then 'individual_review_required' else 'appears_compatible' end;
  reason := case when requires_review
    then 'Based on what you shared, this employer''s policy calls for individual review — not an automatic yes or no.'
    else 'Based on what you shared, nothing in this job''s published policy clearly restricts your charges.'
  end;

  return jsonb_build_object(
    'engineVersion', 'justice-match-v1-sql',
    'outcome', outcome,
    'reason', reason,
    'matchedCriteriaIds', to_jsonb(matched),
    'missingInformation', '[]'::jsonb,
    'requiresEmployerIndividualReview', requires_review or policy_type = 'individualized_review'
  );
end;
$$;
revoke all on function public.justice_evaluate_policy_v1_sql(jsonb, jsonb, boolean, date) from public, anon, authenticated;

create or replace function public.evaluate_member_job_justice_match(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_policy public.employer_job_conviction_policies;
  v_version public.employer_job_conviction_policy_versions;
  v_charges jsonb;
  v_has_consent boolean;
  v_eval jsonb;
  v_refs uuid[];
  v_consent_scope text := 'none';
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;

  select * into v_policy
  from public.employer_job_conviction_policies
  where job_id = p_job_id and status = 'approved' and published_version_id is not null;
  if v_policy.id is null then
    raise exception 'NO_PUBLISHED_POLICY' using errcode = 'P0001';
  end if;

  select * into v_version from public.employer_job_conviction_policy_versions where id = v_policy.published_version_id;
  if v_version.id is null then raise exception 'PUBLISHED_VERSION_MISSING' using errcode = 'P0001'; end if;

  v_has_consent := public.justice_member_disclosure_consent(uid);

  select coalesce(jsonb_agg(jsonb_build_object(
    'chargeId', jc.id,
    'jurisdictionCode', jc2.jurisdiction_code,
    'statuteCode', jc.statute_code,
    'offenseCategory', jc.offense_category,
    'degree', jc.degree,
    'disposition', jc.disposition,
    'convictionDate', jc.conviction_date,
    'sentenceCompletionDate', jc.sentence_completion_date,
    'releaseDate', jc.release_date,
    'verificationState', jc.verification_state
  ) order by jc.count_number nulls last, jc.created_at), '[]'::jsonb)
  into v_charges
  from public.justice_charges jc
  join public.justice_cases jc2 on jc2.id = jc.case_id
  where jc.user_id = uid and jc.visibility = 'member';

  select coalesce(array_agg(jc.id order by jc.count_number nulls last), '{}')
  into v_refs
  from public.justice_charges jc
  where jc.user_id = uid and jc.visibility = 'member';

  if v_has_consent and coalesce(jsonb_array_length(v_charges), 0) > 0 then
    v_consent_scope := 'member_authorized_summary';
  end if;

  v_eval := public.justice_evaluate_policy_v1_sql(
    v_version.policy_json,
    case when v_has_consent then v_charges else '[]'::jsonb end,
    v_has_consent,
    current_date
  );

  insert into public.justice_match_evaluations (
    member_id, job_id, policy_version_id, outcome, explanation, charge_fact_refs, consent_scope, engine_version
  ) values (
    uid, p_job_id, v_version.id,
    v_eval ->> 'outcome',
    v_eval - 'engineVersion',
    v_refs,
    v_consent_scope,
    v_eval ->> 'engineVersion'
  )
  on conflict (member_id, job_id, policy_version_id) do update set
    outcome = excluded.outcome,
    explanation = excluded.explanation,
    charge_fact_refs = excluded.charge_fact_refs,
    consent_scope = excluded.consent_scope,
    evaluated_at = now(),
    engine_version = excluded.engine_version;

  return v_eval;
end;
$$;
revoke all on function public.evaluate_member_job_justice_match(uuid) from public, anon;
grant execute on function public.evaluate_member_job_justice_match(uuid) to authenticated, service_role;

grant select, insert, update, delete on public.justice_cases to service_role;
grant select, insert, update, delete on public.justice_charges to service_role;
grant select, insert, update, delete on public.employer_job_conviction_policies to service_role;
grant select, insert, update, delete on public.employer_job_conviction_policy_versions to service_role;
grant select, insert, update, delete on public.justice_match_evaluations to service_role;

-- =============================================================================
-- 9. Legacy backfill (service_role only — run once after column add)
-- =============================================================================
create or replace function public.service_backfill_justice_from_legacy(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv record;
  v_case_id uuid;
  v_charge_id uuid;
  v_rr record;
  n_conv integer := 0;
  n_rr integer := 0;
begin
  for v_conv in
    select c.* from public.convictions c
    where (p_user_id is null or c.user_id = p_user_id)
      and c.justice_charge_id is null
  loop
    insert into public.justice_cases (
      user_id, jurisdiction_code, state_code, county, court_name, case_number,
      docket_label, case_status, source_type, verification_state
    ) values (
      v_conv.user_id,
      coalesce(v_conv.state_code, 'US'),
      v_conv.state_code, v_conv.county, v_conv.court_name, v_conv.case_number,
      coalesce(nullif(btrim(v_conv.offense_title), ''), 'Legacy conviction'),
      'closed', v_conv.source_type, v_conv.verification_state
    ) returning id into v_case_id;

    insert into public.justice_charges (
      case_id, user_id, offense_name, statute_code, degree, disposition, conviction_date,
      release_date, visibility, legacy_conviction_id, source_type, verification_state
    ) values (
      v_case_id, v_conv.user_id,
      coalesce(nullif(btrim(v_conv.offense_title), ''), 'Unknown offense'),
      v_conv.offense_code,
      case
        when lower(coalesce(v_conv.offense_degree, v_conv.offense_level, '')) like '%felony%' then 'felony'
        when lower(coalesce(v_conv.offense_degree, v_conv.offense_level, '')) like '%misdemeanor%' then 'misdemeanor'
        else 'unknown'
      end,
      coalesce(nullif(v_conv.disposition, ''), 'conviction'),
      v_conv.conviction_date,
      v_conv.release_date,
      'member', v_conv.id, v_conv.source_type, v_conv.verification_state
    ) returning id into v_charge_id;

    update public.convictions set justice_charge_id = v_charge_id where id = v_conv.id;
    n_conv := n_conv + 1;
  end loop;

  for v_rr in
    select r.* from public.record_relief_cases r
    where (p_user_id is null or r.user_id = p_user_id)
      and r.justice_case_id is null
  loop
    insert into public.justice_cases (
      user_id, jurisdiction_code, court_name, case_number, county, city_name,
      docket_label, case_status, source_type, verification_state,
      court_id, federal_subtype
    ) values (
      v_rr.user_id,
      v_rr.jurisdiction_code,
      v_rr.court_name, v_rr.case_number, v_rr.county_name, v_rr.city_name,
      coalesce(nullif(btrim(v_rr.label), ''), 'Record Relief case'),
      'unknown', 'self_reported', 'self_reported',
      v_rr.court_id, v_rr.federal_subtype
    ) returning id into v_case_id;

    update public.record_relief_cases set justice_case_id = v_case_id where id = v_rr.id;
    n_rr := n_rr + 1;
  end loop;

  return jsonb_build_object('convictions_backfilled', n_conv, 'record_relief_cases_linked', n_rr);
end;
$$;
revoke all on function public.service_backfill_justice_from_legacy(uuid) from public, anon, authenticated;
grant execute on function public.service_backfill_justice_from_legacy(uuid) to service_role;

-- Rollback (manual): drop functions/triggers in §6–9; drop tables justice_match_evaluations,
-- employer_job_conviction_policy_versions, employer_job_conviction_policies; drop justice_* ;
-- drop record_relief_local_filing_profiles, record_relief_courts; drop added columns on convictions/RR/evaluations.
