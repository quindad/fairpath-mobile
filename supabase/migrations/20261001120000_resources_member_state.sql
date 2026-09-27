-- Resources member state (forward-only). Migration 3 of the Profile + Resources pass.
--
--   * saved_resources        : a member's bookmarks
--   * resource_interactions  : SELF-REPORTED progress ("I started this" / "I finished this"), never an achievement
--   * resource_reports       : "this is wrong / closed / unsafe" reports that feed the Admin freshness queue
--
-- Security model
--   * Base tables are owner-readable only; clients get NO insert/update/delete. Every write goes through a
--     security-definer function that requires a signed-in member and checks the resource is currently visible
--     (published + verified + not expired). Guests keep read access to search/detail only.
--   * Progress is labelled self-reported everywhere: it never feeds achievements or Admin verification.
--   * Reports are rate-limited and de-duplicated, and append a 'reported' row to resource_verification_events so
--     Admin can see them next to the verification history. Report text is never returned to other members.

-- ---------------------------------------------------------------------
-- Fix (found while designing member reports): resource_verification_events.actor_id is ON DELETE SET NULL, which is an
-- UPDATE, and the append-only trigger from migration 1 blocked it. Deleting a member who had ever appeared in the
-- history (a report now, an Admin verifier later) would therefore fail. The trigger now permits exactly one kind of
-- change: anonymizing actor_id to NULL. Every other update is still rejected.
-- ---------------------------------------------------------------------
create or replace function public.resource_verification_events_block_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_id is not null and new.actor_id is null
     and new.id = old.id and new.resource_id = old.resource_id and new.event_type = old.event_type
     and new.source_checked_url is not distinct from old.source_checked_url
     and new.notes is not distinct from old.notes
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'resource_verification_events is append-only (rows cannot be changed)';
end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.saved_resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);
create index if not exists saved_resources_user_idx on public.saved_resources (user_id, created_at desc);

create table if not exists public.resource_interactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  state text not null check (state in ('started', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id),
  check ((state = 'completed') = (completed_at is not null))
);
comment on table public.resource_interactions is
  'Self-reported member progress on a resource. Not verified, not an achievement source.';
create index if not exists resource_interactions_user_idx on public.resource_interactions (user_id, updated_at desc);

create table if not exists public.resource_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  reason text not null check (reason in ('wrong_info', 'closed', 'unsafe', 'scam_or_fee', 'other')),
  note text check (note is null or length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);
create unique index if not exists resource_reports_open_unique
  on public.resource_reports (user_id, resource_id, reason) where status = 'open';
