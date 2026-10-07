-- ============================================================================================
-- DRAFT — NOT APPLIED. DO NOT RUN. Lives outside supabase/migrations on purpose so no tool or
-- person accidentally applies it with `supabase db push`. This is a proposal for founder and
-- backend review. Written against the schema in supabase/migrations/20260930100000_entitlements.sql
-- (read first) and reuses its tables and conventions rather than creating a parallel system.
-- ============================================================================================
--
-- WHAT THIS CHANGES, IN PLAIN LANGUAGE
--
-- Today public.entitlement_grants and public.billing_subscriptions only know one entitlement:
-- 'fairpath_plus', which is active or not. The frozen V1 pricing model has three member tiers
-- (Free / FairPath+ / Premium) with different monthly AI credit allowances (5 / 30 / 100) and
-- different Premium-only AI actions (full credit analysis, dispute-letter drafting). The client
-- cannot honestly tell Plus from Premium today, so it currently treats "active" as Plus, the
-- ceiling it can prove. This migration adds a second entitlement value, 'fairpath_premium', and
-- a canonical my_fairpath_tier() function that returns 'free' | 'plus' | 'premium'. It also adds
-- an AI credit ledger that mirrors the client-side logic in src/core/credits/ledger.ts so credit
-- spending is enforced server-side, not just trusted from the client.
--
-- WHAT IT DOES NOT CHANGE
--
-- - my_fairpath_plus_status() keeps its exact current return shape. Existing callers (Marketplace
--   claim quota, FastTrack pricing) keep working unchanged: it now treats Premium as satisfying
--   "has FairPath+" too, since Premium is a superset in the frozen model (same 7 Marketplace
--   claims/month as Plus).
-- - No existing row is deleted or renamed. The existing 'fairpath_plus' entitlement keeps meaning
--   exactly what it means today.
-- - No billing is activated. This only prepares the data model; checkout and real charges are a
--   separate, explicitly-approved step.
--
-- ROLLBACK
--
-- - New tables (ai_credit_buckets, ai_credit_debits, ai_action_credit_costs) can be dropped with
--   no effect on existing entitlement or billing data: `drop table if exists ... cascade;` in
--   reverse creation order.
-- - The entitlement_grants / billing_subscriptions CHECK constraint widening (fairpath_plus ->
--   fairpath_plus, fairpath_premium) is reversible only if no 'fairpath_premium' rows exist yet;
--   document that before rolling back in production.
-- - my_fairpath_tier() and debit_ai_credits() are new functions; dropping them does not affect
--   my_fairpath_plus_status(), which is left functionally equivalent to today plus the Premium case.
--
-- ISOLATION
--
-- - Every new table carries user_id and RLS: owner can select their own row, only service_role
--   writes, matching the existing entitlement_grants / billing_subscriptions pattern exactly.
-- - No organization-scoped data is touched; this is member-only entitlement and credit state.
--
-- TESTS TO ADD BEFORE THIS IS APPLIED (not written here — write server-side pgTAP or a local-sql
-- harness test matching scripts/test-local-*.mjs conventions)
-- - my_fairpath_tier() returns 'premium' only when a valid fairpath_premium grant or subscription
--   exists, 'plus' when only fairpath_plus exists, 'free' otherwise.
-- - my_fairpath_plus_status().active is true for both plus and premium members.
-- - debit_ai_credits() never goes negative, is idempotent per request id, spends monthly credits
--   before purchased, and spends purchased credits in earliest-expiry order (same rule as the
--   client's src/core/credits/ledger.ts, now enforced server-side so a modified client can't cheat).
-- - A Premium-only action (dispute_letter_draft, full_credit_report_analysis) is refused for a
--   'free' or 'plus' tier before any debit happens.
--
-- ============================================================================================

-- ---------------------------------------------------------------------
-- 1. Allow a second entitlement value. Existing rows are untouched.
-- ---------------------------------------------------------------------
alter table public.entitlement_grants drop constraint if exists entitlement_grants_entitlement_check;
alter table public.entitlement_grants add constraint entitlement_grants_entitlement_check
  check (entitlement in ('fairpath_plus', 'fairpath_premium'));

-- billing_subscriptions has no entitlement column; tier is derived from product_id by convention.
-- Provider product ids must follow 'fairpath_plus_*' or 'fairpath_premium_*'. This avoids a schema
-- change to billing_subscriptions and keeps apply_subscription_event() untouched.
create or replace function public.billing_tier_from_product(p_product_id text)
returns text
language sql
immutable
as $$
  select case
    when p_product_id ilike 'fairpath_premium%' then 'fairpath_premium'
    when p_product_id ilike 'fairpath_plus%' then 'fairpath_plus'
    else null
  end;
