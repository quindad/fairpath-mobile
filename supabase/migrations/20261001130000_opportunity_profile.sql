-- Opportunity Profile (forward-only). Migration 4 of the Profile + Resources pass.
--
-- The member-owned "what I can offer an employer" profile: work experience, education, credentials, skills,
-- job preferences, availability and transportation. Preferred location and radius keep living on profiles
-- (zip_code, search_radius_miles); contact fields stay on profiles/auth.
--
-- Boundaries (audited):
--   * Owner-only RLS. There is NO employer, partner or admin policy on any member_* table: employers never read the
--     live profile. They only ever see the snapshot written into job_applications.answers at submit time.
--   * The snapshot is built SERVER-SIDE by build_opportunity_snapshot() from an explicit column whitelist. It can
--     never include date of birth, home address, or anything from the justice-history tables, and the client cannot
--     supply snapshot content (submit_job_application ignores any client-sent snapshot).
--   * Sharing is an explicit member choice per application (share_opportunity_profile + share_sections); default off.
--   * Justice-readiness (profile_answers / readiness engine) is a separate system and is NOT part of completion here.
--   * Completion is computed from real rows: a fixed 8-section checklist, never a made-up percentage.

-- ---------------------------------------------------------------------
-- Row caps (keeps profiles reasonable and bounds employer-visible snapshots)
-- ---------------------------------------------------------------------
create or replace function public.member_row_cap()
returns trigger
language plpgsql
as $$
declare
  cap integer := tg_argv[0]::integer;
  n integer;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name) into n using new.user_id;
  if n >= cap then
    raise exception 'ROW_LIMIT:%', tg_table_name using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.member_work_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_title text not null check (length(btrim(job_title)) between 2 and 120),
  employer_name text not null check (length(btrim(employer_name)) between 2 and 120),
  location_text text check (location_text is null or length(location_text) <= 120),
  start_date date not null check (start_date >= date '1950-01-01'),
  end_date date,
  is_current boolean not null default false,
  description text check (description is null or length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_current = (end_date is null)),
  check (end_date is null or end_date >= start_date)
);
create index if not exists member_work_experience_user_idx on public.member_work_experience (user_id, start_date desc);

create table if not exists public.member_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_name text not null check (length(btrim(school_name)) between 2 and 120),
  credential text not null check (credential in ('high_school', 'ged', 'trade_certificate', 'associate', 'bachelor', 'graduate', 'other')),
  field_of_study text check (field_of_study is null or length(field_of_study) <= 120),
  start_year smallint check (start_year is null or start_year between 1950 and 2100),
  end_year smallint check (end_year is null or end_year between 1950 and 2100),
  status text not null default 'completed' check (status in ('completed', 'in_progress', 'incomplete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_year is null or end_year is null or end_year >= start_year)
);
create index if not exists member_education_user_idx on public.member_education (user_id);

create table if not exists public.member_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_type text not null check (credential_type in ('certification', 'license')),
  name text not null check (length(btrim(name)) between 2 and 140),
  issuer text check (issuer is null or length(issuer) <= 140),
  issued_date date check (issued_date is null or issued_date >= date '1950-01-01'),
  expires_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_date is null or issued_date is null or expires_date >= issued_date)
);
create index if not exists member_credentials_user_idx on public.member_credentials (user_id);
comment on table public.member_credentials is
  'Certifications and licenses the member lists. Self-reported; license/certificate NUMBERS are deliberately not stored.';

