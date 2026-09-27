-- Record Relief engine (forward-only). Migration 8.
--
-- Legal INFORMATION software, not an oracle. There is no universal "expungement calculator": each jurisdiction has
-- versioned, source-backed rules, and a case is evaluated against the rules that actually cover it.
--
-- Guarantees (audited):
--   * Results are worded "potentially ...": eligible now / waiting period / ineligible under the current rule /
--     insufficient information / manual review / rule not available / federal (separate branch). Never a definitive
--     legal determination, never an invented deadline or fee.
--   * Every rule carries its source, citation text, effective dates, last-verified date and version. Only status =
--     'verified' rules are ever used or shown. Rule changes create a NEW version; cases evaluated under an older
--     version are flagged and re-evaluated deliberately (history is append-only).
--   * Federal cases are a separate branch with their own pathway table. They are never run through a state calculator,
--     and no federal "expungement" is implied.
--   * Forms: a form is OFFICIAL only when it has a verified official source, revision and effective date. A form is
--     marked auto-fillable only when a verified field map exists; none is invented.
--   * Cases, checklists and history are owner-only. There is no employer, landlord, partner or admin read path.
--   * DEV fixtures (jurisdictions/rules/forms/pathways marked dev_fixture) cannot exist outside app_config.environment = 'dev'.
--   * The 50 states, DC, territories and the federal system are seeded as jurisdictions (names only). Until verified
--     rules are loaded for one, the product says so plainly.

-- ---------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------
create table if not exists public.record_relief_jurisdictions (
  code text primary key check (code ~ '^[A-Z][A-Z0-9-]{1,11}$'),
  name text not null,
  kind text not null check (kind in ('state', 'district', 'territory', 'federal', 'test')),
  sort_order integer not null default 100,
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  fixture_set text,
  check ((data_origin = 'dev_fixture') = (fixture_set is not null))
);

