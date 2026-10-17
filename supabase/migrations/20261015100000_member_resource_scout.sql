-- Member Resource Scout: an AI sweeper that finds NEW real resources for members (food, housing, benefits,
-- legal aid, job training, etc.) by periodically re-checking a list of real source URLs, same safety pattern
-- as program-scout-worker (which does the equivalent for employer hiring-incentive programs, a different
-- table entirely -- this migration is deliberately a parallel, not a reuse, of that system, since the two
-- feed different member-facing vs employer-facing surfaces).
--
-- Nothing here EVER auto-publishes to the real public.resources table a member can see. Every AI-found
-- candidate lands in member_resource_candidates with lifecycle_status='needs_review' (or 'rule_verified' only
-- for the narrow, deterministic case of "the URL itself is live and returns real content" -- never for the
-- substance of what the resource claims to offer). Promotion to a real public.resources row is a separate,
-- explicit, service-role-only function call. A source whose content changes after one of its candidates was
-- already promoted marks that resource stale for re-verification, exactly like program-scout.

create table if not exists public.member_resource_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 200),
  official_url text not null,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  crawl_strategy text check (crawl_strategy is null or crawl_strategy in ('html', 'fixture', 'pdf', 'api', 'csv_json_xml', 'document_download')),
  fixture_content text,
  check_cadence text not null default 'weekly' check (check_cadence in ('daily', 'weekly', 'monthly', 'manual_only')),
  active boolean not null default true,
  source_health text not null default 'healthy' check (source_health in ('healthy', 'degraded', 'failing')),
  last_content_hash text,
  last_checked_at timestamptz,
  last_successful_retrieval_at timestamptz,
  next_check_at timestamptz,
  failure_count integer not null default 0,
  data_origin text not null default 'production' check (data_origin in ('production', 'dev_fixture')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_resource_sources_due_idx on public.member_resource_sources (next_check_at) where active = true;
create index if not exists member_resource_sources_state_idx on public.member_resource_sources (state_code);

create table if not exists public.member_resource_retrieval_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.member_resource_sources(id) on delete cascade,
  completed_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failure')),
  http_status integer,
  content_hash text,
  retrieved_summary text,
  error_message text
);
create index if not exists member_resource_retrieval_runs_source_idx on public.member_resource_retrieval_runs (source_id, completed_at desc);

create table if not exists public.member_resource_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.member_resource_sources(id) on delete cascade,
  retrieval_run_id uuid references public.member_resource_retrieval_runs(id) on delete set null,
  lifecycle_status text not null default 'extracted' check (lifecycle_status in ('extracted', 'rule_verified', 'needs_review', 'promoted', 'rejected')),
  title text,
  summary text,
  description text,
  resource_kind text check (resource_kind is null or resource_kind in ('program', 'service', 'benefit', 'hotline', 'document_help', 'course_link')),
  category_slugs text[] not null default '{}',
  cost_type text check (cost_type is null or cost_type in ('free', 'sliding', 'paid', 'unknown')),
  eligibility_summary text,
  official_source_url text,
  application_url text,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  is_national boolean not null default false,
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence between 0 and 1)),
  extraction_notes text,
  extraction_method text not null default 'ai_assisted' check (extraction_method in ('ai_assisted', 'deterministic_fixture')),
  promoted_resource_id uuid references public.resources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_resource_candidates_source_idx on public.member_resource_candidates (source_id);
create index if not exists member_resource_candidates_status_idx on public.member_resource_candidates (lifecycle_status);

