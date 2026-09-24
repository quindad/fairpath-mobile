-- Step 1 Canonical Profile: consent_events.
--
-- Append-only audit ledger. No formal retention-period or
-- column-level-encryption commitment is made here (Sterling decision
-- #5) — this is RLS-only privacy, with formal retention/security
-- policy explicitly deferred to later legal/security review.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'terms_accepted',
    'privacy_accepted',
    'justice_history_disclosure_consent',
    'program_screening_consent',
    'marketing_opt_in',
    'marketing_opt_out',
    'data_deletion_requested',
    'other'
  )),
  document_version text,
  granted boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.consent_events is
  'Append-only consent/audit ledger. profiles.terms_accepted_at/privacy_accepted_at are denormalized "current state" pointers for fast checks; this table is the full history. Insert-only by design — no update/delete policy is granted to authenticated users.';

create index if not exists consent_events_user_id_idx on public.consent_events(user_id);
create index if not exists consent_events_event_type_idx on public.consent_events(event_type);

alter table public.consent_events enable row level security;

drop policy if exists "consent_events_owner_read" on public.consent_events;
create policy "consent_events_owner_read"
  on public.consent_events for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "consent_events_owner_insert" on public.consent_events;
create policy "consent_events_owner_insert"
  on public.consent_events for insert
  to authenticated
  with check (user_id = auth.uid());

-- Deliberately no update/delete policy for authenticated (or anon):
-- consent history must not be editable once recorded.