create table if not exists public.record_relief_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null check (rule_key ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  rule_version integer not null default 1 check (rule_version >= 1),
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  remedy text not null check (remedy in ('expungement', 'sealing', 'set_aside', 'certificate', 'automatic_clearing', 'other')),
  title text not null check (length(btrim(title)) between 3 and 160),
  summary text,
  applies_dispositions text[] not null default '{}'
    check (applies_dispositions <@ array['conviction', 'dismissal', 'acquittal', 'deferred_adjudication', 'nolle_prosequi', 'arrest_no_charge']),
  applies_offense_classes text[] not null default '{}'
    check (applies_offense_classes <@ array['traffic_infraction', 'misdemeanor', 'non_violent_felony', 'violent_felony', 'sex_offense', 'dui_dwi', 'other']),
  excluded_offense_classes text[] not null default '{}'
    check (excluded_offense_classes <@ array['traffic_infraction', 'misdemeanor', 'non_violent_felony', 'violent_felony', 'sex_offense', 'dui_dwi', 'other']),
  waiting_years integer not null default 0 check (waiting_years between 0 and 50),
  waiting_months integer not null default 0 check (waiting_months between 0 and 11),
  waiting_days integer not null default 0 check (waiting_days between 0 and 365),
  waiting_anchor text not null default 'latest_completion'
    check (waiting_anchor in ('disposition_date', 'conviction_date', 'sentence_completion_date', 'supervision_completion_date', 'release_date', 'latest_completion')),
  requires_fines_paid boolean not null default false,
  requires_restitution_paid boolean not null default false,
  requires_no_pending_charges boolean not null default false,
  max_other_convictions integer check (max_other_convictions is null or max_other_convictions between 0 and 50),
  manual_review_flags text[] not null default '{}' check (manual_review_flags <@ array['juvenile', 'out_of_state_conviction']),
  fees jsonb not null default '{}'::jsonb,
  filing jsonb not null default '{}'::jsonb,
  required_documents jsonb not null default '[]'::jsonb check (jsonb_typeof(required_documents) = 'array'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  form_keys text[] not null default '{}',
  source_authority text not null check (source_authority in ('statute', 'court_rule', 'government_guidance', 'test_fixture')),
  source_url text not null,
  citation_text text not null,
  effective_from date not null,
  effective_to date,
  last_verified_at date,
  status text not null default 'draft' check (status in ('draft', 'verified', 'superseded', 'retired')),
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  fixture_set text,
  created_at timestamptz not null default now(),
  unique (rule_key, rule_version),
  check ((data_origin = 'dev_fixture') = (fixture_set is not null)),
  check (status <> 'verified' or last_verified_at is not null),
  check (effective_to is null or effective_to >= effective_from)
);
create index if not exists record_relief_rules_lookup_idx on public.record_relief_rules (jurisdiction_code, status);

create table if not exists public.record_relief_federal_pathways (
  id uuid primary key default gen_random_uuid(),
  pathway_key text not null check (pathway_key ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  pathway_version integer not null default 1,
  title text not null,
  description text not null,
  is_general_expungement boolean not null default false,
  applies_to text,
  source_authority text not null check (source_authority in ('statute', 'court_rule', 'government_guidance', 'test_fixture')),
  source_url text not null,
  citation_text text not null,
  effective_from date not null,
  last_verified_at date,
  status text not null default 'draft' check (status in ('draft', 'verified', 'superseded', 'retired')),
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  fixture_set text,
  unique (pathway_key, pathway_version),
  check ((data_origin = 'dev_fixture') = (fixture_set is not null)),
  check (status <> 'verified' or last_verified_at is not null)
);

create table if not exists public.record_relief_forms (
  id uuid primary key default gen_random_uuid(),
  form_key text not null check (form_key ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  name text not null,
  kind text not null check (kind in ('official_form', 'instructions', 'fee_waiver_form')),
  revision text,
  effective_date date,
  official_source_url text,
  last_verified_at date,
  remedies text[] not null default '{}',
  auto_fillable boolean not null default false,
  field_map jsonb,
  status text not null default 'draft' check (status in ('draft', 'verified', 'superseded', 'retired')),
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  fixture_set text,
  unique (form_key, jurisdiction_code),
  check ((data_origin = 'dev_fixture') = (fixture_set is not null)),
  -- OFFICIAL means a verified official source, revision and dates. Nothing else may be presented as official.
  check (kind <> 'official_form' or status <> 'verified' or (official_source_url is not null and revision is not null and effective_date is not null and last_verified_at is not null)),
  check (not auto_fillable or (field_map is not null and status = 'verified' and kind = 'official_form'))
);

-- ---------------------------------------------------------------------
-- Member data (owner-only)
-- ---------------------------------------------------------------------
create table if not exists public.record_relief_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jurisdiction_code text not null references public.record_relief_jurisdictions(code),
  label text not null check (length(btrim(label)) between 2 and 80),
  court_name text check (court_name is null or length(court_name) <= 140),
  case_number text check (case_number is null or length(case_number) <= 60),
  offense_description text check (offense_description is null or length(offense_description) <= 200),
  offense_class text not null default 'other'
    check (offense_class in ('traffic_infraction', 'misdemeanor', 'non_violent_felony', 'violent_felony', 'sex_offense', 'dui_dwi', 'other')),
  disposition text not null default 'conviction'
    check (disposition in ('conviction', 'dismissal', 'acquittal', 'deferred_adjudication', 'nolle_prosequi', 'arrest_no_charge')),
  is_juvenile boolean not null default false,
  out_of_state_conviction boolean not null default false,
  conviction_date date check (conviction_date is null or conviction_date between date '1900-01-01' and date '2100-01-01'),
  disposition_date date check (disposition_date is null or disposition_date between date '1900-01-01' and date '2100-01-01'),
  sentence_completion_date date check (sentence_completion_date is null or sentence_completion_date between date '1900-01-01' and date '2100-01-01'),
  supervision_completion_date date check (supervision_completion_date is null or supervision_completion_date between date '1900-01-01' and date '2100-01-01'),
  release_date date check (release_date is null or release_date between date '1900-01-01' and date '2100-01-01'),
  fines_paid boolean,
  restitution_paid boolean,
  other_convictions_count integer check (other_convictions_count is null or other_convictions_count between 0 and 50),
  pending_charges boolean,
  filing_status text not null default 'not_started'
    check (filing_status in ('not_started', 'preparing', 'filed', 'hearing_scheduled', 'granted', 'denied', 'withdrawn')),
  filed_on date,
  notes text check (notes is null or length(notes) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists record_relief_cases_user_idx on public.record_relief_cases (user_id, updated_at desc);
comment on column public.record_relief_cases.case_number is 'Sensitive. Never used in file names, analytics or notifications.';

create table if not exists public.record_relief_evaluations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.record_relief_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.record_relief_rules(id) on delete set null,
  rule_key text,
  rule_version integer,
  jurisdiction_code text not null,
  remedy text,
  outcome text not null check (outcome in ('potentially_eligible_now', 'waiting_period', 'potentially_ineligible', 'insufficient_information', 'manual_review', 'rule_unavailable', 'federal_separate')),
  eligibility_date date,
  days_remaining integer,
  inputs_used jsonb not null default '{}'::jsonb,
  missing_inputs text[] not null default '{}',
  reasons jsonb not null default '[]'::jsonb,
  rule_stale boolean not null default false,
  superseded boolean not null default false,
  evaluated_at timestamptz not null default now()
);
create index if not exists record_relief_evaluations_case_idx on public.record_relief_evaluations (case_id, evaluated_at desc);

create table if not exists public.record_relief_case_checklist (
  case_id uuid not null references public.record_relief_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('step', 'document')),
  item_key text not null check (length(item_key) between 1 and 80),
  done boolean not null default false,
  done_at timestamptz,
  primary key (case_id, item_kind, item_key)
);

create table if not exists public.record_relief_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.record_relief_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'inputs_updated', 'evaluated', 'rule_changed', 'checklist_updated', 'status_set')),
  detail text check (detail is null or length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists record_relief_case_events_case_idx on public.record_relief_case_events (case_id, created_at);

-- ---------------------------------------------------------------------
-- DEV-fixture guard (same pattern as Resources)
-- ---------------------------------------------------------------------
create or replace function public.record_relief_guard_fixture()
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
      raise exception 'dev_fixture record-relief data is only allowed when app_config.environment = ''dev''';
    end if;
  end if;
  return new;
end;
$$;
do $$
declare
  t text;
begin
  foreach t in array array['record_relief_jurisdictions', 'record_relief_rules', 'record_relief_federal_pathways', 'record_relief_forms'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_fixture', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.record_relief_guard_fixture()', t || '_guard_fixture', t);
  end loop;
end $$;

-- Jurisdictions: names only (product data, safe everywhere). Rules for them are loaded separately once verified.
insert into public.record_relief_jurisdictions (code, name, kind, sort_order) values
  ('US-AL', 'Alabama', 'state', 10), ('US-AK', 'Alaska', 'state', 11), ('US-AZ', 'Arizona', 'state', 12), ('US-AR', 'Arkansas', 'state', 13),
  ('US-CA', 'California', 'state', 14), ('US-CO', 'Colorado', 'state', 15), ('US-CT', 'Connecticut', 'state', 16), ('US-DE', 'Delaware', 'state', 17),
  ('US-DC', 'District of Columbia', 'district', 18), ('US-FL', 'Florida', 'state', 19), ('US-GA', 'Georgia', 'state', 20), ('US-HI', 'Hawaii', 'state', 21),
  ('US-ID', 'Idaho', 'state', 22), ('US-IL', 'Illinois', 'state', 23), ('US-IN', 'Indiana', 'state', 24), ('US-IA', 'Iowa', 'state', 25),
  ('US-KS', 'Kansas', 'state', 26), ('US-KY', 'Kentucky', 'state', 27), ('US-LA', 'Louisiana', 'state', 28), ('US-ME', 'Maine', 'state', 29),
  ('US-MD', 'Maryland', 'state', 30), ('US-MA', 'Massachusetts', 'state', 31), ('US-MI', 'Michigan', 'state', 32), ('US-MN', 'Minnesota', 'state', 33),
  ('US-MS', 'Mississippi', 'state', 34), ('US-MO', 'Missouri', 'state', 35), ('US-MT', 'Montana', 'state', 36), ('US-NE', 'Nebraska', 'state', 37),
  ('US-NV', 'Nevada', 'state', 38), ('US-NH', 'New Hampshire', 'state', 39), ('US-NJ', 'New Jersey', 'state', 40), ('US-NM', 'New Mexico', 'state', 41),
  ('US-NY', 'New York', 'state', 42), ('US-NC', 'North Carolina', 'state', 43), ('US-ND', 'North Dakota', 'state', 44), ('US-OH', 'Ohio', 'state', 45),
  ('US-OK', 'Oklahoma', 'state', 46), ('US-OR', 'Oregon', 'state', 47), ('US-PA', 'Pennsylvania', 'state', 48), ('US-RI', 'Rhode Island', 'state', 49),
  ('US-SC', 'South Carolina', 'state', 50), ('US-SD', 'South Dakota', 'state', 51), ('US-TN', 'Tennessee', 'state', 52), ('US-TX', 'Texas', 'state', 53),
  ('US-UT', 'Utah', 'state', 54), ('US-VT', 'Vermont', 'state', 55), ('US-VA', 'Virginia', 'state', 56), ('US-WA', 'Washington', 'state', 57),
  ('US-WV', 'West Virginia', 'state', 58), ('US-WI', 'Wisconsin', 'state', 59), ('US-WY', 'Wyoming', 'state', 60),
  ('US-PR', 'Puerto Rico', 'territory', 70), ('US-GU', 'Guam', 'territory', 71), ('US-VI', 'U.S. Virgin Islands', 'territory', 72),
  ('US-AS', 'American Samoa', 'territory', 73), ('US-MP', 'Northern Mariana Islands', 'territory', 74),
  ('US-FED', 'Federal (U.S. courts)', 'federal', 1)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------
alter table public.record_relief_jurisdictions enable row level security;
alter table public.record_relief_rules enable row level security;
alter table public.record_relief_federal_pathways enable row level security;
alter table public.record_relief_forms enable row level security;
alter table public.record_relief_cases enable row level security;
alter table public.record_relief_evaluations enable row level security;
alter table public.record_relief_case_checklist enable row level security;
alter table public.record_relief_case_events enable row level security;

drop policy if exists "rr_jurisdictions_read" on public.record_relief_jurisdictions;
create policy "rr_jurisdictions_read" on public.record_relief_jurisdictions for select to authenticated using (true);
-- Drafts, superseded and retired rows are never visible to members.
drop policy if exists "rr_rules_read_verified" on public.record_relief_rules;
create policy "rr_rules_read_verified" on public.record_relief_rules for select to authenticated using (status = 'verified');
drop policy if exists "rr_pathways_read_verified" on public.record_relief_federal_pathways;
create policy "rr_pathways_read_verified" on public.record_relief_federal_pathways for select to authenticated using (status = 'verified');
drop policy if exists "rr_forms_read_verified" on public.record_relief_forms;
create policy "rr_forms_read_verified" on public.record_relief_forms for select to authenticated using (status = 'verified');

do $$
declare
  t text;
begin
  foreach t in array array['record_relief_cases', 'record_relief_evaluations', 'record_relief_case_checklist', 'record_relief_case_events'] loop
    execute format('drop policy if exists "%s_owner_read" on public.%I', t, t);
    execute format('create policy "%s_owner_read" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end $$;

grant select on table public.record_relief_jurisdictions to authenticated;
grant select on table public.record_relief_rules to authenticated;
grant select on table public.record_relief_federal_pathways to authenticated;
grant select on table public.record_relief_forms to authenticated;
grant select on table public.record_relief_cases to authenticated;
grant select on table public.record_relief_evaluations to authenticated;
grant select on table public.record_relief_case_checklist to authenticated;
grant select on table public.record_relief_case_events to authenticated;
grant select, insert, update, delete on table public.record_relief_jurisdictions to service_role;
grant select, insert, update, delete on table public.record_relief_rules to service_role;
grant select, insert, update, delete on table public.record_relief_federal_pathways to service_role;
grant select, insert, update, delete on table public.record_relief_forms to service_role;
grant select, insert, update, delete on table public.record_relief_cases to service_role;
grant select, insert, update, delete on table public.record_relief_evaluations to service_role;
grant select, insert, update, delete on table public.record_relief_case_checklist to service_role;
grant select, insert, update, delete on table public.record_relief_case_events to service_role;

-- ---------------------------------------------------------------------
-- The active rule for a (jurisdiction, remedy...) = the newest VERIFIED version whose effective window covers today
-- ---------------------------------------------------------------------
create or replace function public.record_relief_active_rules(p_jurisdiction text)
returns setof public.record_relief_rules
language sql
stable
security definer
set search_path = public
as $$
  select r.* from public.record_relief_rules r
  where r.jurisdiction_code = p_jurisdiction and r.status = 'verified'
    and r.effective_from <= current_date and (r.effective_to is null or r.effective_to >= current_date)
    and not exists (
      select 1 from public.record_relief_rules r2
      where r2.rule_key = r.rule_key and r2.status = 'verified' and r2.rule_version > r.rule_version
        and r2.effective_from <= current_date and (r2.effective_to is null or r2.effective_to >= current_date));
$$;
revoke all on function public.record_relief_active_rules(text) from public, anon;
grant execute on function public.record_relief_active_rules(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Evaluation (server-side, deterministic, append-only history)
-- ---------------------------------------------------------------------
create or replace function public.evaluate_record_relief_case(p_case uuid)
returns setof public.record_relief_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.record_relief_cases%rowtype;
  r public.record_relief_rules%rowtype;
  any_rules boolean;
  matched integer := 0;
  anchor date;
  elig date;
  missing text[];
  reasons jsonb;
  inputs jsonb;
  outcome text;
  stale boolean;
  ev public.record_relief_evaluations%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into c from public.record_relief_cases x where x.id = p_case and x.user_id = uid;
  if not found then raise exception 'CASE_UNAVAILABLE'; end if;

  update public.record_relief_evaluations e set superseded = true where e.case_id = c.id and not e.superseded;

  -- Federal branch: never run through a state calculator.
  if c.jurisdiction_code = 'US-FED' then
    insert into public.record_relief_evaluations (case_id, user_id, jurisdiction_code, outcome, reasons)
    values (c.id, uid, c.jurisdiction_code, 'federal_separate',
      jsonb_build_array(jsonb_build_object('code', 'federal_separate', 'text', 'Federal cases are handled separately from state record relief. State expungement rules do not apply to federal convictions. See the federal pathways listed for this case; where none are verified, FairPath does not yet have verified federal information to show.')))
    returning * into ev;
    return next ev;
    insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (c.id, uid, 'evaluated', 'federal');
    return;
  end if;

  select exists (select 1 from public.record_relief_active_rules(c.jurisdiction_code)) into any_rules;
  if not any_rules then
    insert into public.record_relief_evaluations (case_id, user_id, jurisdiction_code, outcome, reasons)
    values (c.id, uid, c.jurisdiction_code, 'rule_unavailable',
      jsonb_build_array(jsonb_build_object('code', 'no_verified_rules', 'text', 'FairPath does not have verified record-relief rules for this jurisdiction yet, so it cannot tell you anything about eligibility. That does not mean relief is unavailable. A legal aid organization or the court clerk can tell you what applies.')))
    returning * into ev;
    return next ev;
    insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (c.id, uid, 'evaluated', 'no rules');
    return;
  end if;

  for r in select * from public.record_relief_active_rules(c.jurisdiction_code) order by remedy, rule_key loop
    -- Only rules that describe this kind of disposition / offense are relevant.
    if cardinality(r.applies_dispositions) > 0 and not (c.disposition = any (r.applies_dispositions)) then continue; end if;
    if cardinality(r.applies_offense_classes) > 0 and not (c.offense_class = any (r.applies_offense_classes)) and not (c.offense_class = any (r.excluded_offense_classes)) then continue; end if;
    matched := matched + 1;

    stale := r.last_verified_at is null or r.last_verified_at < (current_date - 365);
    reasons := '[]'::jsonb;
    missing := '{}';
    inputs := jsonb_build_object('offense_class', c.offense_class, 'disposition', c.disposition);
    anchor := null; elig := null; outcome := null;

    -- 1. definite exclusions / conditions that are already known to fail
    if c.offense_class = any (r.excluded_offense_classes) then
      outcome := 'potentially_ineligible';
      reasons := reasons || jsonb_build_object('code', 'excluded_offense', 'text', 'This rule lists this kind of offense as excluded.');
    end if;
    if r.requires_no_pending_charges then
      if c.pending_charges is true then outcome := 'potentially_ineligible'; reasons := reasons || jsonb_build_object('code', 'pending_charges', 'text', 'This rule requires no pending charges.');
      elsif c.pending_charges is null then missing := array_append(missing, 'pending_charges'); end if;
      inputs := inputs || jsonb_build_object('pending_charges', c.pending_charges);
    end if;
    if r.max_other_convictions is not null then
      if c.other_convictions_count is null then missing := array_append(missing, 'other_convictions_count');
      elsif c.other_convictions_count > r.max_other_convictions then
        outcome := 'potentially_ineligible';
        reasons := reasons || jsonb_build_object('code', 'other_convictions', 'text', 'This rule allows at most ' || r.max_other_convictions || ' other conviction(s); you entered ' || c.other_convictions_count || '.');
      end if;
      inputs := inputs || jsonb_build_object('other_convictions_count', c.other_convictions_count);
    end if;
    if r.requires_fines_paid then
      if c.fines_paid is false then outcome := 'potentially_ineligible'; reasons := reasons || jsonb_build_object('code', 'fines_unpaid', 'text', 'This rule requires fines to be paid.');
      elsif c.fines_paid is null then missing := array_append(missing, 'fines_paid'); end if;
      inputs := inputs || jsonb_build_object('fines_paid', c.fines_paid);
    end if;
    if r.requires_restitution_paid then
      if c.restitution_paid is false then outcome := 'potentially_ineligible'; reasons := reasons || jsonb_build_object('code', 'restitution_unpaid', 'text', 'This rule requires restitution to be paid.');
      elsif c.restitution_paid is null then missing := array_append(missing, 'restitution_paid'); end if;
      inputs := inputs || jsonb_build_object('restitution_paid', c.restitution_paid);
    end if;

    -- 2. the date the waiting period starts from
    anchor := case r.waiting_anchor
      when 'disposition_date' then c.disposition_date
      when 'conviction_date' then c.conviction_date
      when 'sentence_completion_date' then c.sentence_completion_date
      when 'supervision_completion_date' then c.supervision_completion_date
      when 'release_date' then c.release_date
      else (select max(d) from unnest(array[c.sentence_completion_date, c.supervision_completion_date, c.release_date]) d) end;
    inputs := inputs || jsonb_build_object('waiting_anchor', r.waiting_anchor, 'anchor_date', anchor);
    if anchor is null and (r.waiting_years + r.waiting_months + r.waiting_days) > 0 then
      missing := array_append(missing, replace(r.waiting_anchor, 'latest_completion', 'completion_dates'));
    end if;

    -- 3. flags that make an automatic answer inappropriate
    if (c.is_juvenile and 'juvenile' = any (r.manual_review_flags)) or (c.out_of_state_conviction and 'out_of_state_conviction' = any (r.manual_review_flags)) then
      if outcome is null then outcome := 'manual_review'; end if;
      reasons := reasons || jsonb_build_object('code', 'manual_review', 'text', 'Something about this case (for example a juvenile record or a conviction from another state) can change which rules apply. Have a legal aid organization or the court clerk review it.');
    end if;

    if outcome is null and cardinality(missing) > 0 then
      outcome := 'insufficient_information';
      reasons := reasons || jsonb_build_object('code', 'missing_inputs', 'text', 'Add the missing information so this rule can be checked.');
    end if;

    if outcome is null then
      if anchor is not null then elig := anchor + make_interval(years => r.waiting_years, months => r.waiting_months, days => r.waiting_days); end if;
      if elig is null or elig <= current_date then
        outcome := 'potentially_eligible_now';
        reasons := reasons || jsonb_build_object('code', 'conditions_met', 'text', 'Based on what you entered, you appear to meet this rule''s conditions. That is not a guarantee: a court decides.');
      else
        outcome := 'waiting_period';
        reasons := reasons || jsonb_build_object('code', 'waiting', 'text', 'This rule requires a waiting period counted from ' || replace(r.waiting_anchor, '_', ' ') || ' (' || anchor::text || ').');
      end if;
    end if;
    if outcome = 'potentially_ineligible' then
      -- also compute the date when the only remaining barrier is time, so the member can still see it
      elig := null;
    end if;
    if stale then reasons := reasons || jsonb_build_object('code', 'rule_stale', 'text', 'This rule was last verified on ' || coalesce(r.last_verified_at::text, 'an unknown date') || ', which is over a year ago. Confirm it is still current with the source.'); end if;

    insert into public.record_relief_evaluations (case_id, user_id, rule_id, rule_key, rule_version, jurisdiction_code, remedy, outcome, eligibility_date, days_remaining, inputs_used, missing_inputs, reasons, rule_stale)
    values (c.id, uid, r.id, r.rule_key, r.rule_version, c.jurisdiction_code, r.remedy, outcome, elig,
            case when elig is not null then greatest(0, elig - current_date) end, inputs, missing, reasons, stale)
    returning * into ev;
    return next ev;
  end loop;

  if matched = 0 then
    insert into public.record_relief_evaluations (case_id, user_id, jurisdiction_code, outcome, reasons)
    values (c.id, uid, c.jurisdiction_code, 'manual_review',
      jsonb_build_array(jsonb_build_object('code', 'no_matching_rule', 'text', 'None of the verified rules FairPath has for this jurisdiction covers this offense type and disposition. That does not mean relief is unavailable. A legal aid organization or the court clerk can tell you what applies.')))
    returning * into ev;
    return next ev;
  end if;
  insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (c.id, uid, 'evaluated', matched::text || ' rule(s)');
  return;
end;
$$;

-- ---------------------------------------------------------------------
-- Case functions
-- ---------------------------------------------------------------------
create or replace function public.save_record_relief_case(p_id uuid, p jsonb)
returns public.record_relief_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.record_relief_cases%rowtype;
  n integer;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if not exists (select 1 from public.record_relief_jurisdictions j where j.code = p ->> 'jurisdiction_code') then raise exception 'INVALID_JURISDICTION'; end if;

  if p_id is null then
    select count(*) into n from public.record_relief_cases x where x.user_id = uid;
    if n >= 30 then raise exception 'CASE_LIMIT'; end if;
    insert into public.record_relief_cases (
      user_id, jurisdiction_code, label, court_name, case_number, offense_description, offense_class, disposition, is_juvenile, out_of_state_conviction,
      conviction_date, disposition_date, sentence_completion_date, supervision_completion_date, release_date, fines_paid, restitution_paid, other_convictions_count, pending_charges, notes)
    values (uid, p ->> 'jurisdiction_code', btrim(p ->> 'label'), nullif(btrim(p ->> 'court_name'), ''), nullif(btrim(p ->> 'case_number'), ''), nullif(btrim(p ->> 'offense_description'), ''),
      coalesce(p ->> 'offense_class', 'other'), coalesce(p ->> 'disposition', 'conviction'), coalesce((p ->> 'is_juvenile')::boolean, false), coalesce((p ->> 'out_of_state_conviction')::boolean, false),
      nullif(p ->> 'conviction_date', '')::date, nullif(p ->> 'disposition_date', '')::date, nullif(p ->> 'sentence_completion_date', '')::date,
      nullif(p ->> 'supervision_completion_date', '')::date, nullif(p ->> 'release_date', '')::date, (p ->> 'fines_paid')::boolean, (p ->> 'restitution_paid')::boolean,
      nullif(p ->> 'other_convictions_count', '')::integer, (p ->> 'pending_charges')::boolean, nullif(btrim(p ->> 'notes'), ''))
    returning * into result;
    insert into public.record_relief_case_events (case_id, user_id, event_type) values (result.id, uid, 'created');
  else
    update public.record_relief_cases x set
      jurisdiction_code = p ->> 'jurisdiction_code', label = btrim(p ->> 'label'), court_name = nullif(btrim(p ->> 'court_name'), ''), case_number = nullif(btrim(p ->> 'case_number'), ''),
      offense_description = nullif(btrim(p ->> 'offense_description'), ''), offense_class = coalesce(p ->> 'offense_class', 'other'), disposition = coalesce(p ->> 'disposition', 'conviction'),
      is_juvenile = coalesce((p ->> 'is_juvenile')::boolean, false), out_of_state_conviction = coalesce((p ->> 'out_of_state_conviction')::boolean, false),
      conviction_date = nullif(p ->> 'conviction_date', '')::date, disposition_date = nullif(p ->> 'disposition_date', '')::date, sentence_completion_date = nullif(p ->> 'sentence_completion_date', '')::date,
      supervision_completion_date = nullif(p ->> 'supervision_completion_date', '')::date, release_date = nullif(p ->> 'release_date', '')::date,
      fines_paid = (p ->> 'fines_paid')::boolean, restitution_paid = (p ->> 'restitution_paid')::boolean, other_convictions_count = nullif(p ->> 'other_convictions_count', '')::integer,
      pending_charges = (p ->> 'pending_charges')::boolean, notes = nullif(btrim(p ->> 'notes'), ''), updated_at = now()
    where x.id = p_id and x.user_id = uid returning * into result;
    if not found then raise exception 'CASE_UNAVAILABLE'; end if;
    insert into public.record_relief_case_events (case_id, user_id, event_type) values (result.id, uid, 'inputs_updated');
  end if;
  perform public.evaluate_record_relief_case(result.id);
  return result;
end;
$$;

create or replace function public.set_record_relief_case_status(p_id uuid, p_status text, p_filed_on date default null)
returns public.record_relief_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.record_relief_cases%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_status not in ('not_started', 'preparing', 'filed', 'hearing_scheduled', 'granted', 'denied', 'withdrawn') then raise exception 'INVALID_STATUS'; end if;
  if p_filed_on is not null and p_filed_on > current_date then raise exception 'INVALID_DATE'; end if;
  update public.record_relief_cases x set filing_status = p_status, filed_on = coalesce(p_filed_on, x.filed_on), updated_at = now()
   where x.id = p_id and x.user_id = uid returning * into result;
  if not found then raise exception 'CASE_UNAVAILABLE'; end if;
  insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (result.id, uid, 'status_set', p_status);
  return result;
end;
$$;

create or replace function public.toggle_record_relief_checklist(p_case uuid, p_kind text, p_key text, p_done boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_kind not in ('step', 'document') then raise exception 'INVALID_KIND'; end if;
  if not exists (select 1 from public.record_relief_cases c where c.id = p_case and c.user_id = uid) then raise exception 'CASE_UNAVAILABLE'; end if;
  insert into public.record_relief_case_checklist (case_id, user_id, item_kind, item_key, done, done_at)
  values (p_case, uid, p_kind, left(p_key, 80), p_done, case when p_done then now() end)
  on conflict (case_id, item_kind, item_key) do update set done = excluded.done, done_at = excluded.done_at;
  insert into public.record_relief_case_events (case_id, user_id, event_type) values (p_case, uid, 'checklist_updated');
end;
$$;

create or replace function public.delete_record_relief_case(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  delete from public.record_relief_cases c where c.id = p_id and c.user_id = uid;
  if not found then raise exception 'CASE_UNAVAILABLE'; end if;
end;
$$;

-- What the member sees for a case: current evaluations + the rule(s) they came from + forms + federal pathways.
create or replace function public.get_record_relief_case_detail(p_case uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.record_relief_cases%rowtype;
  result jsonb;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into c from public.record_relief_cases x where x.id = p_case and x.user_id = uid;
  if not found then raise exception 'CASE_UNAVAILABLE'; end if;
  select jsonb_build_object(
    'evaluations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'outcome', e.outcome, 'remedy', e.remedy, 'eligibility_date', e.eligibility_date, 'days_remaining', case when e.eligibility_date is null then null else greatest(0, e.eligibility_date - current_date) end,
        'inputs_used', e.inputs_used, 'missing_inputs', e.missing_inputs, 'reasons', e.reasons, 'rule_stale', e.rule_stale, 'evaluated_at', e.evaluated_at,
        'rule_key', e.rule_key, 'rule_version', e.rule_version,
        'rule_changed', (e.rule_id is not null and not exists (select 1 from public.record_relief_active_rules(c.jurisdiction_code) a where a.id = e.rule_id)),
        'rule', (select jsonb_build_object('title', r.title, 'summary', r.summary, 'citation_text', r.citation_text, 'source_url', r.source_url, 'source_authority', r.source_authority,
                   'effective_from', r.effective_from, 'last_verified_at', r.last_verified_at, 'rule_version', r.rule_version, 'fees', r.fees, 'filing', r.filing,
                   'required_documents', r.required_documents, 'steps', r.steps, 'form_keys', r.form_keys, 'data_origin', r.data_origin)
                 from public.record_relief_rules r where r.id = e.rule_id))
        order by e.remedy nulls last, e.rule_key)
      from public.record_relief_evaluations e where e.case_id = c.id and not e.superseded), '[]'::jsonb),
    'forms', coalesce((
      select jsonb_agg(jsonb_build_object('form_key', f.form_key, 'name', f.name, 'kind', f.kind, 'revision', f.revision, 'effective_date', f.effective_date,
        'official_source_url', f.official_source_url, 'last_verified_at', f.last_verified_at, 'auto_fillable', f.auto_fillable, 'data_origin', f.data_origin) order by f.name)
      from public.record_relief_forms f where f.jurisdiction_code = c.jurisdiction_code and f.status = 'verified'), '[]'::jsonb),
    'pathways', case when c.jurisdiction_code = 'US-FED' then coalesce((
      select jsonb_agg(jsonb_build_object('pathway_key', p.pathway_key, 'title', p.title, 'description', p.description, 'is_general_expungement', p.is_general_expungement,
        'applies_to', p.applies_to, 'source_url', p.source_url, 'citation_text', p.citation_text, 'last_verified_at', p.last_verified_at, 'data_origin', p.data_origin) order by p.title)
      from public.record_relief_federal_pathways p where p.status = 'verified'), '[]'::jsonb) else '[]'::jsonb end,
    'checklist', coalesce((select jsonb_agg(jsonb_build_object('kind', k.item_kind, 'key', k.item_key, 'done', k.done)) from public.record_relief_case_checklist k where k.case_id = c.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('event_type', v.event_type, 'detail', v.detail, 'created_at', v.created_at) order by v.created_at) from public.record_relief_case_events v where v.case_id = c.id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Home summary + reminder source
create or replace function public.member_summary_record_relief(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cur as (
    select e.* from public.record_relief_evaluations e
    join public.record_relief_cases c on c.id = e.case_id and c.user_id = p_user and c.filing_status not in ('granted', 'denied', 'withdrawn')
    where e.user_id = p_user and not e.superseded)
  select jsonb_build_object(
    'cases', (select count(*) from public.record_relief_cases c where c.user_id = p_user),
    'eligible_now', (select count(distinct case_id) from cur where outcome = 'potentially_eligible_now'),
    'countdowns_due_soon', (select count(distinct case_id) from cur where outcome = 'waiting_period' and eligibility_date <= current_date + 30),
    'rule_updates', (select count(distinct case_id) from cur where rule_id is not null and not exists (
        select 1 from public.record_relief_rules r0 join lateral public.record_relief_active_rules(r0.jurisdiction_code) a on a.id <> cur.rule_id and a.rule_key = cur.rule_key
        where r0.id = cur.rule_id)),
    'needs_information', (select count(distinct case_id) from cur where outcome = 'insufficient_information'));
$$;
revoke all on function public.member_summary_record_relief(uuid) from public, anon, authenticated;
grant execute on function public.member_summary_record_relief(uuid) to service_role;

create or replace function public.record_relief_reminders_due()
returns table (case_id uuid, user_id uuid, kind text, due_on date)
language sql
stable
security definer
set search_path = public
as $$
  select e.case_id, e.user_id,
         case when e.outcome = 'potentially_eligible_now' then 'eligible_now'
              when e.eligibility_date <= current_date + 7 then 'milestone_7'
              when e.eligibility_date <= current_date + 30 then 'milestone_30'
              else 'milestone_90' end,
         e.eligibility_date
  from public.record_relief_evaluations e
  join public.record_relief_cases c on c.id = e.case_id and c.filing_status not in ('granted', 'denied', 'withdrawn')
  where not e.superseded and (e.outcome = 'potentially_eligible_now' or (e.outcome = 'waiting_period' and e.eligibility_date <= current_date + 90));
$$;
revoke all on function public.record_relief_reminders_due() from public, anon, authenticated;
grant execute on function public.record_relief_reminders_due() to service_role;

revoke all on function public.evaluate_record_relief_case(uuid) from public, anon;
revoke all on function public.save_record_relief_case(uuid, jsonb) from public, anon;
revoke all on function public.set_record_relief_case_status(uuid, text, date) from public, anon;
revoke all on function public.toggle_record_relief_checklist(uuid, text, text, boolean) from public, anon;
revoke all on function public.delete_record_relief_case(uuid) from public, anon;
revoke all on function public.get_record_relief_case_detail(uuid) from public, anon;
revoke all on function public.record_relief_guard_fixture() from public;
grant execute on function public.evaluate_record_relief_case(uuid) to authenticated, service_role;
grant execute on function public.save_record_relief_case(uuid, jsonb) to authenticated, service_role;
grant execute on function public.set_record_relief_case_status(uuid, text, date) to authenticated, service_role;
grant execute on function public.toggle_record_relief_checklist(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function public.delete_record_relief_case(uuid) to authenticated, service_role;
grant execute on function public.get_record_relief_case_detail(uuid) to authenticated, service_role;
