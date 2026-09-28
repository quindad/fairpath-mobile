-- Coverage markets + Early Access waitlist (forward-only).
--
-- FairPath is going national before every ZIP has mature opportunity inventory. A member searching in a
-- ZIP with no coverage should never see the same "no results" UI as a member whose filters were just too
-- narrow. Those are different facts and need different UX:
--   NO RESULTS FOR THESE FILTERS        -- the search worked; nothing matched in an otherwise-covered market
--   FAIRPATH DOES NOT YET HAVE ENOUGH VERIFIED COVERAGE HERE  -- the market itself isn't ready
--
-- Coverage status is a SERVER fact, never client-guessed from an empty results array: coverage_markets rows
-- are admin/service-role controlled (status + thresholds), not derived by counting live inventory client-side.
-- get_market_coverage() is the one read path; join_early_access() is the one write path for a member.
--
-- The previously-discussed "60 days of FairPath+ for early-market members" benefit reuses the EXISTING
-- entitlement_grants architecture from 20260930100000_entitlements.sql rather than inventing a second one:
-- server-controlled, one grant per (market, user) via dedupe_key, auditable, cannot be self-awarded. It is
-- issued ONLY when activate_coverage_market() actually runs — never advertised as active before that.

-- ---------------------------------------------------------------------
-- Widen entitlement_grants to allow this new grant source (additive, forward-only)
-- ---------------------------------------------------------------------
alter table public.entitlement_grants drop constraint entitlement_grants_source_type_check;
alter table public.entitlement_grants add constraint entitlement_grants_source_type_check
  check (source_type in (
    'correctional_transition', 'institution_sponsor', 'nonprofit_sponsor', 'promo', 'partner', 'admin_grant',
    'support_exception', 'early_access_market'));

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.coverage_markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                         -- e.g. 'columbus-oh', stable slug, never reused for a different place
  label text not null,                                -- e.g. 'Columbus, OH area'
  zip_prefixes text[] not null default '{}',          -- ZIP prefixes (3-5 digits) this market covers; matched longest-prefix-wins
  status text not null default 'coming_soon' check (status in ('full', 'growing', 'limited', 'waitlist', 'coming_soon')),
  early_access_benefit_days integer,                  -- null = no benefit offered for this market's activation
  status_note text,                                   -- optional member-facing detail FairPath can override per market
  activated_at timestamptz,                            -- when status last moved to 'full'/'growing' (first activation only)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (zip_prefixes = '{}' or array_length(zip_prefixes, 1) > 0)
);
create index if not exists coverage_markets_status_idx on public.coverage_markets (status);

create table if not exists public.market_waitlist_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  market_id uuid references public.coverage_markets(id) on delete set null,  -- resolved at enroll time; may be null if unmatched
  notification_consent boolean not null default true,
  referral_source text,
  status text not null default 'waitlisted' check (status in ('waitlisted', 'notified', 'converted')),
  entitlement_grant_id uuid references public.entitlement_grants(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  notified_at timestamptz,
  converted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, zip)
);
create index if not exists market_waitlist_user_idx on public.market_waitlist_enrollments (user_id);
create index if not exists market_waitlist_market_idx on public.market_waitlist_enrollments (market_id) where status = 'waitlisted';

-- ---------------------------------------------------------------------
-- RLS / grants
-- ---------------------------------------------------------------------
alter table public.coverage_markets enable row level security;
alter table public.market_waitlist_enrollments enable row level security;

-- Guests never read this table directly: get_market_coverage() (SECURITY DEFINER) is the only guest-facing
-- read path, so anon needs function-execute only, not table-select. Signed-in members get direct select for
-- a future "browse markets" picker; RLS still applies to them, this policy is what makes it a public reference
-- table rather than member-scoped data.
drop policy if exists "coverage_markets_authenticated_read" on public.coverage_markets;
create policy "coverage_markets_authenticated_read" on public.coverage_markets for select to authenticated using (true);
grant select on table public.coverage_markets to authenticated;
grant select, insert, update, delete on table public.coverage_markets to service_role;
revoke all on table public.coverage_markets from anon;

drop policy if exists "market_waitlist_owner_read" on public.market_waitlist_enrollments;
create policy "market_waitlist_owner_read" on public.market_waitlist_enrollments for select to authenticated using (user_id = (select auth.uid()));
grant select on table public.market_waitlist_enrollments to authenticated;
grant select, insert, update, delete on table public.market_waitlist_enrollments to service_role;
revoke all on table public.market_waitlist_enrollments from anon;

