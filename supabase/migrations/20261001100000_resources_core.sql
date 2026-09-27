-- Resources core (forward-only). Migration 1 of the Profile + Resources pass.
--
--   1. Taxonomy: resource_categories (17 blueprint categories) + resource_needs (plain-language need -> categories)
--   2. Organizations + organization_members (Partner ownership path; no Partner UI yet)
--   3. resources + locations, service areas, hours, eligibility, contacts, required documents, category links
--   4. resource_verification_events (append-only)
--   5. Helpers: is_fairpath_admin(), is_org_manager(), resource_freshness()
--   6. DEV-fixture guard: rows marked data_origin = 'dev_fixture' can only exist when app_config.environment = 'dev'
--
-- Security model
--   * Every resource_* base table has RLS enabled and NO policy for anon/authenticated: members and guests read
--     ONLY through the security-definer functions added in the next migration, which return published + verified,
--     fresh-enough rows. Unverified, draft, rejected and expired records never reach them.
--   * Partners (organization_members) will edit drafts later; verification fields are admin-only by design.
--   * Test fixtures are NEVER inserted by a migration (migrations also run on production). They are loaded by
--     scripts/seed-dev-resources.mjs, and the guard below makes production physically reject them.

-- ---------------------------------------------------------------------
-- 1. Taxonomy (product data, safe for every environment)
-- ---------------------------------------------------------------------
create table if not exists public.resource_categories (
  slug text primary key check (slug ~ '^[a-z][a-z0-9_]*$'),
  parent_slug text references public.resource_categories(slug),
  label text not null,
  description text,
  sort_order integer not null default 100,
  urgent_default boolean not null default false
);

create table if not exists public.resource_needs (
  need_slug text primary key check (need_slug ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  synonyms text[] not null default '{}',
  category_slugs text[] not null default '{}',
  urgent boolean not null default false,
  sort_order integer not null default 100
);
comment on table public.resource_needs is
  'Plain-language need phrases mapped to categories. Data-driven so search never hardcodes unrelated UI branches.';

insert into public.resource_categories (slug, label, description, sort_order, urgent_default) values
  ('emergency_help',      'Emergency help',        'Immediate safety, shelter, crisis and same-day needs', 10, true),
  ('food',                'Food',                  'Food pantries, meals and groceries',                   20, true),
  ('housing',             'Housing',               'Shelter, rental help and housing programs',            30, true),
  ('health_wellness',     'Health and wellness',   'Medical, mental health and recovery care',             40, false),
  ('id_documents',        'ID and documents',      'State IDs, birth certificates and records',            50, false),
  ('jobs',                'Jobs and training',     'Employment programs, training and job support',        60, false),
  ('legal_record_relief', 'Legal and record relief','Legal aid, expungement and sealing help',              70, false),
  ('benefits',            'Benefits',              'Public benefits and enrollment help',                  80, false),
  ('transportation',      'Transportation',        'Transit passes, rides and vehicle help',               90, false),
  ('money',               'Money',                 'Financial help, budgeting and assistance funds',      100, false),
  ('banking',             'Banking',               'Second-chance and low-cost accounts',                 110, false),
  ('credit',              'Credit',                'Credit building and repair help',                     120, false),
  ('education',           'Education',             'GED, college and skills courses',                     130, false),
  ('family',              'Family',                'Childcare, parenting and reunification support',      140, false),
  ('clothing',            'Clothing',              'Work and everyday clothing',                          150, false),
  ('technology',          'Technology',            'Phones, internet and devices',                        160, false),
  ('entrepreneurship',    'Entrepreneurship',      'Business training, funding and mentoring',            170, false)
on conflict (slug) do nothing;

insert into public.resource_needs (need_slug, label, synonyms, category_slugs, urgent, sort_order) values
  ('food_today',   'Food today',          array['food','hungry','meal','meals','eat','groceries','pantry','food bank'],                  array['food'],                         true,  10),
  ('place_to_stay','Somewhere to stay',   array['shelter','place to stay','somewhere to stay','homeless','sleep','housing help','rent'],  array['housing','emergency_help'],     true,  20),
  ('crisis',       'Crisis or safety',    array['crisis','unsafe','abuse','domestic violence','suicide','emergency','danger'],            array['emergency_help','health_wellness'], true, 30),
  ('utilities',    'Utilities help',      array['utilities','electric','power bill','gas bill','water bill','shut off','heat'],           array['money','emergency_help'],       true,  40),
  ('get_id',       'Get an ID',           array['id','identification','state id','birth certificate','social security card','license','documents'], array['id_documents'], false, 50),
  ('get_around',   'Transportation',      array['bus','transit','ride','car','transportation','bus pass','gas'],                           array['transportation'],               false, 60),
  ('legal_help',   'Legal help',          array['lawyer','legal','expunge','expungement','seal','sealing','record','court','attorney'],   array['legal_record_relief'],          false, 70),
  ('find_training','Training and work',   array['training','job','jobs','work','employment','career','apprenticeship','resume'],           array['jobs','education'],             false, 80),
  ('healthcare',   'Healthcare',          array['doctor','medical','health','clinic','medication','mental health','therapy','counseling','recovery','rehab'], array['health_wellness'], false, 90),
  ('benefits',     'Benefits',            array['benefits','snap','medicaid','food stamps','ssi','unemployment','cash assistance'],        array['benefits'],                     false, 100),
  ('money_help',   'Financial help',      array['money','financial','loan','budget','assistance','bills','debt'],                          array['money','banking','credit'],     false, 110),
  ('education',    'School and GED',      array['school','ged','college','class','classes','degree','diploma'],                            array['education'],                    false, 120),
  ('family_help',  'Family support',      array['child','children','kids','childcare','parent','custody','family'],                        array['family'],                       false, 130),
  ('clothing',     'Clothing',            array['clothes','clothing','interview outfit','work boots','shoes'],                             array['clothing'],                     false, 140),
  ('phone_internet','Phone and internet', array['phone','internet','wifi','laptop','computer','device'],                                    array['technology'],                   false, 150),
  ('start_business','Start a business',   array['business','startup','self employed','entrepreneur','grant','funding'],                   array['entrepreneurship'],             false, 160)
on conflict (need_slug) do nothing;

-- ---------------------------------------------------------------------
-- 2. Organizations and ownership
-- ---------------------------------------------------------------------
create table if not exists public.resource_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  org_type text not null default 'nonprofit'
    check (org_type in ('government', 'nonprofit', 'faith', 'employer', 'provider', 'other')),
  website_url text,
  description text,
  is_national boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  fixture_set text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_origin = 'dev_fixture' or fixture_set is null),
  check (data_origin <> 'dev_fixture' or fixture_set is not null)
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'editor' check (member_role in ('owner', 'manager', 'editor')),
  status text not null default 'active' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------
