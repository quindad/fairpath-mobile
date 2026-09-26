-- FairPath+ entitlement architecture (forward-only).
--
-- FairPath+ is NOT a boolean. A member has FairPath+ when the SERVER finds at least one currently-valid
-- source:
--   * an entitlement grant (correctional transition, institution/nonprofit sponsor, promo, partner,
--     admin grant, support exception) that is active and inside [starts_at, expires_at), or
--   * a paid store subscription recorded by trusted billing code (billing_subscriptions), or
--   * the legacy fairpath_subscriptions row (kept so existing server checks keep working).
-- Expiry is evaluated at read time (expires_at > now()); nothing has to run for access to end, and an
-- expiry never touches the account, profile, applications, saved items or any other free-tier data.
--
-- Clients can read their own grants/subscriptions and call my_fairpath_plus_status(). They cannot create,
-- extend or revoke anything: every write is a service_role-only function that also writes entitlement_audit_log.
--
-- Correctional transition (business rule): a VERIFIED migration relationship from an approved Corrections
-- deployment yields 90 days of FairPath+ with no payment method, no checkout, no auto-renewal and no
-- charge at expiry. Eligibility is proven by corrections_migration_events written by trusted server code,
-- never by a client flag and never inferred from conviction/profile data. One verified identity can be
-- claimed once, and one account can hold one correctional grant.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement text not null default 'fairpath_plus' check (entitlement in ('fairpath_plus')),
  source_type text not null check (source_type in (
    'correctional_transition', 'institution_sponsor', 'nonprofit_sponsor', 'promo', 'partner', 'admin_grant', 'support_exception')),
  source_ref text,
  dedupe_key text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create unique index if not exists entitlement_grants_dedupe_idx
  on public.entitlement_grants (source_type, dedupe_key) where dedupe_key is not null;
create unique index if not exists entitlement_grants_one_correctional_per_user
  on public.entitlement_grants (user_id) where source_type = 'correctional_transition';
create index if not exists entitlement_grants_user_idx on public.entitlement_grants (user_id, expires_at desc);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google', 'stripe', 'manual')),
  external_subscription_id text not null,
  product_id text not null,
  status text not null check (status in ('active', 'in_grace', 'on_hold', 'canceled', 'expired', 'refunded')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  auto_renew boolean not null default false,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_subscription_id)
);
create index if not exists billing_subscriptions_user_idx on public.billing_subscriptions (user_id);

