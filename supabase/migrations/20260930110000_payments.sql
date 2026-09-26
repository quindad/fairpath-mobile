-- Payment foundation (Stripe) for real-world service transactions such as Housing FastTrack (forward-only).
--
-- Rules this schema enforces:
--   * The SERVER decides what a payment is for and how much it costs. Prices live in payment_products;
--     the amount charged is quote_housing_fasttrack(...).amount_due_cents, computed here, never sent by the app.
--   * The client can never mark anything paid. payment_transactions / orders change only through
--     apply_payment_event(), which is called by the Stripe webhook Edge Function AFTER it verifies the
--     Stripe signature. A "success" callback in the app is only a hint to re-read the server.
--   * Webhooks are idempotent (payment_events.provider_event_id is the primary key).
--   * Payment is NOT application status: nothing here reads or writes housing_applications.status.
--   * No card data is stored anywhere: only Stripe object ids, amounts, currency, purpose and status.
--   * Refund-ready: payment_refunds mirrors Stripe refunds; orders move to 'refunded'.
--   * FairPath+ subscriptions are NOT processed here (they use the store billing boundary).

create table if not exists public.payment_products (
  code text primary key,
  name text not null,
  base_amount_cents integer not null check (base_amount_cents > 0),
  plus_discount_cents integer not null default 0 check (plus_discount_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (plus_discount_cents < base_amount_cents)
);
insert into public.payment_products (code, name, base_amount_cents, plus_discount_cents)
values ('fasttrack_application', 'FastTrack housing application', 7500, 1000)
on conflict (code) do nothing;

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('housing_fasttrack')),
  purpose_ref uuid not null,
  product_code text not null references public.payment_products(code),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null default 'requires_payment_method' check (status in (
    'requires_payment_method', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled', 'partially_refunded', 'refunded')),
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_payment_intent_id text unique,
  provider_customer_id text,
  idempotency_key text not null unique,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz
);
create index if not exists payment_transactions_user_idx on public.payment_transactions (user_id, created_at desc);
-- one live attempt per purpose_ref: a second tap or a retry reuses it instead of double-charging
create unique index if not exists payment_transactions_one_open_per_ref
  on public.payment_transactions (purpose, purpose_ref)
  where status in ('requires_payment_method', 'requires_action', 'processing');

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  provider_refund_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  provider_event_id text primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------
-- RLS / grants
-- ---------------------------------------------------------------------
alter table public.payment_products enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "payment_products_read" on public.payment_products;
create policy "payment_products_read" on public.payment_products for select to authenticated using (active);
drop policy if exists "payment_transactions_owner_read" on public.payment_transactions;
create policy "payment_transactions_owner_read" on public.payment_transactions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "payment_refunds_owner_read" on public.payment_refunds;
create policy "payment_refunds_owner_read" on public.payment_refunds for select to authenticated
  using (exists (select 1 from public.payment_transactions t where t.id = payment_refunds.transaction_id and t.user_id = (select auth.uid())));

-- Members see receipts and status, never metadata or internal columns.
grant select on table public.payment_products to authenticated;
grant select (id, purpose, purpose_ref, product_code, amount_cents, currency, status, provider, provider_payment_intent_id, failure_code, created_at, updated_at, succeeded_at)
  on table public.payment_transactions to authenticated;
grant select (id, transaction_id, amount_cents, status, reason, created_at) on table public.payment_refunds to authenticated;

grant select, insert, update, delete on table public.payment_products to service_role;
grant select, insert, update, delete on table public.stripe_customers to service_role;
grant select, insert, update, delete on table public.payment_transactions to service_role;
grant select, insert, update, delete on table public.payment_refunds to service_role;
grant select, insert, update, delete on table public.payment_events to service_role;

-- ---------------------------------------------------------------------
-- Server-authoritative FastTrack quote (price comes from payment_products; plan from the entitlement system)
-- ---------------------------------------------------------------------
create or replace function public.quote_housing_fasttrack(p_application_id uuid)
returns table (order_id uuid, base_amount_cents integer, discount_cents integer, amount_due_cents integer, status text, payment_enforced boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_plus boolean := false;
  v_order public.housing_fasttrack_orders%rowtype;
  v_enforced boolean := false;
  prod public.payment_products%rowtype;
  v_discount integer;
begin
  if v_user is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.housing_applications a
    where a.id = p_application_id and a.user_id = v_user and a.application_type = 'fasttrack'
  ) then
    raise exception 'NOT_FASTTRACK_APPLICATION' using errcode = 'P0001';
  end if;

  select * into prod from public.payment_products p where p.code = 'fasttrack_application' and p.active;
  if not found then raise exception 'PRICING_UNAVAILABLE' using errcode = 'P0001'; end if;

  v_plus := public.has_fairpath_plus(v_user);
  v_discount := case when v_plus then prod.plus_discount_cents else 0 end;
  select coalesce((c.value #>> '{}')::boolean, false) into v_enforced
  from public.app_config c where c.key = 'fasttrack_payment_enforced';

  insert into public.housing_fasttrack_orders (application_id, user_id, base_amount_cents, discount_cents, amount_due_cents, currency, status, updated_at)
  values (p_application_id, v_user, prod.base_amount_cents, v_discount, prod.base_amount_cents - v_discount, prod.currency, 'requires_payment', now())
  on conflict (application_id) do update set
    -- never rewrite the amounts of an order that is already paid or refunded
    base_amount_cents = case when housing_fasttrack_orders.status in ('paid', 'refunded') then housing_fasttrack_orders.base_amount_cents else excluded.base_amount_cents end,
    discount_cents = case when housing_fasttrack_orders.status in ('paid', 'refunded') then housing_fasttrack_orders.discount_cents else excluded.discount_cents end,
    amount_due_cents = case when housing_fasttrack_orders.status in ('paid', 'refunded') then housing_fasttrack_orders.amount_due_cents else excluded.amount_due_cents end,
    updated_at = now()
  returning * into v_order;

  return query select v_order.id, v_order.base_amount_cents, v_order.discount_cents, v_order.amount_due_cents, v_order.status, v_enforced;
end;
$$;
revoke all on function public.quote_housing_fasttrack(uuid) from public, anon;
grant execute on function public.quote_housing_fasttrack(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Transaction creation / webhook processing (service_role only)
-- ---------------------------------------------------------------------
create or replace function public.create_payment_transaction(
  p_user uuid, p_purpose text, p_purpose_ref uuid, p_product_code text, p_amount_cents integer, p_currency text,
  p_idempotency_key text, p_intent_id text, p_customer_id text, p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare tx_id uuid;
begin
  insert into public.payment_transactions (user_id, purpose, purpose_ref, product_code, amount_cents, currency, idempotency_key, provider_payment_intent_id, provider_customer_id, metadata)
  values (p_user, p_purpose, p_purpose_ref, p_product_code, p_amount_cents, coalesce(p_currency, 'usd'), p_idempotency_key, p_intent_id, p_customer_id, coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do update set updated_at = now()
  returning id into tx_id;
  return tx_id;
end;
$$;
revoke all on function public.create_payment_transaction(uuid, text, uuid, text, integer, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_payment_transaction(uuid, text, uuid, text, integer, text, text, text, text, jsonb) to service_role;

-- One entry point for verified Stripe events. Returns the outcome; a repeated event id is a no-op.
create or replace function public.apply_payment_event(
  p_event_id text,
  p_type text,
  p_intent_id text,
  p_amount_received integer,
  p_currency text,
  p_amount_refunded integer,
  p_refund_id text,
  p_failure_code text,
  p_failure_message text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
  tx public.payment_transactions%rowtype;
  outcome text := 'ignored';
begin
  insert into public.payment_events (provider_event_id, type, payload) values (p_event_id, p_type, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider_event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate'; end if;

  select * into tx from public.payment_transactions t where t.provider_payment_intent_id = p_intent_id for update;
  if not found then
    update public.payment_events set outcome = 'unknown_transaction', processed_at = now() where provider_event_id = p_event_id;
    return 'unknown_transaction';
  end if;

  if p_type = 'payment_intent.succeeded' then
    if p_amount_received is distinct from tx.amount_cents or lower(coalesce(p_currency, '')) <> tx.currency then
      -- never accept a payment whose amount/currency differs from what the server priced
      update public.payment_transactions set failure_code = 'amount_mismatch', failure_message = 'Received amount did not match the server price.', updated_at = now() where id = tx.id;
      outcome := 'amount_mismatch';
    elsif tx.status not in ('refunded', 'partially_refunded') then
      update public.payment_transactions set status = 'succeeded', succeeded_at = coalesce(succeeded_at, now()), failure_code = null, failure_message = null, updated_at = now() where id = tx.id;
      if tx.purpose = 'housing_fasttrack' then
        -- Payment settles the ORDER only. It never touches the application's status.
        update public.housing_fasttrack_orders set status = 'paid', provider = 'stripe', provider_payment_id = p_intent_id, updated_at = now()
         where application_id = tx.purpose_ref and status <> 'refunded';
      end if;
      perform public.create_notification(tx.user_id, 'payment', 'Payment received', 'Your payment was confirmed.', '/payments',
        'payment_succeeded:' || tx.id::text, 'payment_transaction', tx.id, jsonb_build_object('transaction_id', tx.id));
      outcome := 'succeeded';
    end if;
  elsif p_type = 'payment_intent.processing' then
    if tx.status in ('requires_payment_method', 'requires_action', 'failed') then
      update public.payment_transactions set status = 'processing', updated_at = now() where id = tx.id;
    end if;
    outcome := 'processing';
  elsif p_type = 'payment_intent.requires_action' then
    if tx.status in ('requires_payment_method', 'failed') then
      update public.payment_transactions set status = 'requires_action', updated_at = now() where id = tx.id;
    end if;
    outcome := 'requires_action';
  elsif p_type = 'payment_intent.payment_failed' then
    if tx.status <> 'succeeded' then
      update public.payment_transactions set status = 'failed', failure_code = p_failure_code, failure_message = left(p_failure_message, 300), updated_at = now() where id = tx.id;
    end if;
    outcome := 'failed';
  elsif p_type = 'payment_intent.canceled' then
    if tx.status <> 'succeeded' then
      update public.payment_transactions set status = 'canceled', updated_at = now() where id = tx.id;
    end if;
    outcome := 'canceled';
  elsif p_type = 'charge.refunded' then
    if p_refund_id is not null and p_amount_refunded is not null and p_amount_refunded > 0 then
      insert into public.payment_refunds (transaction_id, provider_refund_id, amount_cents, status)
      values (tx.id, p_refund_id, p_amount_refunded, 'succeeded')
      on conflict (provider_refund_id) do nothing;
    end if;
    if p_amount_refunded is not null and p_amount_refunded >= tx.amount_cents then
      update public.payment_transactions set status = 'refunded', updated_at = now() where id = tx.id;
      if tx.purpose = 'housing_fasttrack' then
        update public.housing_fasttrack_orders set status = 'refunded', updated_at = now() where application_id = tx.purpose_ref;
      end if;
    elsif p_amount_refunded is not null and p_amount_refunded > 0 then
      update public.payment_transactions set status = 'partially_refunded', updated_at = now() where id = tx.id;
    end if;
    outcome := 'refunded';
  end if;

  update public.payment_events set outcome = outcome, processed_at = now() where provider_event_id = p_event_id;
  return outcome;
end;
$$;
revoke all on function public.apply_payment_event(text, text, text, integer, text, integer, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, integer, text, integer, text, text, text, jsonb) to service_role;

-- Members may not change the order table directly; make that explicit for least privilege.
revoke insert, update, delete on table public.housing_fasttrack_orders from authenticated;