-- 3. Resources (the searchable program / service record)
-- ---------------------------------------------------------------------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 200),
  summary text not null check (length(btrim(summary)) between 10 and 500),
  description text,
  resource_kind text not null default 'program'
    check (resource_kind in ('program', 'service', 'benefit', 'hotline', 'document_help', 'course_link')),
  delivery_mode text not null default 'in_person'
    check (delivery_mode in ('in_person', 'virtual', 'phone', 'hybrid')),
  is_national boolean not null default false,
  cost_type text not null default 'unknown' check (cost_type in ('free', 'sliding', 'paid', 'unknown')),
  cost_notes text,
  urgency_tier smallint not null default 0 check (urgency_tier between 0 and 2),
  eligibility_summary text,
  how_to_access text,
  application_url text,
  official_source_url text,
  source_authority text not null default 'community'
    check (source_authority in ('government', 'nonprofit', 'partner_submitted', 'community', 'test_fixture')),
  publish_status text not null default 'draft'
    check (publish_status in ('draft', 'pending_review', 'published', 'retired')),
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified', 'verified', 'rejected')),
  last_verified_at timestamptz,
  verify_by timestamptz,
  languages text[] not null default '{en}',
  accessibility text[] not null default '{}'
    check (accessibility <@ array['wheelchair','asl','translation','transit_nearby','free_parking','childcare','text_relay','screen_reader']),
  hours_note text,
  revision_of uuid references public.resources(id) on delete set null,
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  fixture_set text,
  search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Invariants the member-facing search relies on.
  check (verification_state <> 'verified' or last_verified_at is not null),
  check (publish_status <> 'published' or verification_state = 'verified'),
  check (data_origin = 'dev_fixture' or fixture_set is null),
  check (data_origin <> 'dev_fixture' or fixture_set is not null)
);
create index if not exists resources_search_idx on public.resources using gin (search_tsv);
create index if not exists resources_published_idx on public.resources (verification_state, publish_status, urgency_tier desc);
create index if not exists resources_org_idx on public.resources (organization_id);
create index if not exists resources_fixture_idx on public.resources (fixture_set) where fixture_set is not null;

