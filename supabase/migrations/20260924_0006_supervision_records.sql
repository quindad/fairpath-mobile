-- Step 1 Canonical Profile: supervision_records.
--
-- officer_contact deliberately NOT included (Sterling decision #6:
-- removed from V1 as unnecessary data collection beyond what the
-- current workflow needs).
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

create table if not exists public.supervision_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conviction_id uuid references public.convictions(id) on delete set null,
  origin text not null default 'manual'
    check (origin in ('manual', 'questionnaire', 'document_extraction')),
  supervision_type text not null default 'other'
    check (supervision_type in ('probation', 'parole', 'post_release_control', 'pretrial', 'other')),
  jurisdiction_state text,
  start_date date,
  end_date date,
  status text not null default 'unknown'
    check (status in ('active', 'completed', 'revoked', 'unknown')),
  employment_restrictions text[] not null default '{}',
  housing_restrictions text[] not null default '{}',
  geographic_restrictions text[] not null default '{}',
  supervising_agency text,
  source_notes text,
  source_type text not null default 'self_reported'
    check (source_type in ('self_reported', 'document', 'official_record', 'partner_verified')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.supervision_records is
  'origin=questionnaire marks the row the profile questionnaire (restrictions.supervision_status) reads/writes. supervision_type defaults to other because that question does not currently capture probation/parole/etc. distinction — a future fuller collection flow can add origin=manual rows with real detail.';

create index if not exists supervision_records_user_id_idx on public.supervision_records(user_id);

alter table public.supervision_records enable row level security;

drop policy if exists "supervision_records_owner_all" on public.supervision_records;
create policy "supervision_records_owner_all"
  on public.supervision_records
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No anon access. No partner/employer/service-role read policy.
