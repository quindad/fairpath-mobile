-- Step 1 Canonical Profile: addresses.
--
-- Reuses the label vocabulary already defined in
-- src/core/autofill/autofill.ts's CanonicalAddress type, plus 'prior'
-- for rental history (Housing Ready needs multiple past addresses).
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'home'
    check (label in ('home', 'mailing', 'release', 'business', 'property', 'prior', 'other')),
  line1 text,
  line2 text,
  city text,
  state text,
  postal_code text,
  country_code text not null default 'US',
  start_date date,
  end_date date,
  is_current boolean not null default false,
  formatted text,
  place_provider_id text,
  source text not null default 'user'
    check (source in ('user', 'document_extraction', 'partner_assisted', 'imported')),
  verification_state text not null default 'self_reported'
    check (verification_state in ('self_reported', 'user_confirmed', 'needs_review', 'verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.addresses is
  'Structured addresses (current, mailing, prior/rental-history, etc). line1/city/state/postal_code are nullable because backfilled rows from free-text profile_answers[identity.address] may only populate `formatted` and are marked needs_review until the user confirms a structured address (Sterling decision #4 — progressive, not blocking).';

create index if not exists addresses_user_id_idx on public.addresses(user_id);

alter table public.addresses enable row level security;

drop policy if exists "addresses_owner_all" on public.addresses;
create policy "addresses_owner_all"
  on public.addresses
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No anon access. No partner/employer/service-role policy — sensitive
-- personal data, owner-only for the life of V1 Mobile.
