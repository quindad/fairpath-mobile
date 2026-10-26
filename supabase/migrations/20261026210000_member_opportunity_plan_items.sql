-- Member-authored My Path plan steps (multi-need planner + Help now). One row per device client_id for idempotent upsert.
create table if not exists public.member_opportunity_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  title text not null,
  status text not null default 'exploring' check (status in (
    'exploring', 'saved', 'requested', 'offer_received', 'pickup_arranged',
    'referral_submitted', 'completed', 'unresolved'
  )),
  route text,
  need_labels text[] not null default '{}'::text[],
  note text,
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists member_opportunity_plan_items_user_idx
  on public.member_opportunity_plan_items (user_id, updated_at desc);

alter table public.member_opportunity_plan_items enable row level security;
revoke all on table public.member_opportunity_plan_items from public, anon;
grant select, insert, update, delete on table public.member_opportunity_plan_items to authenticated;
grant all on table public.member_opportunity_plan_items to service_role;

create policy "member_opportunity_plan_items_own"
  on public.member_opportunity_plan_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.member_opportunity_plan_items is
  'My Path plan steps the member confirmed on device. No case-manager assignment; syncs across sessions for the same account.';