-- ---------------------------------------------------------------------
-- Read: coverage for a ZIP. No key, no auth required (guests search before signing in).
-- ---------------------------------------------------------------------
create or replace function public.get_market_coverage(p_zip text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.coverage_markets%rowtype;
  best_len integer := -1;
  r record;
begin
  if p_zip is null or p_zip !~ '^[0-9]{5}$' then
    raise exception 'INVALID_ZIP' using errcode = 'P0001';
  end if;

  -- longest matching zip_prefix wins (e.g. '43081' beats '430' if both are configured)
  for r in select * from public.coverage_markets loop
    if exists (
      select 1 from unnest(r.zip_prefixes) as prefix
      where left(p_zip, length(prefix)) = prefix and length(prefix) > best_len
    ) then
      select max(length(prefix)) into best_len from unnest(r.zip_prefixes) as prefix where left(p_zip, length(prefix)) = prefix;
      m := r;
    end if;
  end loop;

  if m.id is null then
    -- no configured market at all for this ZIP: honest default, never silently "full"
    return jsonb_build_object('zip', p_zip, 'market_code', null, 'market_label', null, 'status', 'coming_soon',
      'status_note', null, 'early_access_benefit_days', null);
  end if;

  return jsonb_build_object('zip', p_zip, 'market_code', m.code, 'market_label', m.label, 'status', m.status,
    'status_note', m.status_note, 'early_access_benefit_days', m.early_access_benefit_days);
end;
$$;
revoke all on function public.get_market_coverage(text) from public;
grant execute on function public.get_market_coverage(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Write: a signed-in member joins Early Access for their ZIP. Idempotent (unique on user_id, zip).
-- ---------------------------------------------------------------------
create or replace function public.join_early_access(p_zip text, p_notification_consent boolean, p_referral_source text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  matched_market_id uuid;
  best_len integer := -1;
  r record;
  existing public.market_waitlist_enrollments%rowtype;
  new_id uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if p_zip is null or p_zip !~ '^[0-9]{5}$' then raise exception 'INVALID_ZIP' using errcode = 'P0001'; end if;

  select * into existing from public.market_waitlist_enrollments e where e.user_id = uid and e.zip = p_zip;
  if found then
    return jsonb_build_object('id', existing.id, 'status', existing.status, 'already_enrolled', true);
  end if;

  for r in select id, zip_prefixes from public.coverage_markets loop
    if exists (select 1 from unnest(r.zip_prefixes) as prefix where left(p_zip, length(prefix)) = prefix and length(prefix) > best_len) then
      select max(length(prefix)) into best_len from unnest(r.zip_prefixes) as prefix where left(p_zip, length(prefix)) = prefix;
      matched_market_id := r.id;
    end if;
  end loop;

  insert into public.market_waitlist_enrollments (user_id, zip, market_id, notification_consent, referral_source)
  values (uid, p_zip, matched_market_id, coalesce(p_notification_consent, true), p_referral_source)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'status', 'waitlisted', 'already_enrolled', false);
end;
$$;
revoke all on function public.join_early_access(text, boolean, text) from public, anon;
grant execute on function public.join_early_access(text, boolean, text) to authenticated;

-- The one client read of "am I enrolled, and where".
create or replace function public.my_early_access_enrollments()
returns setof public.market_waitlist_enrollments
language sql
stable
security definer
set search_path = public
as $$
  select * from public.market_waitlist_enrollments where user_id = auth.uid() order by enrolled_at desc;
$$;
revoke all on function public.my_early_access_enrollments() from public, anon;
grant execute on function public.my_early_access_enrollments() to authenticated;

-- ---------------------------------------------------------------------
-- Admin/service-role: activate a market. Idempotent — rerunning never duplicates a grant or a notification.
-- ---------------------------------------------------------------------
create or replace function public.activate_coverage_market(p_market_code text, p_new_status text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mkt public.coverage_markets%rowtype;
  enrollment record;
  granted_count integer := 0;
  notified_count integer := 0;
  grant_id uuid;
begin
  if p_new_status not in ('full', 'growing', 'limited') then raise exception 'INVALID_STATUS' using errcode = 'P0001'; end if;
  select * into mkt from public.coverage_markets where code = p_market_code;
  if not found then raise exception 'MARKET_NOT_FOUND' using errcode = 'P0001'; end if;

  update public.coverage_markets
     set status = p_new_status, activated_at = coalesce(activated_at, now()), updated_at = now()
   where id = mkt.id;

  for enrollment in
    select * from public.market_waitlist_enrollments e where e.market_id = mkt.id and e.status = 'waitlisted'
  loop
    grant_id := null;
    if mkt.early_access_benefit_days is not null then
      grant_id := public.issue_entitlement_grant(
        enrollment.user_id, 'early_access_market', mkt.code, 'eam:' || mkt.code || ':' || enrollment.user_id::text,
        mkt.early_access_benefit_days, null, 'Early Access benefit for ' || mkt.label || ' reaching coverage');
      granted_count := granted_count + 1;
    end if;

    update public.market_waitlist_enrollments
       set status = 'converted', converted_at = now(), entitlement_grant_id = grant_id, updated_at = now()
     where id = enrollment.id;

    if enrollment.notification_consent then
      if public.create_notification(
           enrollment.user_id, 'coverage', mkt.label || ' is now live on FairPath',
           case when mkt.early_access_benefit_days is not null
             then 'Opportunities are available in your area, and your ' || mkt.early_access_benefit_days || '-day FairPath+ Early Access benefit is active.'
             else 'Opportunities are now available in your area.' end,
           '/find-jobs', 'market_activated:' || mkt.code || ':' || enrollment.user_id::text, 'coverage_market', mkt.id,
           jsonb_build_object('market_code', mkt.code)) is not null then
        notified_count := notified_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('market_code', mkt.code, 'status', p_new_status, 'grants_issued', granted_count, 'members_notified', notified_count);
end;
$$;
revoke all on function public.activate_coverage_market(text, text, text) from public, anon, authenticated;
grant execute on function public.activate_coverage_market(text, text, text) to service_role;

create or replace function public.upsert_coverage_market(
  p_code text, p_label text, p_zip_prefixes text[], p_status text, p_early_access_benefit_days integer, p_status_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  insert into public.coverage_markets (code, label, zip_prefixes, status, early_access_benefit_days, status_note)
  values (p_code, p_label, coalesce(p_zip_prefixes, '{}'), coalesce(p_status, 'coming_soon'), p_early_access_benefit_days, p_status_note)
  on conflict (code) do update set
    label = excluded.label, zip_prefixes = excluded.zip_prefixes, status_note = excluded.status_note,
    early_access_benefit_days = excluded.early_access_benefit_days, updated_at = now()
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.upsert_coverage_market(text, text, text[], text, integer, text) from public, anon, authenticated;
grant execute on function public.upsert_coverage_market(text, text, text[], text, integer, text) to service_role;
