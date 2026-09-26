-- Jobs production pass (forward-only).
--
--   1. postal_codes + resolve_postal_center(): ZIP -> coordinates
--   2. search_jobs(): server-side ZIP/radius, text, type, second-chance
--      filtering with offset pagination and result counts
--   3. job_application_events: append-only audit trail for applications
--   4. submit_job_application() / withdraw_job_application(): the only
--      way clients create or withdraw applications (direct INSERT revoked)
--
-- Privacy: an application stores ONLY a whitelist of applicant contact
-- fields plus answers to the employer's own questions. Date of birth,
-- home address and every conviction/justice field are never accepted,
-- so employers cannot read them through job_applications.

-- ---------------------------------------------------------------------
-- 1. ZIP -> coordinates
-- ---------------------------------------------------------------------
create table if not exists public.postal_codes (
  postal_code text primary key check (postal_code ~ '^[0-9]{5}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  city text,
  state_code text,
  source text not null default 'import',
  created_at timestamptz not null default now()
);
comment on table public.postal_codes is
  'ZIP centroids used by search_jobs radius search. Load the Census ZCTA gazetteer here (service role). resolve_postal_center() falls back to the average coordinates of listings in the same ZIP / 3-digit prefix when a ZIP is missing.';

alter table public.postal_codes enable row level security;
drop policy if exists "postal_codes_read_all" on public.postal_codes;
create policy "postal_codes_read_all" on public.postal_codes
  for select to anon, authenticated using (true);

grant select on table public.postal_codes to anon, authenticated;
grant select, insert, update, delete on table public.postal_codes to service_role;

create or replace function public.resolve_postal_center(p_zip text)
returns table (latitude double precision, longitude double precision)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  z text := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  lat double precision;
  lng double precision;
begin
  if length(z) <> 5 then return; end if;

  select pc.latitude, pc.longitude into lat, lng from public.postal_codes pc where pc.postal_code = z;

  if lat is null then
    select avg(x.la), avg(x.ln) into lat, lng from (
      select j.latitude as la, j.longitude as ln from public.jobs j
        where j.postal_code = z and j.latitude is not null and j.longitude is not null
      union all
      select h.latitude, h.longitude from public.housing_listings h
        where h.postal_code = z and h.latitude is not null and h.longitude is not null
    ) x;
  end if;

  if lat is null then
    select avg(x.la), avg(x.ln) into lat, lng from (
      select j.latitude as la, j.longitude as ln from public.jobs j
        where left(j.postal_code, 3) = left(z, 3) and j.latitude is not null and j.longitude is not null
      union all
      select h.latitude, h.longitude from public.housing_listings h
        where left(h.postal_code, 3) = left(z, 3) and h.latitude is not null and h.longitude is not null
    ) x;
  end if;

  if lat is not null then
    latitude := lat;
    longitude := lng;
    return next;
  end if;
end;
$$;

revoke all on function public.resolve_postal_center(text) from public;
grant execute on function public.resolve_postal_center(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Server-side job search
-- ---------------------------------------------------------------------
-- Runs as the caller (SECURITY INVOKER), so the existing RLS on public.jobs
-- ("Published jobs are readable") still decides which rows are visible.
--
-- Location rules
--   * p_zip given and resolvable: jobs within p_radius_miles of the ZIP
--     centre, PLUS remote jobs, PLUS jobs whose postal_code equals the ZIP.
--   * p_zip given but not resolvable: exact-ZIP and remote jobs only.
--   * no p_zip but p_location text: city / state / location text match.
-- Counts (total_count, second_chance_count) describe the set BEFORE the
-- second-chance filter so the "All / Second chance" lane counts stay right.
create or replace function public.search_jobs(
  p_query text default null,
  p_zip text default null,
  p_radius_miles integer default 25,
  p_location text default null,
  p_remote boolean default false,
  p_employment_type text default null,
  p_second_chance boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  job jsonb,
  distance_miles double precision,
  total_count bigint,
  second_chance_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  loc text := nullif(lower(btrim(coalesce(p_location, ''))), '');
  z text := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  radius integer := least(greatest(coalesce(p_radius_miles, 25), 1), 500);
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  off integer := greatest(coalesce(p_offset, 0), 0);
  clat double precision;
  clng double precision;
begin
  if length(z) = 5 then
    select c.latitude, c.longitude into clat, clng from public.resolve_postal_center(z) c;
  else
    z := null;
  end if;

  return query
  with base as (
    select
      j.*,
      case
        when clat is not null and j.latitude is not null and j.longitude is not null then
          3958.8 * 2 * asin(sqrt(least(1,
            power(sin(radians(j.latitude - clat) / 2), 2)
            + cos(radians(clat)) * cos(radians(j.latitude)) * power(sin(radians(j.longitude - clng) / 2), 2)
          )))
        else null
      end as dist
    from public.jobs j
    where j.status = 'published'
      and (j.expires_at is null or j.expires_at > now())
      and (q is null
           or position(q in lower(j.title)) > 0
           or position(q in lower(j.company_name)) > 0
           or position(q in lower(j.description)) > 0)
      and (not coalesce(p_remote, false) or j.workplace_type = 'remote')
      and (p_employment_type is null or j.employment_type = p_employment_type)
      and (z is not null or loc is null
           or position(loc in lower(coalesce(j.location_text, ''))) > 0
           or position(loc in lower(coalesce(j.city, ''))) > 0
           or position(loc in lower(coalesce(j.state, ''))) > 0)
  ),
  located as (
    select b.*,
           count(*) over () as all_count,
           count(*) filter (where b.eligibility_rules ->> 'second_chance_evidence' = 'explicit') over () as sc_count
    from base b
    where z is null
       or b.workplace_type = 'remote'
       or b.postal_code = z
       or (b.dist is not null and b.dist <= radius)
  )
  select
    jsonb_build_object(
      'id', l.id, 'title', l.title, 'company_name', l.company_name,
      'description', left(l.description, 400),
      'location_text', l.location_text, 'city', l.city, 'state', l.state, 'postal_code', l.postal_code,
      'workplace_type', l.workplace_type, 'employment_type', l.employment_type,
      'pay_min', l.pay_min, 'pay_max', l.pay_max, 'pay_period', l.pay_period,
      'benefits', coalesce(l.benefits, '{}'), 'skills', coalesce(l.skills, '{}'), 'requirements', coalesce(l.requirements, '{}'),
      'background_policy_summary', l.background_policy_summary,
      'eligibility_rules', l.eligibility_rules,
      'application_method', l.application_method, 'external_apply_url', l.external_apply_url,
      'company_website_url', l.company_website_url,
      'source_label', l.source_label, 'source_url', l.source_url,
      'featured', l.featured, 'created_at', l.created_at, 'status', l.status,
      'published_at', l.published_at, 'expires_at', l.expires_at, 'closed_at', l.closed_at,
      'latitude', l.latitude, 'longitude', l.longitude, 'location_precision', l.location_precision,
      'easy_apply_enabled', l.easy_apply_enabled, 'application_questions', l.application_questions
    ),
    l.dist,
    l.all_count,
    l.sc_count
  from located l
  where not coalesce(p_second_chance, false)
     or l.eligibility_rules ->> 'second_chance_evidence' = 'explicit'
  order by l.featured desc, l.dist asc nulls last, l.created_at desc, l.id
  limit lim offset off;
end;
$$;

revoke all on function public.search_jobs(text, text, integer, text, boolean, text, boolean, integer, integer) from public;
grant execute on function public.search_jobs(text, text, integer, text, boolean, text, boolean, integer, integer)
  to anon, authenticated, service_role;

-- Supports the default listing order and the status/expiry filter.
create index if not exists jobs_published_listing_idx
  on public.jobs (featured desc, created_at desc, id)
  where status = 'published';

-- ---------------------------------------------------------------------
-- 3. Application audit trail
-- ---------------------------------------------------------------------
create table if not exists public.job_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('submitted', 'status_changed', 'withdrawn')),
  from_status text,
  to_status text not null,
  actor_type text not null check (actor_type in ('applicant', 'employer', 'system')),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists job_application_events_application_idx
  on public.job_application_events (application_id, created_at);
create index if not exists job_application_events_applicant_idx
  on public.job_application_events (applicant_id, created_at desc);

comment on table public.job_application_events is
  'Append-only history of job application status changes. Written only by triggers on job_applications; clients can read their own events.';

alter table public.job_application_events enable row level security;

drop policy if exists "job_application_events_applicant_read" on public.job_application_events;
create policy "job_application_events_applicant_read" on public.job_application_events
  for select to authenticated using (applicant_id = (select auth.uid()));

drop policy if exists "job_application_events_employer_read" on public.job_application_events;
create policy "job_application_events_employer_read" on public.job_application_events
  for select to authenticated using (
    exists (select 1 from public.jobs j where j.id = job_application_events.job_id and j.employer_id = (select auth.uid()))
  );

grant select on table public.job_application_events to authenticated;
grant select, insert, update, delete on table public.job_application_events to service_role;

create or replace function public.log_job_application_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  who text;
begin
  who := case
    when uid is null then 'system'
    when uid = new.user_id then 'applicant'
    else 'employer'
  end;

  if tg_op = 'INSERT' then
    insert into public.job_application_events
      (application_id, job_id, applicant_id, event_type, from_status, to_status, actor_type, actor_id)
    values (new.id, new.job_id, new.user_id, 'submitted', null, new.status, who, uid);
  elsif new.status is distinct from old.status then
    insert into public.job_application_events
      (application_id, job_id, applicant_id, event_type, from_status, to_status, actor_type, actor_id)
    values (
      new.id, new.job_id, new.user_id,
      case when new.status = 'withdrawn' then 'withdrawn' else 'status_changed' end,
      old.status, new.status, who, uid
    );
  end if;
  return null;
end;
$$;

revoke all on function public.log_job_application_event() from public, anon, authenticated;
grant execute on function public.log_job_application_event() to service_role;

drop trigger if exists job_applications_log_insert on public.job_applications;
create trigger job_applications_log_insert
  after insert on public.job_applications
  for each row execute function public.log_job_application_event();

drop trigger if exists job_applications_log_status on public.job_applications;
create trigger job_applications_log_status
  after update of status on public.job_applications
  for each row execute function public.log_job_application_event();

-- Existing applications get a starting event so every history is non-empty.
insert into public.job_application_events
  (application_id, job_id, applicant_id, event_type, from_status, to_status, actor_type, created_at)
select a.id, a.job_id, a.user_id, 'submitted', null, a.status, 'system', coalesce(a.submitted_at, a.updated_at)
from public.job_applications a
where not exists (select 1 from public.job_application_events e where e.application_id = a.id);

-- ---------------------------------------------------------------------
-- 4. Application RPCs
-- ---------------------------------------------------------------------
-- Clients may no longer insert applications directly (they could set any
-- status and any answers). The RPC validates the job, the applicant's
-- minimum contact details and the employer's required questions, and
-- stores only whitelisted fields.
drop policy if exists "Applicants create own applications" on public.job_applications;
revoke insert, delete on table public.job_applications from authenticated;

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

  insert into public.job_applications (user_id, job_id, status, answers, submitted_at, updated_at)
  values (
    uid, p_job_id, 'submitted',
    jsonb_build_object(
      'profile', stored_profile,
      'employer_questions', stored_eq,
      'submitted_via', 'easy_apply',
      'reviewed_by_user', true
    ),
    now(), now()
  )
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

create or replace function public.withdraw_job_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated integer;
begin
  if uid is null then
    raise exception 'SIGNED_OUT' using errcode = 'P0001';
  end if;

  update public.job_applications
     set status = 'withdrawn', updated_at = now()
   where id = p_application_id
     and user_id = uid
     and status in ('submitted', 'viewed', 'interview', 'offer');
  get diagnostics updated = row_count;

  if updated = 0 then
    raise exception 'CANNOT_WITHDRAW' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.withdraw_job_application(uuid) from public, anon;
grant execute on function public.withdraw_job_application(uuid) to authenticated, service_role;