create index if not exists resource_reports_queue_idx on public.resource_reports (status, created_at desc);
create index if not exists resource_reports_user_idx on public.resource_reports (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS + grants (read own only; all writes through functions)
-- ---------------------------------------------------------------------
alter table public.saved_resources enable row level security;
alter table public.resource_interactions enable row level security;
alter table public.resource_reports enable row level security;

drop policy if exists "saved_resources_read_own" on public.saved_resources;
create policy "saved_resources_read_own" on public.saved_resources
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "resource_interactions_read_own" on public.resource_interactions;
create policy "resource_interactions_read_own" on public.resource_interactions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "resource_reports_read_own" on public.resource_reports;
create policy "resource_reports_read_own" on public.resource_reports
  for select to authenticated using (user_id = (select auth.uid()));

grant select on table public.saved_resources to authenticated;
grant select on table public.resource_interactions to authenticated;
grant select (id, user_id, resource_id, reason, status, created_at) on table public.resource_reports to authenticated;

grant select, insert, update, delete on table public.saved_resources to service_role;
grant select, insert, update, delete on table public.resource_interactions to service_role;
grant select, insert, update, delete on table public.resource_reports to service_role;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.resource_is_visible(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.resources r
    join public.resource_organizations o on o.id = r.organization_id and o.status = 'active'
    where r.id = p_id
      and r.publish_status = 'published'
      and r.verification_state = 'verified'
      and public.resource_freshness(r.last_verified_at, r.verify_by) in ('fresh', 'stale')
  );
$$;
revoke all on function public.resource_is_visible(uuid) from public;
grant execute on function public.resource_is_visible(uuid) to service_role;

-- Summary card shape shared with search_resources (no distance). Internal: only called from the functions below.
create or replace function public.resource_summary_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'summary', r.summary,
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'org_type', o.org_type),
    'resource_kind', r.resource_kind,
    'delivery_mode', r.delivery_mode,
    'is_national', r.is_national,
    'cost_type', r.cost_type,
    'cost_notes', r.cost_notes,
    'urgency_tier', r.urgency_tier,
    'eligibility_summary', r.eligibility_summary,
    'official_source_url', r.official_source_url,
    'source_authority', r.source_authority,
    'last_verified_at', r.last_verified_at,
    'verify_by', r.verify_by,
    'freshness', public.resource_freshness(r.last_verified_at, r.verify_by),
    'accessibility', r.accessibility,
    'languages', r.languages,
    'categories', (select coalesce(jsonb_agg(l.category_slug order by l.is_primary desc, l.category_slug), '[]'::jsonb)
                   from public.resource_category_links l where l.resource_id = r.id),
    'nearest_location', (
      select jsonb_build_object('id', loc.id, 'city', loc.city, 'state_code', loc.state_code, 'postal_code', loc.postal_code,
                                'address_line', loc.address_line, 'phone', loc.phone,
                                'open_now', public.resource_location_open_now(loc.id))
      from public.resource_locations loc where loc.resource_id = r.id and not loc.is_virtual
      order by loc.label, loc.id limit 1),
    'data_origin', r.data_origin
  )
  from public.resources r
  join public.resource_organizations o on o.id = r.organization_id
  where r.id = p_id;
