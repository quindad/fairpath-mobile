-- Approved and applied to DEV 2026-10-14 (Sterling Braden, founder).
--
-- The real spend-limit/rate-limit system for AI usage. Confirmed by code search this session: NOTHING like
-- this exists anywhere today -- the 5/30/100-credits-per-plan numbers on the pricing page are not enforced
-- anywhere in the database. This closes that gap BEFORE any real AI model gets a live API key connected.
--
-- Two independent protections, because they guard against two different failure modes:
--   1. Per-member balance (ai_credit_balances) -- a member cannot spend more than they're entitled to, even if
--      the client is compromised or malicious, because every check+deduct happens in ONE atomic SQL statement
--      (UPDATE ... WHERE balance >= cost RETURNING) -- there is no window between "check balance" and "deduct"
--      for two simultaneous requests to both succeed and overspend.
--   2. Global daily spend circuit breaker (ai_global_daily_spend) -- a hard ceiling on TOTAL AI spend across
--      every member combined, per day. This is the protection against "a bug loops a call 10,000 times" or
--      "someone found a way to call this RPC directly, outside the app, from many different accounts" -- even
--      if every individual member's own balance check would technically allow it, the global breaker trips
--      first and the whole system refuses new paid AI calls until a human resets it or the next day starts.
--
-- Everything here is spend bookkeeping only. It does not call any AI provider itself -- an Edge Function calls
-- spend_ai_credits() FIRST, and only proceeds to the actual model call if that succeeds.

create table if not exists public.ai_credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Append-only audit trail. Every grant and every spend is a row here, forever -- "Usage and refill history
-- must be auditable" per the approved pricing policy. Never updated or deleted by any role except service_role
-- (for a rare corrected-entry case), matching the admin_audit_log pattern already used elsewhere in this app.
create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('monthly_grant', 'purchase', 'workflow_spend', 'refund', 'admin_adjustment')),
  workflow text,
  balance_after integer not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_credit_ledger_user_idx on public.ai_credit_ledger (user_id, created_at desc);

-- One row per UTC day. The global circuit breaker. hard_cap_credits is a business decision (not legally or
-- technically determined by this migration) -- set conservatively at first and raised deliberately, never left
-- unlimited by default.
create table if not exists public.ai_global_daily_spend (
  spend_date date primary key,
  credits_spent integer not null default 0,
  hard_cap_credits integer not null default 5000,
  tripped boolean not null default false,
  tripped_at timestamptz
);

alter table public.ai_credit_balances enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_global_daily_spend enable row level security;
revoke all on table public.ai_credit_balances, public.ai_credit_ledger, public.ai_global_daily_spend from public, anon, authenticated;

drop policy if exists "members read own ai credit balance" on public.ai_credit_balances;
create policy "members read own ai credit balance" on public.ai_credit_balances for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "members read own ai credit ledger" on public.ai_credit_ledger;
create policy "members read own ai credit ledger" on public.ai_credit_ledger for select to authenticated using (user_id = (select auth.uid()));

grant select on table public.ai_credit_balances, public.ai_credit_ledger to authenticated;
grant select, insert, update on table public.ai_credit_balances, public.ai_credit_ledger, public.ai_global_daily_spend to service_role;

-- The one function every AI workflow MUST call successfully before an Edge Function is allowed to spend a real
-- API call. Atomic: the balance UPDATE and the global-spend UPDATE each use their own WHERE-guarded statement,
-- so two simultaneous calls can never both succeed past the point where only one should.
create or replace function public.spend_ai_credits(p_workflow text, p_cost integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_new_balance integer;
  v_today date := (now() at time zone 'utc')::date;
  v_global record;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if p_cost is null or p_cost <= 0 then raise exception 'INVALID_COST' using errcode = 'P0001'; end if;
  if p_workflow is null or length(p_workflow) = 0 then raise exception 'INVALID_WORKFLOW' using errcode = 'P0001'; end if;

  -- Global circuit breaker first: cheaper to fail fast here than to touch a member's balance for nothing.
  -- Note: a Postgres function that RAISEs rolls back everything it did in that same call, including an UPDATE
  -- -- so the "tripped" flag can only ever be set on a call that SUCCEEDS, never on the call that gets refused
  -- for crossing the cap. The actual blocking doesn't depend on that flag: credits_spent itself never resets
  -- partway, so every subsequent over-cap attempt keeps failing the comparison below regardless of whether
  -- "tripped" got persisted. The flag is an operator-facing signal (so a human notices), not the enforcement.
  insert into public.ai_global_daily_spend (spend_date, credits_spent) values (v_today, 0)
    on conflict (spend_date) do nothing;
  select * into v_global from public.ai_global_daily_spend where spend_date = v_today for update;
  if v_global.credits_spent + p_cost > v_global.hard_cap_credits then
    raise exception 'GLOBAL_SPEND_LIMIT_TRIPPED' using errcode = 'P0001';
  end if;

  -- Per-member atomic check-and-deduct: one statement, no race window.
  update public.ai_credit_balances
     set balance = balance - p_cost, updated_at = now()
   where user_id = uid and balance >= p_cost
   returning balance into v_new_balance;
  if v_new_balance is null then raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001'; end if;

  update public.ai_global_daily_spend
     set credits_spent = credits_spent + p_cost,
         tripped = (credits_spent + p_cost >= hard_cap_credits),
         tripped_at = case when (credits_spent + p_cost >= hard_cap_credits) then now() else tripped_at end
   where spend_date = v_today;

  insert into public.ai_credit_ledger (user_id, delta, reason, workflow, balance_after)
  values (uid, -p_cost, 'workflow_spend', p_workflow, v_new_balance);

  return jsonb_build_object('ok', true, 'balance', v_new_balance);
end;
$$;
revoke all on function public.spend_ai_credits(text, integer) from public, anon;
grant execute on function public.spend_ai_credits(text, integer) to authenticated, service_role;

-- Service-role only: monthly plan resets and purchased-credit grants. Never callable by a member directly --
-- a member cannot grant themselves credits no matter what the client sends.
create or replace function public.grant_ai_credits(p_user uuid, p_amount integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if p_reason not in ('monthly_grant', 'purchase', 'refund', 'admin_adjustment') then raise exception 'INVALID_REASON' using errcode = 'P0001'; end if;

  insert into public.ai_credit_balances (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = ai_credit_balances.balance + p_amount, updated_at = now()
    returning balance into v_new_balance;

  insert into public.ai_credit_ledger (user_id, delta, reason, balance_after)
  values (p_user, p_amount, p_reason, v_new_balance);

  return jsonb_build_object('ok', true, 'balance', v_new_balance);
end;
$$;
revoke all on function public.grant_ai_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.grant_ai_credits(uuid, integer, text) to service_role;

-- Required before this is applied:
--   1. Set hard_cap_credits to a real, deliberately conservative number (the 5000/day default above is a
--      placeholder, not a researched figure) and decide who gets paged when it trips.
--   2. Wire monthly plan resets (grant_ai_credits with reason='monthly_grant') to the real billing-cycle event
--      -- not built here, this migration only provides the function it would call.
--   3. Every Edge Function that calls a real AI provider MUST call spend_ai_credits() first and abort on
--      failure -- this migration enforces the data layer, not the Edge Function call sites themselves.
--   4. Local Postgres test proving atomicity under concurrent-equivalent sequential calls (see
--      scripts/test-local-ai-credit-rate-limit.mjs), before this moves to supabase/migrations/.