create table if not exists public.resource_category_links (
  resource_id uuid not null references public.resources(id) on delete cascade,
  category_slug text not null references public.resource_categories(slug),
  is_primary boolean not null default false,
  primary key (resource_id, category_slug)
);
create index if not exists resource_category_links_cat_idx on public.resource_category_links (category_slug);

create table if not exists public.resource_locations (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  label text not null default 'Main location',
  address_line text,
  city text,
  state_code text,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  phone text,
  timezone text not null default 'America/New_York',
  is_virtual boolean not null default false,
  accessibility text[] not null default '{}'
    check (accessibility <@ array['wheelchair','asl','translation','transit_nearby','free_parking','childcare','text_relay','screen_reader']),
  created_at timestamptz not null default now()
);
create index if not exists resource_locations_resource_idx on public.resource_locations (resource_id);
create index if not exists resource_locations_zip_idx on public.resource_locations (postal_code);

create table if not exists public.resource_service_areas (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  area_type text not null check (area_type in ('national', 'state', 'county', 'zip', 'radius')),
  state_code text,
  county_fips text,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  center_latitude double precision,
  center_longitude double precision,
  radius_miles integer check (radius_miles is null or radius_miles between 1 and 500),
  check (area_type <> 'state'  or state_code is not null),
  check (area_type <> 'county' or (county_fips is not null and state_code is not null)),
  check (area_type <> 'zip'    or postal_code is not null),
  check (area_type <> 'radius' or (center_latitude is not null and center_longitude is not null and radius_miles is not null))
);
create index if not exists resource_service_areas_resource_idx on public.resource_service_areas (resource_id);
create index if not exists resource_service_areas_zip_idx on public.resource_service_areas (postal_code) where area_type = 'zip';
create index if not exists resource_service_areas_state_idx on public.resource_service_areas (state_code) where area_type = 'state';

create table if not exists public.resource_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.resource_locations(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_24h boolean not null default false,
  note text,
  check (is_24h or (opens_at is not null and closes_at is not null))
);
create index if not exists resource_hours_location_idx on public.resource_hours (location_id, weekday);

create table if not exists public.resource_eligibility (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  rule_type text not null
    check (rule_type in ('age_min', 'age_max', 'residency', 'income', 'family', 'veteran', 'justice_related', 'referral', 'other')),
  rule_value jsonb not null default '{}'::jsonb,
  description text not null,
  is_hard boolean not null default true
);
comment on table public.resource_eligibility is
  'Human-readable eligibility shown to members. Search NEVER filters on a member''s sensitive data (including justice history) using these rows.';
create index if not exists resource_eligibility_resource_idx on public.resource_eligibility (resource_id);

create table if not exists public.resource_contacts (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  method text not null check (method in ('phone', 'email', 'url', 'sms', 'walk_in')),
  value text not null,
  label text,
  is_primary boolean not null default false
);
create index if not exists resource_contacts_resource_idx on public.resource_contacts (resource_id);

create table if not exists public.resource_required_documents (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  document_type text not null,
  description text,
  is_required boolean not null default true
);
create index if not exists resource_required_documents_resource_idx on public.resource_required_documents (resource_id);

