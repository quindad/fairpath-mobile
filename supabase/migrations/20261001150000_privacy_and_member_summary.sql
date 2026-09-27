-- Privacy controls + server-derived member summary (forward-only). Migration 6.
--
--   * account_deletion_requests: a member can request, see and cancel a deletion request. A request is NOT a deletion:
--     destructive processing is a separate, service-only step and is not implemented here. The app never says the
--     account was deleted because a request exists; it shows the request's real status.
--   * get_member_home_summary(): every number on the member's home/profile, computed from authoritative tables for
--     auth.uid(). Nothing client-computed, nothing invented. Later modules plug in via member_summary_<module>(uuid).
--
-- Privacy principles encoded elsewhere and restated in the UI: employers and landlords never receive live profile data,
-- documents are private to the member, and sharing is always an explicit member action.

-- ---------------------------------------------------------------------
-- Account deletion requests
-- ---------------------------------------------------------------------
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'cancelled', 'processing', 'completed', 'failed')),
  reason_code text check (reason_code is null or reason_code in ('no_longer_needed', 'privacy', 'duplicate_account', 'other')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '14 days'),
  cancelled_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  failure_note text,
  updated_at timestamptz not null default now(),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create unique index if not exists account_deletion_one_active_idx
  on public.account_deletion_requests (user_id) where status in ('requested', 'processing');
create index if not exists account_deletion_due_idx on public.account_deletion_requests (scheduled_for) where status = 'requested';

alter table public.account_deletion_requests enable row level security;
drop policy if exists "account_deletion_read_own" on public.account_deletion_requests;
create policy "account_deletion_read_own" on public.account_deletion_requests
  for select to authenticated using (user_id = (select auth.uid()));
-- Members read their own row but never the internal failure note.
grant select (id, user_id, status, reason_code, requested_at, scheduled_for, cancelled_at, processing_started_at, completed_at) on table public.account_deletion_requests to authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

