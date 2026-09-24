-- Step 1 Canonical Profile: registration_records.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

create table if not exists public.registration_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  origin text not null default 'manual'
    check (origin in ('manual', 'questionnaire', 'document_extraction')),
  registration_type text not null default 'sex_offender'
    check (registration_type in ('sex_offender', 'other')),
  jurisdiction_state text,
  tier_or_level text,
  is_lifetime boolean,
  registration_start_date date,
  registration_end_date date,
  compliance_status text check (compliance_status in ('compliant', 'non_compliant', 'unknown')),
  source_type text not null default 'self_reported'
    check (source_type in ('self_reported', 'document', 'official_record', 'partner_verified')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'document_verified', 'official_record_verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.registration_records is
  'origin=questionnaire marks the row the profile questionnaire (restrictions.sex_offender_registration) reads/writes.';

create index if not exists registration_records_user_id_idx on public.registration_records(user_id);

alter table public.registration_records enable row level security;

drop policy if exists "registration_records_owner_all" on public.registration_records;
create policy "registration_records_owner_all"
  on public.registration_records
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No anon access. No partner/employer/service-role read policy.
