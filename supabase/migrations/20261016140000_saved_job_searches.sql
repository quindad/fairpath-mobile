-- Job alerts (2026-10-16, Sterling): a real Indeed-parity feature -- save a search and get notified about new
-- matching jobs. Mirrors saved_housing_searches exactly (same columns, same RLS ownership pattern). Actual
-- alert DELIVERY (push/email/SMS) is intentionally not wired here -- that's the same known, pre-existing gap
-- flagged in docs/MASTER_TODO_2026-10-13.md ("Push/email/SMS actually sending... nothing is actually being
-- sent yet"), and saved_housing_searches already ships honestly with the same limitation stated in its own
-- screen copy ("Alert delivery is not turned on until FairPath notification delivery is connected."). This
-- migration gives members a real place to save the search today; wiring actual delivery is separate work.
create table public.saved_job_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Job search',
  query text not null default '',
  location text not null default '',
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_job_searches_user_idx on public.saved_job_searches (user_id, updated_at desc);

alter table public.saved_job_searches enable row level security;
revoke all on table public.saved_job_searches from anon, authenticated;
grant select, insert, update, delete on table public.saved_job_searches to authenticated;
grant all on table public.saved_job_searches to service_role;

create policy "Users read own job searches" on public.saved_job_searches
  for select to authenticated using (user_id = auth.uid());
create policy "Users create own job searches" on public.saved_job_searches
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own job searches" on public.saved_job_searches
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own job searches" on public.saved_job_searches
  for delete to authenticated using (user_id = auth.uid());