$$;
revoke all on function public.resource_summary_json(uuid) from public;
grant execute on function public.resource_summary_json(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Member functions (signed-in only)
-- ---------------------------------------------------------------------
create or replace function public.save_resource(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  saved_count integer;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if not public.resource_is_visible(p_id) then raise exception 'RESOURCE_UNAVAILABLE'; end if;
  select count(*) into saved_count from public.saved_resources s where s.user_id = uid;
  if saved_count >= 500 then raise exception 'SAVED_LIMIT'; end if;
  insert into public.saved_resources (user_id, resource_id) values (uid, p_id) on conflict do nothing;
end;
$$;

create or replace function public.unsave_resource(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  delete from public.saved_resources s where s.user_id = uid and s.resource_id = p_id;
end;
$$;

-- p_state: 'started' | 'completed' | 'cleared'. Clearing is always allowed (even if the resource is no longer visible).
create or replace function public.set_resource_progress(p_id uuid, p_state text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_state not in ('started', 'completed', 'cleared') then raise exception 'INVALID_STATE'; end if;

  if p_state = 'cleared' then
    delete from public.resource_interactions ri where ri.user_id = uid and ri.resource_id = p_id;
    return null;
  end if;

  if not public.resource_is_visible(p_id) then raise exception 'RESOURCE_UNAVAILABLE'; end if;

  insert into public.resource_interactions as ri (user_id, resource_id, state, started_at, completed_at, updated_at)
  values (uid, p_id, p_state, now(), case when p_state = 'completed' then now() end, now())
  on conflict (user_id, resource_id) do update
    set state = excluded.state,
        completed_at = case when excluded.state = 'completed' then coalesce(ri.completed_at, now()) else null end,
        updated_at = now();
  return p_state;
end;
$$;

create or replace function public.report_resource(p_id uuid, p_reason text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  recent integer;
  clean_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_reason not in ('wrong_info', 'closed', 'unsafe', 'scam_or_fee', 'other') then raise exception 'INVALID_REASON'; end if;
  if not public.resource_is_visible(p_id) then raise exception 'RESOURCE_UNAVAILABLE'; end if;

  select count(*) into recent from public.resource_reports rr
    where rr.user_id = uid and rr.created_at > now() - interval '24 hours';
  if recent >= 10 then raise exception 'REPORT_RATE_LIMIT'; end if;

  -- Same member, same resource, same reason, still open: quietly accept without duplicating.
  if exists (select 1 from public.resource_reports rr
             where rr.user_id = uid and rr.resource_id = p_id and rr.reason = p_reason and rr.status = 'open') then
    return;
  end if;

  insert into public.resource_reports (user_id, resource_id, reason, note) values (uid, p_id, p_reason, clean_note);
  insert into public.resource_verification_events (resource_id, event_type, actor_id, notes)
    values (p_id, 'reported', uid, 'Member report: ' || p_reason);
end;
$$;

-- Saved / progress flags for a batch of resources (used to mark search results and the detail page).
create or replace function public.my_resource_states(p_ids uuid[])
returns table (resource_id uuid, is_saved boolean, progress text)
language sql
stable
security definer
set search_path = public
as $$
  select i.id,
         exists (select 1 from public.saved_resources s where s.user_id = auth.uid() and s.resource_id = i.id),
         (select ri.state from public.resource_interactions ri where ri.user_id = auth.uid() and ri.resource_id = i.id)
  from unnest(coalesce(p_ids, '{}'::uuid[])) as i(id)
  where auth.uid() is not null;
$$;

-- The member's saved list. Records that are no longer visible come back as { id } with available = false,
-- so the member can remove them without FairPath revealing details of an unverified or removed record.
create or replace function public.list_my_saved_resources(p_limit integer default 50, p_offset integer default 0)
returns table (resource_row jsonb, saved_at timestamptz, available boolean, total_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when public.resource_is_visible(s.resource_id) then public.resource_summary_json(s.resource_id)
         else jsonb_build_object('id', s.resource_id) end,
    s.created_at,
    public.resource_is_visible(s.resource_id),
    count(*) over ()
  from public.saved_resources s
  where s.user_id = auth.uid()
  order by s.created_at desc, s.resource_id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Resources the member marked started/completed (same availability rule as the saved list).
create or replace function public.list_my_resource_progress(p_state text default null, p_limit integer default 50, p_offset integer default 0)
returns table (resource_row jsonb, progress text, updated_at timestamptz, available boolean, total_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when public.resource_is_visible(ri.resource_id) then public.resource_summary_json(ri.resource_id)
         else jsonb_build_object('id', ri.resource_id) end,
    ri.state,
    ri.updated_at,
    public.resource_is_visible(ri.resource_id),
    count(*) over ()
  from public.resource_interactions ri
  where ri.user_id = auth.uid() and (p_state is null or ri.state = p_state)
  order by ri.updated_at desc, ri.resource_id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.my_resource_counts()
returns table (saved_count bigint, started_count bigint, completed_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.saved_resources s where s.user_id = auth.uid()),
    (select count(*) from public.resource_interactions ri where ri.user_id = auth.uid() and ri.state = 'started'),
    (select count(*) from public.resource_interactions ri where ri.user_id = auth.uid() and ri.state = 'completed')
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------
-- Execute grants: signed-in members only (never anon).
-- ---------------------------------------------------------------------
revoke all on function public.save_resource(uuid) from public;
revoke all on function public.unsave_resource(uuid) from public;
revoke all on function public.set_resource_progress(uuid, text) from public;
revoke all on function public.report_resource(uuid, text, text) from public;
revoke all on function public.my_resource_states(uuid[]) from public;
revoke all on function public.list_my_saved_resources(integer, integer) from public;
revoke all on function public.list_my_resource_progress(text, integer, integer) from public;
revoke all on function public.my_resource_counts() from public;

grant execute on function public.save_resource(uuid) to authenticated, service_role;
grant execute on function public.unsave_resource(uuid) to authenticated, service_role;
grant execute on function public.set_resource_progress(uuid, text) to authenticated, service_role;
grant execute on function public.report_resource(uuid, text, text) to authenticated, service_role;
grant execute on function public.my_resource_states(uuid[]) to authenticated, service_role;
grant execute on function public.list_my_saved_resources(integer, integer) to authenticated, service_role;
grant execute on function public.list_my_resource_progress(text, integer, integer) to authenticated, service_role;
grant execute on function public.my_resource_counts() to authenticated, service_role;