$$;

-- ---------------------------------------------------------------------
-- 2. Canonical tier resolution. Reuses fairpath_plus_status's query shape; does not replace it.
-- ---------------------------------------------------------------------
create or replace function public.fairpath_tier(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sub public.billing_subscriptions%rowtype;
  g public.entitlement_grants%rowtype;
  tier text;
begin
  if p_user is null then
    return jsonb_build_object('tier', 'free', 'active', false, 'source', null);
  end if;

  -- Highest-tier valid subscription wins (premium over plus if, implausibly, both exist).
  select * into sub from public.billing_subscriptions b
   where b.user_id = p_user and b.status in ('active', 'in_grace')
     and (b.current_period_end is null or b.current_period_end > now())
     and public.billing_tier_from_product(b.product_id) is not null
   order by (public.billing_tier_from_product(b.product_id) = 'fairpath_premium') desc, b.current_period_end desc nulls first
   limit 1;
  if found then
    tier := public.billing_tier_from_product(sub.product_id);
    return jsonb_build_object(
      'tier', case when tier = 'fairpath_premium' then 'premium' else 'plus' end,
      'active', true, 'source', 'paid_subscription', 'complimentary', false, 'provider', sub.provider,
      'expires_at', sub.current_period_end,
      'days_remaining', case when sub.current_period_end is null then null else greatest(0, ceil(extract(epoch from (sub.current_period_end - now())) / 86400))::int end);
  end if;

  select * into g from public.entitlement_grants e
   where e.user_id = p_user and e.status = 'active' and e.starts_at <= now() and e.expires_at > now()
   order by (e.entitlement = 'fairpath_premium') desc, e.expires_at desc
   limit 1;
  if found then
    return jsonb_build_object(
      'tier', case when g.entitlement = 'fairpath_premium' then 'premium' else 'plus' end,
      'active', true, 'source', g.source_type, 'complimentary', true, 'provider', null,
      'expires_at', g.expires_at,
      'days_remaining', greatest(0, ceil(extract(epoch from (g.expires_at - now())) / 86400))::int);
  end if;

  -- legacy fairpath_subscriptions row: no tier information, treated as plus to match today's behavior
  if exists (select 1 from public.fairpath_subscriptions s where s.user_id = p_user and s.plan = 'fairpath_plus' and s.status = 'active'
             and (s.current_period_end is null or s.current_period_end > now())) then
    return jsonb_build_object('tier', 'plus', 'active', true, 'source', 'paid_subscription', 'complimentary', false, 'provider', 'legacy');
  end if;

  return jsonb_build_object('tier', 'free', 'active', false, 'source', null);
end;
$$;
revoke all on function public.fairpath_tier(uuid) from public, anon, authenticated;
grant execute on function public.fairpath_tier(uuid) to service_role;

create or replace function public.my_fairpath_tier()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  return public.fairpath_tier(auth.uid());
end;
$$;
revoke all on function public.my_fairpath_tier() from public, anon;
grant execute on function public.my_fairpath_tier() to authenticated, service_role;

-- my_fairpath_plus_status() keeps its existing shape and existing callers, but now also reports
-- active=true for Premium members, since Premium is a superset per the frozen pricing model.
create or replace function public.my_fairpath_plus_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare t jsonb;
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  t := public.fairpath_tier(auth.uid());
  if (t ->> 'tier') = 'free' then
    return jsonb_build_object('active', false, 'source', null, 'complimentary', false);
  end if;
  return jsonb_build_object(
    'active', true, 'source', t ->> 'source', 'complimentary', (t ->> 'complimentary')::boolean,
    'provider', t ->> 'provider', 'expires_at', t ->> 'expires_at', 'days_remaining', (t ->> 'days_remaining')::int);
end;
$$;
revoke all on function public.my_fairpath_plus_status() from public, anon;
grant execute on function public.my_fairpath_plus_status() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. AI credit ledger: server-enforced version of src/core/credits/ledger.ts.
-- ---------------------------------------------------------------------
create table if not exists public.ai_action_credit_costs (
  action text primary key,
  credits integer not null check (credits > 0),
  premium_only boolean not null default false
);
-- Seed values MUST match src/core/membership/frozen-v1.ts exactly. A mismatch is a bug, not a choice.
insert into public.ai_action_credit_costs (action, credits, premium_only) values
  ('resume_create_or_rewrite', 2, false),
  ('job_fit_explanation', 1, false),
  ('resource_concierge', 1, false),
  ('personal_plan', 2, false),
  ('record_relief_explanation', 2, false),
  ('dispute_letter_draft', 2, true),
  ('full_credit_report_analysis', 10, true)
on conflict (action) do update set credits = excluded.credits, premium_only = excluded.premium_only;

create table if not exists public.ai_credit_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('monthly', 'purchased')),
  remaining integer not null check (remaining >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_credit_buckets_user_idx on public.ai_credit_buckets (user_id, expires_at);

create table if not exists public.ai_credit_debits (
  request_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null references public.ai_action_credit_costs(action),
  credits integer not null,
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ai_action_credit_costs enable row level security;
alter table public.ai_credit_buckets enable row level security;
alter table public.ai_credit_debits enable row level security;

drop policy if exists "ai_action_credit_costs_read" on public.ai_action_credit_costs;
create policy "ai_action_credit_costs_read" on public.ai_action_credit_costs for select to authenticated using (true);
drop policy if exists "ai_credit_buckets_owner_read" on public.ai_credit_buckets;
create policy "ai_credit_buckets_owner_read" on public.ai_credit_buckets for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "ai_credit_debits_owner_read" on public.ai_credit_debits;
create policy "ai_credit_debits_owner_read" on public.ai_credit_debits for select to authenticated using (user_id = (select auth.uid()));

grant select on table public.ai_action_credit_costs to authenticated;
grant select on table public.ai_credit_buckets to authenticated;
grant select on table public.ai_credit_debits to authenticated;
grant select, insert, update, delete on table public.ai_credit_buckets to service_role;
grant select, insert, update on table public.ai_credit_debits to service_role;

-- Debits monthly first, then purchased by earliest expiry — identical rule to the client ledger,
-- enforced here so a modified client cannot spend more than it has. Idempotent per request_id.
create or replace function public.debit_ai_credits(p_user uuid, p_action text, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cost_row public.ai_action_credit_costs%rowtype;
  tier text;
  need integer;
  have integer;
  b record;
  remaining_to_take integer;
begin
  select * into cost_row from public.ai_action_credit_costs c where c.action = p_action;
  if not found then raise exception 'UNKNOWN_ACTION' using errcode = 'P0001'; end if;

  if exists (select 1 from public.ai_credit_debits d where d.request_id = p_request_id) then
    return jsonb_build_object('ok', true, 'already_applied', true, 'credits', 0);
  end if;

  tier := (public.fairpath_tier(p_user) ->> 'tier');
  if cost_row.premium_only and tier is distinct from 'premium' then
    return jsonb_build_object('ok', false, 'reason', 'premium_required');
  end if;

  need := cost_row.credits;
  select coalesce(sum(remaining), 0) into have from public.ai_credit_buckets where user_id = p_user and expires_at > now();
  if have < need then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'needed', need, 'available', have);
  end if;

  remaining_to_take := need;
  for b in
    select id, remaining from public.ai_credit_buckets
     where user_id = p_user and expires_at > now() and remaining > 0
     order by (kind = 'purchased'), expires_at asc
     for update
  loop
    exit when remaining_to_take <= 0;
    if b.remaining <= remaining_to_take then
      update public.ai_credit_buckets set remaining = 0 where id = b.id;
      remaining_to_take := remaining_to_take - b.remaining;
    else
      update public.ai_credit_buckets set remaining = b.remaining - remaining_to_take where id = b.id;
      remaining_to_take := 0;
    end if;
  end loop;

  insert into public.ai_credit_debits (request_id, user_id, action, credits) values (p_request_id, p_user, p_action, need);
  return jsonb_build_object('ok', true, 'already_applied', false, 'credits', need);
end;
$$;
revoke all on function public.debit_ai_credits(uuid, text, text) from public, anon, authenticated;
grant execute on function public.debit_ai_credits(uuid, text, text) to service_role;

-- Refunds a prior debit in full as a new purchased bucket (never expires the member's existing
-- credits early). Marks the debit refunded so it cannot be refunded twice.
create or replace function public.refund_ai_credits(p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare d public.ai_credit_debits%rowtype;
begin
  select * into d from public.ai_credit_debits where request_id = p_request_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if d.refunded then return jsonb_build_object('ok', true, 'already_refunded', true); end if;

  insert into public.ai_credit_buckets (user_id, kind, remaining, expires_at)
  values (d.user_id, 'purchased', d.credits, now() + interval '12 months');
  update public.ai_credit_debits set refunded = true where request_id = p_request_id;
  return jsonb_build_object('ok', true, 'already_refunded', false);
end;
$$;
revoke all on function public.refund_ai_credits(text) from public, anon, authenticated;
grant execute on function public.refund_ai_credits(text) to service_role;
