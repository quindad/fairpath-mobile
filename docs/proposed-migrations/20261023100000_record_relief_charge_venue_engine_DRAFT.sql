-- DRAFT ONLY — DO NOT APPLY. Record Relief jurisdiction/charge normalization.
-- Purpose: stop treating one case as one charge, and stop treating a state as enough information for local filing.
-- Substantive eligibility remains in source-backed/versioned record_relief_rules.

create table if not exists public.record_relief_courts (
 id uuid primary key default gen_random_uuid(),
 jurisdiction_code text not null references public.record_relief_jurisdictions(code),
 stable_key text not null unique,
 court_name text not null,
 court_level text not null check (court_level in ('municipal','county','district','circuit','superior','common_pleas','general','limited','juvenile','federal_district','military','unknown')),
 state_code text, county_name text, city_name text,
 official_url text, clerk_url text, filing_url text,
 address jsonb not null default '{}'::jsonb,
 source_url text not null, last_verified_at date not null,
 status text not null default 'verified' check(status in ('draft','verified','retired')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists record_relief_courts_place_idx on public.record_relief_courts(jurisdiction_code,county_name,city_name);

alter table public.record_relief_cases add column if not exists court_id uuid references public.record_relief_courts(id);
alter table public.record_relief_cases add column if not exists county_name text;
alter table public.record_relief_cases add column if not exists city_name text;
alter table public.record_relief_cases add column if not exists federal_subtype text
 check(federal_subtype is null or federal_subtype in ('united_states_code','district_of_columbia_code','code_of_federal_regulations','uniform_code_of_military_justice','unknown'));

create table if not exists public.record_relief_charges (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.record_relief_cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 count_number integer,
 offense_name text not null check(length(btrim(offense_name)) between 2 and 200),
 statute_code text,
 degree text not null default 'unknown' check(degree in ('infraction','minor_misdemeanor','misdemeanor','felony','unknown')),
 degree_level integer,
 disposition text not null default 'unknown' check(disposition in ('conviction','dismissal','acquittal','deferred_adjudication','nolle_prosequi','arrest_no_charge','pending','unknown')),
 conviction_date date, disposition_date date, sentence_completion_date date, supervision_completion_date date, release_date date,
 fines_paid boolean, restitution_paid boolean,
 source_note text check(source_note is null or length(source_note)<=500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(case_id,count_number)
);
create index if not exists record_relief_charges_case_idx on public.record_relief_charges(case_id,count_number);

create table if not exists public.record_relief_local_filing_profiles (
 id uuid primary key default gen_random_uuid(),
 court_id uuid not null references public.record_relief_courts(id) on delete cascade,
 remedy text not null check(remedy in ('expungement','sealing','set_aside','certificate','automatic_clearing','other')),
 filing_fee_cents integer check(filing_fee_cents is null or filing_fee_cents>=0),
 fee_waiver_available boolean,
 forms jsonb not null default '[]'::jsonb,
 filing_steps jsonb not null default '[]'::jsonb,
 source_url text not null, effective_from date not null, effective_to date, last_verified_at date not null,
 status text not null default 'verified' check(status in ('draft','verified','superseded','retired')),
 unique(court_id,remedy,effective_from)
);

alter table public.record_relief_courts enable row level security;
alter table public.record_relief_charges enable row level security;
alter table public.record_relief_local_filing_profiles enable row level security;
create policy "rr_courts_verified_read" on public.record_relief_courts for select to authenticated using(status='verified');
create policy "rr_local_filing_verified_read" on public.record_relief_local_filing_profiles for select to authenticated using(status='verified');
create policy "rr_charges_owner_read" on public.record_relief_charges for select to authenticated using(user_id=(select auth.uid()));
create policy "rr_charges_owner_insert" on public.record_relief_charges for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.record_relief_cases c where c.id=case_id and c.user_id=(select auth.uid())));
create policy "rr_charges_owner_update" on public.record_relief_charges for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "rr_charges_owner_delete" on public.record_relief_charges for delete to authenticated using(user_id=(select auth.uid()));

-- Promotion rule: local filing data is NEVER inferred from state rules. A court profile requires its own official source.
-- Evaluation rule: evaluate each final charge independently against active substantive rules, then aggregate case UI.
-- Multi-state rule: never merge authorities. Each case stays attached to the jurisdiction/court where it was heard.
-- Pending-charge rule: evaluate only according to the source-backed jurisdiction rule; never hard-code a national answer.
-- Migration/backfill plan: existing one-off offense fields remain readable until each legacy case is converted to charge rows.
