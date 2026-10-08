-- DEV research staging: never used by eligibility calculation or published filing forms.
create table if not exists public.record_relief_filing_research_staging (
  jurisdiction_code text primary key,
  official_source_url text,
  form_names text[] not null default '{}',
  fee_notes text,
  research_notes text,
  verification_status text not null default 'needs_review'
    check (verification_status in ('needs_review','source_checked','legal_approved')),
  researched_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  check (verification_status <> 'legal_approved' or (approved_by is not null and approved_at is not null))
);
alter table public.record_relief_filing_research_staging enable row level security;
revoke all on public.record_relief_filing_research_staging from anon, authenticated;
grant all on public.record_relief_filing_research_staging to service_role;
insert into public.record_relief_filing_research_staging (jurisdiction_code,verification_status)
select jurisdiction_code,'needs_review' from public.legal_source_registry
on conflict (jurisdiction_code) do nothing;
