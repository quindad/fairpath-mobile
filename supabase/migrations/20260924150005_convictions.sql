-- Step 1 Canonical Profile: convictions.
--
-- Supersedes profile_answers['convictions.*'], profiles.justice_impacted,
-- and the pre-existing, zero-caller user_convictions table (a 3-way
-- split collapsed into one canonical table).
--
-- share_with_employers is deliberately NOT included (Sterling decision
-- #3: retired). Employers/property owners never receive raw conviction
-- records through FairPath matching — only an eligibility/match result
-- from a security-definer RPC (planned Step 2: evaluate_justice_eligibility).
-- No RLS policy in this migration or any future one should grant a
-- partner/employer role direct table access here.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

create table if not exists public.convictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  offense_catalog_id uuid references public.offense_catalog(id),
  taxonomy_category_id uuid references public.offense_taxonomy_categories(id),
  origin text not null default 'manual'
    check (origin in ('manual', 'questionnaire', 'document_extraction')),
  jurisdiction_type text check (jurisdiction_type in ('federal', 'state', 'territory', 'local')),
  state_code text,
  county text,
  court_name text,
  case_number text,
  offense_code text,
  offense_title text,
  offense_level text,
  offense_degree text,
  offense_class text,
  disposition text,
  conviction_date date,
  sentence_date date,
  release_date date,
  sentence_summary text,
  supervision_status text,
  is_violent boolean,
  is_sexual boolean,
  source_type text not null default 'self_reported'
    check (source_type in ('self_reported', 'document', 'official_record', 'partner_verified')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  source_reference text,
  user_notes text,
  legacy_user_conviction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.convictions is
  'Canonical justice-history conviction records. taxonomy_category_id is nullable: backfilled and freshly-collected self-reported rows start uncategorized (verification_state=needs_review) until the categorization pass (see src/core/eligibility/categorize-offense.ts) runs. origin=questionnaire marks the single row the progressive profile questionnaire (identity/eligibility area) reads and writes, distinct from any future full conviction-history editor which would insert origin=manual rows.';

create index if not exists convictions_user_id_idx on public.convictions(user_id);
create index if not exists convictions_taxonomy_category_id_idx on public.convictions(taxonomy_category_id);
create unique index if not exists convictions_legacy_user_conviction_id_uidx
  on public.convictions(legacy_user_conviction_id) where legacy_user_conviction_id is not null;

alter table public.convictions enable row level security;

drop policy if exists "convictions_owner_all" on public.convictions;
create policy "convictions_owner_all"
  on public.convictions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No anon access. No partner/employer/service-role read policy.