create or replace function public.request_account_deletion(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.account_deletion_requests%rowtype;
  created public.account_deletion_requests%rowtype;
  reason text := case when p_reason in ('no_longer_needed', 'privacy', 'duplicate_account', 'other') then p_reason else null end;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into existing from public.account_deletion_requests r where r.user_id = uid and r.status in ('requested', 'processing');
  if found then
    return jsonb_build_object('id', existing.id, 'status', existing.status, 'requested_at', existing.requested_at, 'scheduled_for', existing.scheduled_for);
  end if;
  insert into public.account_deletion_requests (user_id, reason_code) values (uid, reason) returning * into created;
  insert into public.consent_events (user_id, event_type, granted, metadata) values (uid, 'data_deletion_requested', true, jsonb_build_object('request_id', created.id));
  return jsonb_build_object('id', created.id, 'status', created.status, 'requested_at', created.requested_at, 'scheduled_for', created.scheduled_for);
end;
$$;

-- Cancellation is only possible while the request is still 'requested' (before processing starts).
create or replace function public.cancel_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.account_deletion_requests%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into r from public.account_deletion_requests x where x.user_id = uid and x.status = 'requested';
  if not found then raise exception 'NOT_CANCELLABLE'; end if;
  update public.account_deletion_requests x set status = 'cancelled', cancelled_at = now(), updated_at = now() where x.id = r.id;
  insert into public.consent_events (user_id, event_type, granted, metadata) values (uid, 'data_deletion_requested', false, jsonb_build_object('request_id', r.id, 'cancelled', true));
  return jsonb_build_object('id', r.id, 'status', 'cancelled');
end;
$$;

create or replace function public.get_account_deletion_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when r.id is null then null else jsonb_build_object(
    'id', r.id, 'status', r.status, 'requested_at', r.requested_at, 'scheduled_for', r.scheduled_for,
    'processing_started_at', r.processing_started_at, 'cancelled_at', r.cancelled_at) end
  from (select 1) d
  left join lateral (
    select x.* from public.account_deletion_requests x where x.user_id = auth.uid() and x.status in ('requested', 'processing', 'failed')
    order by x.requested_at desc limit 1) r on true
  where auth.uid() is not null;
$$;

-- Service-only: requests whose grace period has ended (processing itself is intentionally NOT implemented here).
create or replace function public.list_due_account_deletions()
returns table (request_id uuid, user_id uuid, scheduled_for timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.user_id, r.scheduled_for from public.account_deletion_requests r where r.status = 'requested' and r.scheduled_for <= now();
$$;

revoke all on function public.request_account_deletion(text) from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
revoke all on function public.get_account_deletion_status() from public, anon;
revoke all on function public.list_due_account_deletions() from public, anon, authenticated;
grant execute on function public.request_account_deletion(text) to authenticated, service_role;
grant execute on function public.cancel_account_deletion() to authenticated, service_role;
grant execute on function public.get_account_deletion_status() to authenticated, service_role;
grant execute on function public.list_due_account_deletions() to service_role;

-- ---------------------------------------------------------------------
-- Server-derived member summary
-- ---------------------------------------------------------------------
create or replace function public.member_summary_core(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jobs_by jsonb;
  housing_by jsonb;
  comp record;
  done_n integer := 0;
  total_n integer := 0;
  next_key text;
  res jsonb;
begin
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into jobs_by
    from (select a.status, count(*) n from public.job_applications a where a.user_id = p_user and a.submitted_at is not null group by a.status) x;
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into housing_by
    from (select h.status, count(*) n from public.housing_applications h where h.user_id = p_user and h.submitted_at is not null group by h.status) x;

  -- Opportunity Profile completion (the function scopes to auth.uid(); p_user is that same member here).
  for comp in select * from public.get_opportunity_completion() order by sort_order loop
    total_n := total_n + 1;
    if comp.is_complete then done_n := done_n + 1; elsif next_key is null then next_key := comp.section_key; end if;
  end loop;

  res := jsonb_build_object(
    'jobs', jsonb_build_object(
      'applied', (select count(*) from public.job_applications a where a.user_id = p_user and a.submitted_at is not null and a.status <> 'withdrawn'),
      'by_status', jobs_by,
      'saved', (select count(*) from public.saved_jobs s where s.user_id = p_user)),
    'housing', jsonb_build_object(
      'applications', (select count(*) from public.housing_applications h where h.user_id = p_user and h.submitted_at is not null and h.status <> 'withdrawn'),
      'drafts', (select count(*) from public.housing_applications h where h.user_id = p_user and h.status = 'started'),
      'by_status', housing_by,
      'saved_homes', (select count(*) from public.saved_housing s where s.user_id = p_user)),
    'resources', jsonb_build_object(
      'saved', (select count(*) from public.saved_resources s where s.user_id = p_user),
      'started', (select count(*) from public.resource_interactions r where r.user_id = p_user and r.state = 'started'),
      'completed', (select count(*) from public.resource_interactions r where r.user_id = p_user and r.state = 'completed'),
      'unavailable_saved', (select count(*) from public.saved_resources s where s.user_id = p_user and not public.resource_is_visible(s.resource_id))),
    'profile', jsonb_build_object('completed_sections', done_n, 'total_sections', total_n, 'next_section', next_key),
    'documents', jsonb_build_object(
      'generated', (select count(*) from public.generated_documents d where d.user_id = p_user and d.status <> 'deleted'),
      'stored_copies', (select count(*) from public.generated_documents d where d.user_id = p_user and d.status = 'ready' and d.persist_policy = 'stored'),
      'expiring_soon', (select count(*) from public.generated_documents d where d.user_id = p_user and d.status = 'ready' and d.persist_policy = 'stored' and d.expires_at <= now() + interval '7 days')),
    'notifications', jsonb_build_object('unread', (select count(*) from public.user_notifications n where n.user_id = p_user and n.read_at is null)),
    'plus', public.fairpath_plus_status(p_user),
    'deletion_request', public.get_account_deletion_status()
  );
  return res;
end;
$$;
revoke all on function public.member_summary_core(uuid) from public, anon, authenticated;
grant execute on function public.member_summary_core(uuid) to service_role;

-- Later modules (credit, record relief, ...) add `member_summary_<module>(uuid) returns jsonb`; they are merged in
-- when they exist, so this function never has to be rewritten and never breaks on a missing module.
create or replace function public.get_member_home_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
  ext text;
  part jsonb;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  res := public.member_summary_core(uid);
  foreach ext in array array['credit', 'record_relief'] loop
    if to_regprocedure('public.member_summary_' || ext || '(uuid)') is not null then
      execute format('select public.member_summary_%s($1)', ext) into part using uid;
      res := res || jsonb_build_object(ext, coalesce(part, '{}'::jsonb));
    end if;
  end loop;
  return res;
end;
$$;
revoke all on function public.get_member_home_summary() from public, anon;
grant execute on function public.get_member_home_summary() to authenticated, service_role;