create table if not exists public.member_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (length(btrim(skill)) between 2 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists member_skills_unique_idx on public.member_skills (user_id, lower(btrim(skill)));

create table if not exists public.member_job_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  desired_titles text[] not null default '{}' check (cardinality(desired_titles) <= 5),
  employment_types text[] not null default '{}'
    check (employment_types <@ array['full_time', 'part_time', 'temporary', 'contract', 'seasonal']),
  workplace_types text[] not null default '{}' check (workplace_types <@ array['on_site', 'remote', 'hybrid']),
  pay_min_hourly numeric(7, 2) check (pay_min_hourly is null or pay_min_hourly between 0 and 1000),
  available_days text[] not null default '{}' check (available_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  shift_preferences text[] not null default '{}' check (shift_preferences <@ array['morning', 'afternoon', 'evening', 'overnight', 'weekends']),
  earliest_start_date date,
  transportation_modes text[] not null default '{}'
    check (transportation_modes <@ array['own_vehicle', 'public_transit', 'rideshare', 'bike', 'walk', 'carpool', 'none']),
  has_drivers_license boolean,
  willing_to_relocate boolean,
  no_work_experience_yet boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on column public.member_job_preferences.no_work_experience_yet is
  'Lets a member with no work history (or a long gap) complete the experience section honestly. Never shown to employers as a negative.';
comment on column public.member_job_preferences.pay_min_hourly is
  'Private to the member. It is NOT part of the employer snapshot.';

drop trigger if exists member_work_experience_cap on public.member_work_experience;
create trigger member_work_experience_cap before insert on public.member_work_experience
  for each row execute function public.member_row_cap(20);
drop trigger if exists member_education_cap on public.member_education;
create trigger member_education_cap before insert on public.member_education
  for each row execute function public.member_row_cap(10);
drop trigger if exists member_credentials_cap on public.member_credentials;
create trigger member_credentials_cap before insert on public.member_credentials
  for each row execute function public.member_row_cap(20);
drop trigger if exists member_skills_cap on public.member_skills;
create trigger member_skills_cap before insert on public.member_skills
  for each row execute function public.member_row_cap(40);

-- Dates cannot be in the future (a job that started tomorrow is not experience).
create or replace function public.member_profile_validate()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'member_work_experience' then
    if new.start_date > current_date or (new.end_date is not null and new.end_date > current_date) then
      raise exception 'INVALID_DATE' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'member_credentials' then
    if new.issued_date is not null and new.issued_date > current_date then
      raise exception 'INVALID_DATE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists member_work_experience_validate on public.member_work_experience;
create trigger member_work_experience_validate before insert or update on public.member_work_experience
  for each row execute function public.member_profile_validate();
drop trigger if exists member_credentials_validate on public.member_credentials;
create trigger member_credentials_validate before insert or update on public.member_credentials
  for each row execute function public.member_profile_validate();
drop trigger if exists member_education_touch on public.member_education;
create trigger member_education_touch before update on public.member_education
  for each row execute function public.member_profile_validate();
drop trigger if exists member_job_preferences_touch on public.member_job_preferences;
create trigger member_job_preferences_touch before update on public.member_job_preferences
  for each row execute function public.member_profile_validate();

-- ---------------------------------------------------------------------
-- RLS: owner only. No employer/partner/admin policy exists on purpose.
-- ---------------------------------------------------------------------
alter table public.member_work_experience enable row level security;
alter table public.member_education enable row level security;
alter table public.member_credentials enable row level security;
alter table public.member_skills enable row level security;
alter table public.member_job_preferences enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['member_work_experience', 'member_education', 'member_credentials', 'member_skills', 'member_job_preferences'] loop
    execute format('drop policy if exists "%s_owner_select" on public.%I', t, t);
    execute format('create policy "%s_owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
    execute format('drop policy if exists "%s_owner_insert" on public.%I', t, t);
    execute format('create policy "%s_owner_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t, t);
    execute format('drop policy if exists "%s_owner_update" on public.%I', t, t);
    execute format('create policy "%s_owner_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('drop policy if exists "%s_owner_delete" on public.%I', t, t);
    execute format('create policy "%s_owner_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end $$;

grant select, insert, update, delete on table public.member_work_experience to authenticated;
grant select, insert, update, delete on table public.member_education to authenticated;
grant select, insert, update, delete on table public.member_credentials to authenticated;
grant select, insert, update, delete on table public.member_skills to authenticated;
grant select, insert, update, delete on table public.member_job_preferences to authenticated;

grant select, insert, update, delete on table public.member_work_experience to service_role;
grant select, insert, update, delete on table public.member_education to service_role;
grant select, insert, update, delete on table public.member_credentials to service_role;
grant select, insert, update, delete on table public.member_skills to service_role;
grant select, insert, update, delete on table public.member_job_preferences to service_role;

-- ---------------------------------------------------------------------
-- Real completion: 8 fixed sections computed from real rows
-- ---------------------------------------------------------------------
create or replace function public.get_opportunity_completion()
returns table (section_key text, label text, is_complete boolean, detail text, sort_order integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  prefs public.member_job_preferences%rowtype;
  n_exp integer;
  n_edu integer;
  n_skill integer;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into prof from public.profiles p where p.id = uid;
  select * into prefs from public.member_job_preferences mp where mp.user_id = uid;
  select count(*) into n_exp from public.member_work_experience e where e.user_id = uid;
  select count(*) into n_edu from public.member_education e where e.user_id = uid;
  select count(*) into n_skill from public.member_skills s where s.user_id = uid;

  return query values
    ('contact'::text, 'Contact details'::text,
       (length(btrim(coalesce(prof.first_name, ''))) >= 2 and length(btrim(coalesce(prof.last_name, ''))) >= 2
         and length(regexp_replace(coalesce(prof.phone, ''), '[^0-9]', '', 'g')) = 10),
       'Name and phone number'::text, 1),
    ('location', 'Where you want to work',
       (prof.zip_code is not null and prof.zip_code ~ '^[0-9]{5}$'),
       'ZIP code and search radius', 2),
    ('work_experience', 'Work experience',
       (n_exp > 0 or coalesce(prefs.no_work_experience_yet, false)),
       case when coalesce(prefs.no_work_experience_yet, false) and n_exp = 0 then 'No work history yet'
            else n_exp::text || ' added' end, 3),
    ('education', 'Education', (n_edu > 0), n_edu::text || ' added', 4),
    ('skills', 'Skills', (n_skill >= 3), n_skill::text || ' of at least 3 added', 5),
    ('preferences', 'Job preferences',
       (cardinality(coalesce(prefs.desired_titles, '{}')) >= 1 and cardinality(coalesce(prefs.employment_types, '{}')) >= 1),
       'Roles you want and job types', 6),
    ('availability', 'Availability',
       (cardinality(coalesce(prefs.available_days, '{}')) >= 1 or cardinality(coalesce(prefs.shift_preferences, '{}')) >= 1),
       'Days or shifts you can work', 7),
    ('transportation', 'Transportation',
       (cardinality(coalesce(prefs.transportation_modes, '{}')) >= 1),
       'How you get to work', 8);
end;
$$;
revoke all on function public.get_opportunity_completion() from public;
grant execute on function public.get_opportunity_completion() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Employer-safe snapshot (server-built, whitelist only). Internal: not granted to clients.
-- ---------------------------------------------------------------------
create or replace function public.build_opportunity_snapshot(p_user uuid, p_sections text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed text[] := array['experience', 'education', 'credentials', 'skills', 'preferences', 'availability', 'transportation'];
  wanted text[] := array(select s from unnest(coalesce(p_sections, '{}'::text[])) s where s = any (allowed));
  prefs public.member_job_preferences%rowtype;
  snap jsonb := jsonb_build_object('taken_at', now(), 'sections', to_jsonb(wanted));
begin
  if cardinality(wanted) = 0 then return null; end if;
  select * into prefs from public.member_job_preferences mp where mp.user_id = p_user;

  if 'experience' = any (wanted) then
    snap := snap || jsonb_build_object('work_experience', coalesce((
      select jsonb_agg(jsonb_build_object('job_title', e.job_title, 'employer_name', e.employer_name, 'location', e.location_text,
        'start_date', e.start_date, 'end_date', e.end_date, 'is_current', e.is_current, 'description', e.description)
        order by e.start_date desc)
      from public.member_work_experience e where e.user_id = p_user), '[]'::jsonb));
  end if;
  if 'education' = any (wanted) then
    snap := snap || jsonb_build_object('education', coalesce((
      select jsonb_agg(jsonb_build_object('school_name', e.school_name, 'credential', e.credential, 'field_of_study', e.field_of_study,
        'start_year', e.start_year, 'end_year', e.end_year, 'status', e.status) order by e.end_year desc nulls first)
      from public.member_education e where e.user_id = p_user), '[]'::jsonb));
  end if;
  if 'credentials' = any (wanted) then
    snap := snap || jsonb_build_object('credentials', coalesce((
      select jsonb_agg(jsonb_build_object('credential_type', c.credential_type, 'name', c.name, 'issuer', c.issuer,
        'issued_date', c.issued_date, 'expires_date', c.expires_date) order by c.name)
      from public.member_credentials c where c.user_id = p_user), '[]'::jsonb));
  end if;
  if 'skills' = any (wanted) then
    snap := snap || jsonb_build_object('skills', coalesce((
      select jsonb_agg(s.skill order by lower(s.skill)) from public.member_skills s where s.user_id = p_user), '[]'::jsonb));
  end if;
  if 'preferences' = any (wanted) then
    snap := snap || jsonb_build_object('preferences', jsonb_build_object(
      'desired_titles', to_jsonb(coalesce(prefs.desired_titles, '{}')),
      'employment_types', to_jsonb(coalesce(prefs.employment_types, '{}')),
      'workplace_types', to_jsonb(coalesce(prefs.workplace_types, '{}'))));
  end if;
  if 'availability' = any (wanted) then
    snap := snap || jsonb_build_object('availability', jsonb_build_object(
      'available_days', to_jsonb(coalesce(prefs.available_days, '{}')),
      'shift_preferences', to_jsonb(coalesce(prefs.shift_preferences, '{}')),
      'earliest_start_date', prefs.earliest_start_date));
  end if;
  if 'transportation' = any (wanted) then
    snap := snap || jsonb_build_object('transportation', jsonb_build_object(
      'modes', to_jsonb(coalesce(prefs.transportation_modes, '{}')),
      'has_drivers_license', prefs.has_drivers_license));
  end if;
  return snap;
end;
$$;
revoke all on function public.build_opportunity_snapshot(uuid, text[]) from public, anon, authenticated;
grant execute on function public.build_opportunity_snapshot(uuid, text[]) to service_role;

-- ---------------------------------------------------------------------
-- submit_job_application: same rules as before + the optional, member-chosen, server-built snapshot.
-- ---------------------------------------------------------------------
create or replace function public.submit_job_application(p_job_id uuid, p_answers jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs%rowtype;
  prof jsonb := coalesce(p_answers -> 'profile', '{}'::jsonb);
  eq jsonb := coalesce(p_answers -> 'employer_questions', '{}'::jsonb);
  first_name text := btrim(coalesce(prof ->> 'first_name', ''));
  last_name text := btrim(coalesce(prof ->> 'last_name', ''));
  phone_digits text := regexp_replace(coalesce(prof ->> 'phone', ''), '[^0-9]', '', 'g');
  email text := btrim(coalesce(auth.jwt() ->> 'email', ''));
  stored_profile jsonb;
  stored_eq jsonb := '{}'::jsonb;
  stored_answers jsonb;
  share boolean := coalesce((p_answers ->> 'share_opportunity_profile')::boolean, false);
  share_sections text[] := '{}';
  snap jsonb;
  q jsonb;
  qid text;
  ans text;
  app_id uuid;
  opt text;
begin
  if uid is null then
    raise exception 'SIGNED_OUT' using errcode = 'P0001';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if not found or j.status <> 'published' or (j.expires_at is not null and j.expires_at <= now()) then
    raise exception 'JOB_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if j.application_method = 'external' then
    raise exception 'EXTERNAL_APPLICATION' using errcode = 'P0001';
  end if;

  -- Duplicate first: a member who already applied is told so, whatever the payload looks like.
  if exists (select 1 from public.job_applications a where a.user_id = uid and a.job_id = p_job_id) then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  -- Minimum an employer needs to contact an applicant: name, email, phone.
  if length(first_name) < 2 then raise exception 'INVALID_APPLICATION:first_name' using errcode = 'P0001'; end if;
  if length(last_name) < 2 then raise exception 'INVALID_APPLICATION:last_name' using errcode = 'P0001'; end if;
  if length(phone_digits) <> 10 then raise exception 'INVALID_APPLICATION:phone' using errcode = 'P0001'; end if;
  if email = '' then raise exception 'INVALID_APPLICATION:email' using errcode = 'P0001'; end if;

  stored_profile := jsonb_build_object(
    'first_name', left(first_name, 80),
    'last_name', left(last_name, 80),
    'email', left(email, 254),
    'phone', phone_digits
  );
  foreach opt in array array['education', 'skills', 'certifications', 'desired_roles'] loop
    if nullif(btrim(coalesce(prof ->> opt, '')), '') is not null then
      stored_profile := stored_profile || jsonb_build_object(opt, left(btrim(prof ->> opt), 500));
    end if;
  end loop;
  if (prof ->> 'resume_ready') in ('Yes', 'No') then
    stored_profile := stored_profile || jsonb_build_object('resume_ready', prof ->> 'resume_ready');
  end if;

  -- Only the employer's own questions are accepted; required ones must be answered.
  for q in select * from jsonb_array_elements(coalesce(j.application_questions, '[]'::jsonb)) loop
    qid := q ->> 'id';
    continue when qid is null;
    ans := btrim(coalesce(eq ->> qid, ''));
    if coalesce((q ->> 'required')::boolean, false) and ans = '' then
      raise exception 'INVALID_APPLICATION:question:%', qid using errcode = 'P0001';
    end if;
    if ans <> '' then
      stored_eq := stored_eq || jsonb_build_object(qid, left(ans, 2000));
    end if;
  end loop;

  stored_answers := jsonb_build_object(
    'profile', stored_profile,
    'employer_questions', stored_eq,
    'submitted_via', 'easy_apply',
    'reviewed_by_user', true
  );

  -- Optional opportunity-profile snapshot: member opted in, sections chosen by the member, CONTENT built here from
  -- the member's own rows. Anything the client sends as a snapshot is ignored.
  if share then
    select coalesce(array_agg(x), '{}') into share_sections
    from jsonb_array_elements_text(coalesce(p_answers -> 'share_sections', '[]'::jsonb)) x;
    snap := public.build_opportunity_snapshot(uid, share_sections);
    if snap is not null then
      stored_answers := stored_answers || jsonb_build_object('opportunity_snapshot', snap);
    end if;
  end if;

  insert into public.job_applications (user_id, job_id, status, answers, submitted_at, updated_at)
  values (uid, p_job_id, 'submitted', stored_answers, now(), now())
  on conflict (user_id, job_id) do nothing
  returning id into app_id;

  if app_id is null then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;
  return app_id;
end;
$$;
revoke all on function public.submit_job_application(uuid, jsonb) from public, anon;
grant execute on function public.submit_job_application(uuid, jsonb) to authenticated, service_role;