-- ---------------------------------------------------------------------
-- 4. Verification history (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.resource_verification_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  event_type text not null
    check (event_type in ('submitted', 'verified', 'rejected', 'flagged_stale', 'reverified', 'retired', 'reported')),
  actor_id uuid references auth.users(id) on delete set null,
  source_checked_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists resource_verification_events_resource_idx
  on public.resource_verification_events (resource_id, created_at desc);

create or replace function public.resource_verification_events_block_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'resource_verification_events is append-only (rows cannot be changed)';
end;
$$;
-- UPDATE is blocked; DELETE is only possible through the parent resource cascade (no role has a delete grant).
drop trigger if exists resource_verification_events_no_update on public.resource_verification_events;
create trigger resource_verification_events_no_update
  before update on public.resource_verification_events
  for each row execute function public.resource_verification_events_block_change();

-- ---------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_fairpath_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin');
$$;
revoke all on function public.is_fairpath_admin() from public;
grant execute on function public.is_fairpath_admin() to authenticated, service_role;

create or replace function public.is_org_manager(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid()
      and m.status = 'active' and m.member_role in ('owner', 'manager')
  );
$$;
revoke all on function public.is_org_manager(uuid) from public;
grant execute on function public.is_org_manager(uuid) to authenticated, service_role;

-- Freshness of a verified record:
--   fresh   = before verify_by (default: last_verified_at + 180 days)
--   stale   = past verify_by but within one more verification window (shown with a warning, ranked lower)
--   expired = beyond that (hidden from members)
--   unknown = never verified
create or replace function public.resource_freshness(p_last_verified timestamptz, p_verify_by timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_last_verified is null then 'unknown'
    else case
      when now() <= coalesce(p_verify_by, p_last_verified + interval '180 days') then 'fresh'
      when now() <= coalesce(p_verify_by, p_last_verified + interval '180 days')
                    + greatest(coalesce(p_verify_by, p_last_verified + interval '180 days') - p_last_verified, interval '30 days') then 'stale'
      else 'expired'
    end
  end;
$$;
revoke all on function public.resource_freshness(timestamptz, timestamptz) from public;
grant execute on function public.resource_freshness(timestamptz, timestamptz) to anon, authenticated, service_role;

create or replace function public.resources_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists resources_touch on public.resources;
create trigger resources_touch before update on public.resources
  for each row execute function public.resources_touch_updated_at();
drop trigger if exists resource_organizations_touch on public.resource_organizations;
create trigger resource_organizations_touch before update on public.resource_organizations
  for each row execute function public.resources_touch_updated_at();

-- ---------------------------------------------------------------------
-- 6. DEV-fixture guard
-- ---------------------------------------------------------------------
-- Production never has app_config.environment = 'dev' (unset also rejects), so a dev_fixture row cannot be inserted there.
create or replace function public.resources_guard_fixture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  env text;
begin
  if new.data_origin = 'dev_fixture' then
    select c.value #>> '{}' into env from public.app_config c where c.key = 'environment';
    if coalesce(env, '') <> 'dev' then
      raise exception 'dev_fixture resources are only allowed when app_config.environment = ''dev''';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists resource_organizations_guard_fixture on public.resource_organizations;
create trigger resource_organizations_guard_fixture before insert or update on public.resource_organizations
  for each row execute function public.resources_guard_fixture();
drop trigger if exists resources_guard_fixture on public.resources;
create trigger resources_guard_fixture before insert or update on public.resources
  for each row execute function public.resources_guard_fixture();

-- ---------------------------------------------------------------------
-- 7. RLS and grants
-- ---------------------------------------------------------------------
alter table public.resource_categories enable row level security;
alter table public.resource_needs enable row level security;
alter table public.resource_organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.resources enable row level security;
alter table public.resource_category_links enable row level security;
alter table public.resource_locations enable row level security;
alter table public.resource_service_areas enable row level security;
alter table public.resource_hours enable row level security;
alter table public.resource_eligibility enable row level security;
alter table public.resource_contacts enable row level security;
alter table public.resource_required_documents enable row level security;
alter table public.resource_verification_events enable row level security;

-- Taxonomy is public product data (search UI needs the category list and need phrases).
drop policy if exists "resource_categories_read_all" on public.resource_categories;
create policy "resource_categories_read_all" on public.resource_categories
  for select to anon, authenticated using (true);
drop policy if exists "resource_needs_read_all" on public.resource_needs;
create policy "resource_needs_read_all" on public.resource_needs
  for select to anon, authenticated using (true);

-- A member may see their own organization memberships.
drop policy if exists "organization_members_read_own" on public.organization_members;
create policy "organization_members_read_own" on public.organization_members
  for select to authenticated using (user_id = (select auth.uid()));

grant select on table public.resource_categories to anon, authenticated;
grant select on table public.resource_needs to anon, authenticated;
grant select on table public.organization_members to authenticated;

grant select, insert, update, delete on table public.resource_categories to service_role;
grant select, insert, update, delete on table public.resource_needs to service_role;
grant select, insert, update, delete on table public.resource_organizations to service_role;
grant select, insert, update, delete on table public.organization_members to service_role;
grant select, insert, update, delete on table public.resources to service_role;
grant select, insert, update, delete on table public.resource_category_links to service_role;
grant select, insert, update, delete on table public.resource_locations to service_role;
grant select, insert, update, delete on table public.resource_service_areas to service_role;
grant select, insert, update, delete on table public.resource_hours to service_role;
grant select, insert, update, delete on table public.resource_eligibility to service_role;
grant select, insert, update, delete on table public.resource_contacts to service_role;
grant select, insert, update, delete on table public.resource_required_documents to service_role;
grant select, insert on table public.resource_verification_events to service_role;