create table if not exists public.corrections_migration_events (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null unique,      -- opaque, one-way key of the verified Corrections identity (never a name/DOC number)
  deployment text not null,               -- approved Corrections/tablet deployment
  verified_at timestamptz not null,
  verified_by text not null,              -- integration / reviewer that verified the relationship
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  grant_id uuid references public.entitlement_grants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlement_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor text not null,                    -- 'system', an admin user id, or an integration name
  action text not null check (action in ('grant_issued', 'grant_revoked', 'grant_extended', 'subscription_event', 'correctional_claim', 'correctional_claim_duplicate')),
  grant_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists entitlement_audit_log_user_idx on public.entitlement_audit_log (user_id, created_at desc);

-- append-only: no updates or deletes, even for privileged roles going through normal paths
create or replace function public.entitlement_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'entitlement_audit_log is append-only';
end;
$$;
drop trigger if exists entitlement_audit_log_no_change on public.entitlement_audit_log;
create trigger entitlement_audit_log_no_change
  before update or delete on public.entitlement_audit_log
  for each row execute function public.entitlement_audit_log_immutable();

-- ---------------------------------------------------------------------
-- RLS / grants: owners read; nobody but the server writes
-- ---------------------------------------------------------------------
alter table public.entitlement_grants enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.corrections_migration_events enable row level security;
alter table public.entitlement_audit_log enable row level security;

drop policy if exists "entitlement_grants_owner_read" on public.entitlement_grants;
create policy "entitlement_grants_owner_read" on public.entitlement_grants for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "billing_subscriptions_owner_read" on public.billing_subscriptions;
create policy "billing_subscriptions_owner_read" on public.billing_subscriptions for select to authenticated using (user_id = (select auth.uid()));

grant select on table public.entitlement_grants to authenticated;
grant select on table public.billing_subscriptions to authenticated;
grant select, insert, update, delete on table public.entitlement_grants to service_role;
grant select, insert, update, delete on table public.billing_subscriptions to service_role;
grant select, insert, update, delete on table public.corrections_migration_events to service_role;
grant select, insert on table public.entitlement_audit_log to service_role;

-- The legacy table stays as the compatibility mirror the existing Marketplace/FastTrack server checks read.
revoke all on table public.fairpath_subscriptions from anon;
revoke insert, update, delete on table public.fairpath_subscriptions from authenticated;

-- ---------------------------------------------------------------------
-- Server-side evaluation
-- ---------------------------------------------------------------------
create or replace function public.fairpath_plus_status(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sub public.billing_subscriptions%rowtype;
  g public.entitlement_grants%rowtype;
  last_g public.entitlement_grants%rowtype;
  legacy public.fairpath_subscriptions%rowtype;
  result jsonb;
begin
  if p_user is null then
    return jsonb_build_object('active', false, 'source', null);
  end if;

  -- 1. paid store/provider subscription
  select * into sub from public.billing_subscriptions b
   where b.user_id = p_user and b.status in ('active', 'in_grace')
     and (b.current_period_end is null or b.current_period_end > now())
   order by b.current_period_end desc nulls first limit 1;
  if found then
    return jsonb_build_object(
      'active', true, 'source', 'paid_subscription', 'complimentary', false, 'provider', sub.provider,
      'starts_at', sub.current_period_start, 'expires_at', sub.current_period_end,
      'days_remaining', case when sub.current_period_end is null then null else greatest(0, ceil(extract(epoch from (sub.current_period_end - now())) / 86400))::int end,
      'will_renew', sub.auto_renew, 'status', sub.status);
  end if;

  -- 2. sponsored / promotional / correctional grant (latest expiry wins)
  select * into g from public.entitlement_grants e
   where e.user_id = p_user and e.entitlement = 'fairpath_plus' and e.status = 'active'
     and e.starts_at <= now() and e.expires_at > now()
   order by e.expires_at desc limit 1;
  if found then
    return jsonb_build_object(
      'active', true, 'source', g.source_type, 'complimentary', true, 'provider', null,
      'starts_at', g.starts_at, 'expires_at', g.expires_at,
      'days_remaining', greatest(0, ceil(extract(epoch from (g.expires_at - now())) / 86400))::int,
      'will_renew', false, 'status', 'active');
  end if;

  -- 3. legacy row
  select * into legacy from public.fairpath_subscriptions s
   where s.user_id = p_user and s.plan = 'fairpath_plus' and s.status = 'active'
     and (s.current_period_end is null or s.current_period_end > now());
  if found then
    return jsonb_build_object(
      'active', true, 'source', 'paid_subscription', 'complimentary', false, 'provider', 'legacy',
      'starts_at', legacy.created_at, 'expires_at', legacy.current_period_end,
      'days_remaining', case when legacy.current_period_end is null then null else greatest(0, ceil(extract(epoch from (legacy.current_period_end - now())) / 86400))::int end,
      'will_renew', null, 'status', 'active');
  end if;

  -- not active: tell the client what ended so it can show the renewal flow (never deletes anything)
  select * into last_g from public.entitlement_grants e
   where e.user_id = p_user and e.entitlement = 'fairpath_plus' and e.status = 'active' and e.expires_at <= now()
   order by e.expires_at desc limit 1;
  result := jsonb_build_object('active', false, 'source', null, 'complimentary', false);
  if last_g.id is not null then
    result := result || jsonb_build_object('expired_source', last_g.source_type, 'expired_at', last_g.expires_at);
  end if;
  return result;
end;
$$;
revoke all on function public.fairpath_plus_status(uuid) from public, anon, authenticated;
grant execute on function public.fairpath_plus_status(uuid) to service_role;

create or replace function public.has_fairpath_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.fairpath_plus_status(p_user) ->> 'active')::boolean, false);
$$;
revoke all on function public.has_fairpath_plus(uuid) from public, anon, authenticated;
grant execute on function public.has_fairpath_plus(uuid) to service_role;