create table if not exists public.member_resource_change_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.member_resource_sources(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete set null,
  candidate_id uuid references public.member_resource_candidates(id) on delete set null,
  change_type text not null default 'new_document_version',
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists member_resource_change_events_source_idx on public.member_resource_change_events (source_id);

create table if not exists public.member_resource_review_queue (
  id uuid primary key default gen_random_uuid(),
  item_type text not null default 'new_candidate' check (item_type in ('new_candidate', 'change_event')),
  reference_id uuid not null,
  reason text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists member_resource_review_queue_open_idx on public.member_resource_review_queue (priority, created_at) where resolved_at is null;

alter table public.member_resource_sources enable row level security;
alter table public.member_resource_retrieval_runs enable row level security;
alter table public.member_resource_candidates enable row level security;
alter table public.member_resource_change_events enable row level security;
alter table public.member_resource_review_queue enable row level security;
revoke all on table public.member_resource_sources, public.member_resource_retrieval_runs, public.member_resource_candidates, public.member_resource_change_events, public.member_resource_review_queue
  from public, anon, authenticated;
grant select, insert, update, delete on table public.member_resource_sources, public.member_resource_retrieval_runs, public.member_resource_candidates, public.member_resource_change_events, public.member_resource_review_queue
  to service_role;

-- Narrow, deterministic gate: a candidate can only be auto-marked 'rule_verified' (still NOT promoted/public)
-- when it has the structural minimum a real resource needs. This never verifies the SUBSTANCE of a claim
-- (whether the program really is free, really serves that state, etc.) -- only that the candidate isn't
-- obviously broken. Everything else lands on 'needs_review' for a human.
create or replace function public.member_resource_evaluate_candidate(p_candidate_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  result text;
begin
  select * into c from public.member_resource_candidates where id = p_candidate_id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;

  if c.title is not null and length(c.title) >= 3
     and c.summary is not null and length(c.summary) >= 10
     and c.official_source_url is not null
     and c.resource_kind is not null
     and array_length(c.category_slugs, 1) > 0
     and coalesce(c.extraction_confidence, 0) >= 0.7
  then
    result := 'rule_verified';
  else
    result := 'needs_review';
  end if;

  update public.member_resource_candidates set lifecycle_status = result, updated_at = now() where id = p_candidate_id;

  insert into public.member_resource_review_queue (item_type, reference_id, reason, priority)
  values (
    'new_candidate', p_candidate_id,
    case when result = 'rule_verified'
      then 'Structurally complete candidate from ' || coalesce(c.title, 'an unnamed source') || ' -- still needs a human to confirm the content itself before it goes live to members.'
      else 'Incomplete or low-confidence candidate from ' || coalesce(c.title, 'an unnamed source') || ' -- needs review before it can even be considered for promotion.'
    end,
    case when result = 'rule_verified' then 'normal' else 'low' end
  );

  return result;
end;
$$;
revoke all on function public.member_resource_evaluate_candidate(uuid) from public, anon, authenticated;
grant execute on function public.member_resource_evaluate_candidate(uuid) to service_role;

-- The ONLY path from a candidate to something a member can actually see. Explicit, service-role-only, never
-- automatic. A human (or a future admin-reviewed automation, not built here) calls this after actually
-- confirming the candidate's content is accurate -- the function itself does not re-verify substance, it only
-- performs the mechanical promotion once a human has decided to trust it.
create or replace function public.member_resource_promote_candidate(p_candidate_id uuid, p_org_name text, p_org_slug text, p_org_type text default 'nonprofit')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_org_id uuid;
  v_resource_id uuid;
  cat text;
begin
  select * into c from public.member_resource_candidates where id = p_candidate_id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  if c.lifecycle_status = 'promoted' then raise exception 'ALREADY_PROMOTED'; end if;
  if c.title is null or c.summary is null or c.official_source_url is null or c.resource_kind is null then
    raise exception 'CANDIDATE_INCOMPLETE';
  end if;

  insert into public.resource_organizations (name, slug, org_type, website_url, is_national, status, data_origin)
  values (p_org_name, p_org_slug, p_org_type, c.official_source_url, c.is_national, 'active', 'production')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.resources (organization_id, title, summary, description, resource_kind, delivery_mode, is_national, cost_type, eligibility_summary, official_source_url, application_url, source_authority, publish_status, verification_state, last_verified_at, data_origin)
  values (v_org_id, c.title, c.summary, c.description, c.resource_kind, 'virtual', c.is_national, coalesce(c.cost_type, 'unknown'), c.eligibility_summary, c.official_source_url, c.application_url, 'community', 'published', 'verified', now(), 'production')
  returning id into v_resource_id;

  foreach cat in array c.category_slugs loop
    insert into public.resource_category_links (resource_id, category_slug, is_primary)
    values (v_resource_id, cat, cat = c.category_slugs[1])
    on conflict do nothing;
  end loop;

  if c.is_national then
    insert into public.resource_service_areas (resource_id, area_type) values (v_resource_id, 'national');
  elsif c.state_code is not null then
    insert into public.resource_service_areas (resource_id, area_type, state_code) values (v_resource_id, 'state', c.state_code);
  end if;

  insert into public.resource_contacts (resource_id, method, value, label, is_primary)
  values (v_resource_id, 'url', c.official_source_url, 'Website', true);

  update public.member_resource_candidates set lifecycle_status = 'promoted', promoted_resource_id = v_resource_id, updated_at = now() where id = p_candidate_id;

  return v_resource_id;
end;
$$;
revoke all on function public.member_resource_promote_candidate(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.member_resource_promote_candidate(uuid, text, text, text) to service_role;

-- If a promoted resource's source changes content later, mark it stale for re-verification rather than
-- silently trusting the old promoted data forever.
create or replace function public.member_resource_mark_stale(p_resource_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resources set verification_state = 'unverified' where id = p_resource_id;
  insert into public.member_resource_review_queue (item_type, reference_id, reason, priority)
  values ('change_event', p_resource_id, p_reason, 'high');
end;
$$;
revoke all on function public.member_resource_mark_stale(uuid, text) from public, anon, authenticated;
grant execute on function public.member_resource_mark_stale(uuid, text) to service_role;
