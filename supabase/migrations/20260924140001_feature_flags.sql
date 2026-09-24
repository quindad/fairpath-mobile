-- Step 0 Foundation: server-backed feature flags.
--
-- Deliberately the simplest mechanism that satisfies "server-enforced
-- flags so modules can exist in code but stay hidden until ready":
-- one table, read once per app session, no rules engine. Managed via
-- SQL/Supabase Studio until FairPath Admin exists to manage it in a UI.
--
-- NOT YET APPLIED to the live project from this environment (no DB
-- credentials here) — see supabase/README.md. Apply with:
--   supabase db push
-- or run this file's contents directly in the Supabase SQL editor.

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  description text,
  updated_at timestamptz not null default now()
);

comment on table public.feature_flags is
  'Server-backed feature flags read once per app session by src/core/config/feature-flags.ts. Managed by SQL/Studio until FairPath Admin ships a UI for it.';

alter table public.feature_flags enable row level security;

-- Anyone (including anonymous/guest browsing) can read flags — that's
-- the whole point, the client needs to know what to show before sign-in.
drop policy if exists "feature_flags_read_all" on public.feature_flags;
create policy "feature_flags_read_all"
  on public.feature_flags
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policy for anon/authenticated: writes are
-- service-role/Studio only until Admin exists.

-- Seed flags for modules that already exist in the client today.
-- Values reflect current *actual* behavior, not a change in what's
-- visible — this migration does not hide or show anything by itself,
-- since no screen reads these yet (see Foundation report: wiring flags
-- into screens was left for a later pass to avoid a UI change here).
insert into public.feature_flags (key, enabled, description) values
  ('marketplace_enabled', true, 'FairPath Marketplace (free-forever, locked into V1 per the Master Blueprint).'),
  ('fairpath_ai_enabled', false, 'FairPath AI tools screen — currently a static menu with no backend/AI gateway.'),
  ('credit_builder_enabled', false, 'Credit Builder — currently a static page with no backend.'),
  ('record_relief_enabled', false, 'Record Relief / Forms & Filing — currently static pages with no backend.')
on conflict (key) do nothing;