-- The ONLY client entry point. Always about the caller.
create or replace function public.my_fairpath_plus_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  return public.fairpath_plus_status(auth.uid());
end;
$$;
revoke all on function public.my_fairpath_plus_status() from public, anon;
grant execute on function public.my_fairpath_plus_status() to authenticated, service_role;

-- Keeps the legacy mirror (read by marketplace_claim_quota, request_marketplace_claim, FastTrack quote) truthful.
-- current_period_end is the latest end among valid sources, so it also expires on its own.
create or replace function public.sync_legacy_fairpath_plus(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest timestamptz;
begin
  select max(x.ends) into latest from (
    select e.expires_at as ends from public.entitlement_grants e
      where e.user_id = p_user and e.entitlement = 'fairpath_plus' and e.status = 'active' and e.starts_at <= now() and e.expires_at > now()
    union all
    select coalesce(b.current_period_end, now() + interval '100 years') from public.billing_subscriptions b
      where b.user_id = p_user and b.status in ('active', 'in_grace') and (b.current_period_end is null or b.current_period_end > now())
  ) x;

  if latest is not null then
    insert into public.fairpath_subscriptions (user_id, plan, status, current_period_end, updated_at)
    values (p_user, 'fairpath_plus', 'active', latest, now())
    on conflict (user_id) do update set status = 'active', current_period_end = excluded.current_period_end, updated_at = now();
  else
    update public.fairpath_subscriptions set status = 'expired', updated_at = now() where user_id = p_user and status = 'active';
  end if;
end;
$$;
revoke all on function public.sync_legacy_fairpath_plus(uuid) from public, anon, authenticated;
grant execute on function public.sync_legacy_fairpath_plus(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Issuance (service_role only, idempotent, audited)
-- ---------------------------------------------------------------------
create or replace function public.issue_entitlement_grant(
  p_user uuid,
  p_source_type text,
  p_source_ref text,
  p_dedupe_key text,
  p_days integer,
  p_granted_by uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'INVALID_DURATION' using errcode = 'P0001'; end if;

  if p_dedupe_key is not null then
    select e.id into existing_id from public.entitlement_grants e where e.source_type = p_source_type and e.dedupe_key = p_dedupe_key;
    if existing_id is not null then return existing_id; end if;
  end if;

  insert into public.entitlement_grants (user_id, source_type, source_ref, dedupe_key, starts_at, expires_at, granted_by, reason)
  values (p_user, p_source_type, p_source_ref, p_dedupe_key, now(), now() + make_interval(days => p_days), p_granted_by, p_reason)
  returning id into new_id;

  insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details)
  values (p_user, coalesce(p_granted_by::text, 'system'), 'grant_issued', new_id,
          jsonb_build_object('source_type', p_source_type, 'source_ref', p_source_ref, 'days', p_days, 'reason', p_reason));

  perform public.sync_legacy_fairpath_plus(p_user);
  perform public.create_notification(
    p_user, 'account', 'FairPath+ is active',
    'You have FairPath+ for ' || p_days || ' days. No payment is needed.',
    '/plus', 'entitlement_granted:' || new_id::text, 'entitlement_grant', new_id, jsonb_build_object('grant_id', new_id));
  return new_id;
end;
$$;
revoke all on function public.issue_entitlement_grant(uuid, text, text, text, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_entitlement_grant(uuid, text, text, text, integer, uuid, text) to service_role;

-- Correctional transition: 90 days, once per verified identity and once per account. No payment of any kind.
create or replace function public.claim_correctional_transition(
  p_user uuid,
  p_identity_key text,
  p_deployment text,
  p_verified_at timestamptz,
  p_verified_by text
)
returns table (result text, grant_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  event_id uuid;
  ev public.corrections_migration_events%rowtype;
  new_grant uuid;
  ends timestamptz;
begin
  if p_user is null or coalesce(btrim(p_identity_key), '') = '' or coalesce(btrim(p_deployment), '') = '' or p_verified_at is null or coalesce(btrim(p_verified_by), '') = '' then
    raise exception 'INVALID_CLAIM' using errcode = 'P0001';
  end if;

  -- one correctional grant per account: checked BEFORE the identity is consumed
  if exists (select 1 from public.entitlement_grants g where g.user_id = p_user and g.source_type = 'correctional_transition') then
    insert into public.entitlement_audit_log (user_id, actor, action, details)
    values (p_user, p_verified_by, 'correctional_claim_duplicate', jsonb_build_object('reason', 'account_already_has_correctional_grant'));
    return query select 'account_already_has_benefit'::text, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.corrections_migration_events (identity_key, deployment, verified_at, verified_by)
  values (p_identity_key, p_deployment, p_verified_at, p_verified_by)
  on conflict (identity_key) do nothing
  returning id into event_id;

  select * into ev from public.corrections_migration_events c where c.identity_key = p_identity_key;

  if event_id is null then
    -- this verified identity was already processed: never mint a second benefit
    insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details)
    values (p_user, p_verified_by, 'correctional_claim_duplicate', ev.grant_id, jsonb_build_object('event_id', ev.id, 'deployment', p_deployment));
    select e.expires_at into ends from public.entitlement_grants e where e.id = ev.grant_id;
    return query select 'already_claimed'::text, ev.grant_id, ends;
    return;
  end if;

  new_grant := public.issue_entitlement_grant(
    p_user, 'correctional_transition', event_id::text, 'corr:' || p_identity_key, 90, null,
    'Verified correctional-tablet migration from ' || p_deployment);

  update public.corrections_migration_events c
     set claimed_by_user_id = p_user, claimed_at = now(), grant_id = new_grant
   where c.id = event_id;

  insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details)
  values (p_user, p_verified_by, 'correctional_claim', new_grant, jsonb_build_object('event_id', event_id, 'deployment', p_deployment));

  select e.expires_at into ends from public.entitlement_grants e where e.id = new_grant;
  return query select 'granted'::text, new_grant, ends;
end;
$$;
revoke all on function public.claim_correctional_transition(uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_correctional_transition(uuid, text, text, timestamptz, text) to service_role;

-- Audited support tools (future Admin). Reason is mandatory.
create or replace function public.revoke_entitlement_grant(p_grant_id uuid, p_actor text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  if coalesce(btrim(p_reason), '') = '' or coalesce(btrim(p_actor), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  update public.entitlement_grants g set status = 'revoked', updated_at = now() where g.id = p_grant_id returning g.user_id into uid;
  if uid is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details) values (uid, p_actor, 'grant_revoked', p_grant_id, jsonb_build_object('reason', p_reason));
  perform public.sync_legacy_fairpath_plus(uid);
end;
$$;
revoke all on function public.revoke_entitlement_grant(uuid, text, text) from public, anon, authenticated;
grant execute on function public.revoke_entitlement_grant(uuid, text, text) to service_role;

create or replace function public.extend_entitlement_grant(p_grant_id uuid, p_extra_days integer, p_actor text, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid; ends timestamptz;
begin
  if coalesce(btrim(p_reason), '') = '' or coalesce(btrim(p_actor), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  if p_extra_days is null or p_extra_days < 1 or p_extra_days > 365 then raise exception 'INVALID_DURATION' using errcode = 'P0001'; end if;
  update public.entitlement_grants g set expires_at = g.expires_at + make_interval(days => p_extra_days), updated_at = now()
   where g.id = p_grant_id and g.status = 'active' returning g.user_id, g.expires_at into uid, ends;
  if uid is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details)
  values (uid, p_actor, 'grant_extended', p_grant_id, jsonb_build_object('extra_days', p_extra_days, 'reason', p_reason, 'new_expires_at', ends));
  perform public.sync_legacy_fairpath_plus(uid);
  return ends;
end;
$$;
revoke all on function public.extend_entitlement_grant(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.extend_entitlement_grant(uuid, integer, text, text) to service_role;

-- Provider-neutral subscription state, called only by verified store/provider server notifications.
create or replace function public.apply_subscription_event(
  p_user uuid, p_provider text, p_external_id text, p_product_id text, p_status text,
  p_period_start timestamptz, p_period_end timestamptz, p_auto_renew boolean, p_environment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_subscriptions (user_id, provider, external_subscription_id, product_id, status, current_period_start, current_period_end, auto_renew, environment, last_event_at, updated_at)
  values (p_user, p_provider, p_external_id, p_product_id, p_status, p_period_start, p_period_end, coalesce(p_auto_renew, false), coalesce(p_environment, 'production'), now(), now())
  on conflict (provider, external_subscription_id) do update
    set status = excluded.status, product_id = excluded.product_id, current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end, auto_renew = excluded.auto_renew, environment = excluded.environment,
        last_event_at = now(), updated_at = now()
    where public.billing_subscriptions.user_id = excluded.user_id;
  insert into public.entitlement_audit_log (user_id, actor, action, details)
  values (p_user, p_provider, 'subscription_event', jsonb_build_object('external_id', p_external_id, 'status', p_status, 'period_end', p_period_end));
  perform public.sync_legacy_fairpath_plus(p_user);
end;
$$;
revoke all on function public.apply_subscription_event(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text) to service_role;

-- ---------------------------------------------------------------------
-- Reminders (idempotent). Never charges; only notifies.
-- ---------------------------------------------------------------------
create or replace function public.send_entitlement_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  threshold integer;
  sent integer := 0;
  left_days integer;
begin
  for r in
    select g.id, g.user_id, g.expires_at from public.entitlement_grants g
     where g.status = 'active' and g.entitlement = 'fairpath_plus' and g.starts_at <= now()
       and g.expires_at > now() and g.expires_at <= now() + interval '14 days'
  loop
    left_days := greatest(0, ceil(extract(epoch from (r.expires_at - now())) / 86400))::int;
    foreach threshold in array array[14, 7, 1] loop
      if left_days <= threshold then
        if public.create_notification(
             r.user_id, 'account', 'Your FairPath+ access ends soon',
             'Your complimentary FairPath+ access ends in ' || left_days || ' day' || case when left_days = 1 then '' else 's' end ||
             '. Nothing will be charged. You can choose to subscribe if you want to keep it.',
             '/plus', 'entitlement_expiring:' || r.id::text || ':' || threshold, 'entitlement_grant', r.id,
             jsonb_build_object('grant_id', r.id, 'days_left', left_days)) is not null then
          sent := sent + 1;
        end if;
      end if;
    end loop;
  end loop;

  for r in
    select g.id, g.user_id, g.expires_at from public.entitlement_grants g
     where g.status = 'active' and g.entitlement = 'fairpath_plus' and g.expires_at <= now() and g.expires_at > now() - interval '7 days'
  loop
    if public.create_notification(
         r.user_id, 'account', 'Your FairPath+ access has ended',
         'Your account, profile, applications and saved items are unchanged. You can subscribe to FairPath+ any time.',
         '/plus', 'entitlement_expired:' || r.id::text, 'entitlement_grant', r.id, jsonb_build_object('grant_id', r.id)) is not null then
      sent := sent + 1;
    end if;
    perform public.sync_legacy_fairpath_plus(r.user_id);
  end loop;
  return sent;
end;
$$;
revoke all on function public.send_entitlement_reminders() from public, anon, authenticated;
grant execute on function public.send_entitlement_reminders() to service_role;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fairpath-entitlement-reminders', '17 * * * *', 'select public.send_entitlement_reminders()');
  end if;
end;
$cron$;
