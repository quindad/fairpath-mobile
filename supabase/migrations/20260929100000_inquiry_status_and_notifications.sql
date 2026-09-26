-- Notification foundation + real housing-inquiry status (forward-only).
--
-- 1. user_notifications becomes the single in-app notification record: idempotent (dedupe_key),
--    deep-link ready (route + entity), read/unread through server-controlled paths only.
-- 2. push/email delivery is a separate, server-only concern (push_tokens, notification_deliveries).
--    NO push is sent from this migration; a worker with APNs/Expo credentials can consume the queue later.
-- 3. housing_inquiries gains real state columns. Every state is written by a server function:
--      sent      = created_at (the inquiry exists)
--      received  = partner acknowledged it        (partner_acknowledge_housing_inquiry)
--      seen      = partner opened it              (partner_acknowledge_housing_inquiry)
--      replied   = partner answered               (partner_reply_housing_inquiry)
--      reply read= the applicant opened the reply (mark_housing_inquiry_reply_read)
--    Nothing in the app fakes "delivered" or "seen": those columns stay NULL until the partner side acts.
-- 4. Status changes on housing and job applications produce idempotent notifications.

-- ---------------------------------------------------------------------
-- 1. Notifications
-- ---------------------------------------------------------------------
alter table public.user_notifications
  add column if not exists dedupe_key text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

create unique index if not exists user_notifications_dedupe_idx
  on public.user_notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id) where read_at is null;

-- Clients may read their notifications and set read_at on them. Nothing else.
drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications" on public.user_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on table public.user_notifications from anon;
revoke insert, update, delete on table public.user_notifications from authenticated;
grant select on table public.user_notifications to authenticated;
grant update (read_at) on table public.user_notifications to authenticated;

-- The only way to create a notification. Idempotent per (user, dedupe_key). Server-side callers only.
create or replace function public.create_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_route text default null,
  p_dedupe_key text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.user_notifications (user_id, category, title, body, route, metadata, dedupe_key, entity_type, entity_id)
  values (p_user_id, p_category, p_title, p_body, p_route, coalesce(p_metadata, '{}'::jsonb), p_dedupe_key, p_entity_type, p_entity_id)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_notification(uuid, text, text, text, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, text, text, text, text, text, text, uuid, jsonb) to service_role;

create or replace function public.unread_notification_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer from public.user_notifications where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.unread_notification_count() from public, anon;
grant execute on function public.unread_notification_count() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Delivery boundary (no sender yet)
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  provider text not null default 'expo' check (provider in ('expo', 'apns', 'fcm')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id) where disabled_at is null;
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_owner_read" on public.push_tokens;
create policy "push_tokens_owner_read" on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
grant select on table public.push_tokens to authenticated;
grant select, insert, update, delete on table public.push_tokens to service_role;

create or replace function public.register_push_token(p_token text, p_platform text, p_provider text default 'expo')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if length(coalesce(p_token, '')) < 10 or length(p_token) > 512 then raise exception 'INVALID_TOKEN' using errcode = 'P0001'; end if;
  insert into public.push_tokens (user_id, token, platform, provider)
  values (uid, p_token, p_platform, coalesce(p_provider, 'expo'))
  on conflict (token) do update set user_id = uid, platform = excluded.platform, provider = excluded.provider, last_seen_at = now(), disabled_at = null;
end;
$$;
revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated, service_role;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.user_notifications(id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id, channel)
);
alter table public.notification_deliveries enable row level security; -- no policies: server only
grant select, insert, update, delete on table public.notification_deliveries to service_role;

create or replace function public.queue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_deliveries (notification_id, channel) values (new.id, 'push')
  on conflict do nothing;
  return null;
end;
$$;
revoke all on function public.queue_notification_delivery() from public, anon, authenticated;
grant execute on function public.queue_notification_delivery() to service_role;
drop trigger if exists user_notifications_queue_delivery on public.user_notifications;
create trigger user_notifications_queue_delivery
  after insert on public.user_notifications
  for each row execute function public.queue_notification_delivery();

-- ---------------------------------------------------------------------
-- 3. Housing inquiries: real states
-- ---------------------------------------------------------------------
alter table public.housing_inquiries
  add column if not exists received_at timestamptz,
  add column if not exists seen_at timestamptz,
  add column if not exists reply_read_at timestamptz,
  add column if not exists responded_by uuid references auth.users(id) on delete set null;

-- Listing owners (future FairPath Partner) can read inquiries about their own listings.
drop policy if exists "Owners read inquiries on own listings" on public.housing_inquiries;
create policy "Owners read inquiries on own listings" on public.housing_inquiries
  for select to authenticated
  using (exists (select 1 from public.housing_listings h where h.id = housing_inquiries.listing_id and h.owner_id = (select auth.uid())));

create or replace function public.partner_acknowledge_housing_inquiry(p_inquiry_id uuid, p_state text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if p_state not in ('received', 'seen') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;

  update public.housing_inquiries i
     set received_at = coalesce(i.received_at, now()),
         seen_at = case when p_state = 'seen' then coalesce(i.seen_at, now()) else i.seen_at end,
         updated_at = now()
   where i.id = p_inquiry_id
     and exists (select 1 from public.housing_listings h where h.id = i.listing_id and h.owner_id = uid);
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.partner_acknowledge_housing_inquiry(uuid, text) from public, anon;
grant execute on function public.partner_acknowledge_housing_inquiry(uuid, text) to authenticated, service_role;

create or replace function public.partner_reply_housing_inquiry(p_inquiry_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  msg text := btrim(coalesce(p_message, ''));
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if length(msg) < 1 or length(msg) > 2000 then raise exception 'INVALID_MESSAGE' using errcode = 'P0001'; end if;

  update public.housing_inquiries i
     set response_message = msg,
         responded_at = now(),
         responded_by = uid,
         status = 'responded',
         received_at = coalesce(i.received_at, now()),
         seen_at = coalesce(i.seen_at, now()),
         reply_read_at = null,
         updated_at = now()
   where i.id = p_inquiry_id
     and i.response_message is null
     and exists (select 1 from public.housing_listings h where h.id = i.listing_id and h.owner_id = uid);
  if not found then raise exception 'CANNOT_REPLY' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.partner_reply_housing_inquiry(uuid, text) from public, anon;
grant execute on function public.partner_reply_housing_inquiry(uuid, text) to authenticated, service_role;

create or replace function public.mark_housing_inquiry_reply_read(p_inquiry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  update public.housing_inquiries i
     set reply_read_at = coalesce(i.reply_read_at, now())
   where i.id = p_inquiry_id and i.user_id = uid and i.responded_at is not null;
  update public.user_notifications n
     set read_at = coalesce(n.read_at, now())
   where n.user_id = uid and n.dedupe_key = 'housing_inquiry_reply:' || p_inquiry_id::text;
end;
$$;
revoke all on function public.mark_housing_inquiry_reply_read(uuid) from public, anon;
grant execute on function public.mark_housing_inquiry_reply_read(uuid) to authenticated, service_role;

-- Reply -> idempotent notification for the applicant (replaces the baseline trigger function body).
create or replace function public.on_housing_inquiry_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.response_message is distinct from old.response_message and new.response_message is not null then
    perform public.create_notification(
      new.user_id, 'housing_inquiry', 'Property question answered', left(new.response_message, 180),
      '/housing-activity', 'housing_inquiry_reply:' || new.id::text, 'housing_inquiry', new.id,
      jsonb_build_object('inquiry_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- New inquiry -> notify the listing owner (partner inbox). This is a notification, not a "received" state.
create or replace function public.notify_owner_of_housing_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare owner uuid;
begin
  select h.owner_id into owner from public.housing_listings h where h.id = new.listing_id;
  if owner is not null then
    perform public.create_notification(
      owner, 'housing_inquiry_received', 'New question about your listing', left(new.message, 180),
      null, 'housing_inquiry_new:' || new.id::text, 'housing_inquiry', new.id,
      jsonb_build_object('inquiry_id', new.id, 'listing_id', new.listing_id)
    );
  end if;
  return null;
end;
$$;
revoke all on function public.notify_owner_of_housing_inquiry() from public, anon, authenticated;
grant execute on function public.notify_owner_of_housing_inquiry() to service_role;
drop trigger if exists housing_inquiry_notify_owner on public.housing_inquiries;
create trigger housing_inquiry_notify_owner
  after insert on public.housing_inquiries
  for each row execute function public.notify_owner_of_housing_inquiry();

-- ---------------------------------------------------------------------
-- 4. Application status -> notifications (idempotent)
-- ---------------------------------------------------------------------
create or replace function public.on_housing_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status is distinct from old.status then
    insert into public.housing_application_events (application_id, actor_user_id, event_type, metadata)
    values (new.id, auth.uid(), new.status, jsonb_build_object('from', old.status, 'to', new.status, 'at', now()))
    on conflict do nothing;

    v_title := case new.status
      when 'submitted' then 'Housing application submitted'
      when 'reviewing' then 'Housing application under review'
      when 'tour' then 'Housing application next step'
      when 'approved' then 'Housing application approved'
      when 'denied' then 'Housing application update'
      when 'withdrawn' then 'Housing application withdrawn'
      else 'Housing application updated' end;
    v_body := case new.status
      when 'submitted' then 'FairPath confirmed your completed housing application.'
      when 'reviewing' then 'The property team moved your application into review.'
      when 'tour' then 'The property team added a tour or next step.'
      when 'approved' then 'The property team marked your application approved.'
      when 'denied' then coalesce(new.status_reason, 'The property team recorded a decision on your application.')
      when 'withdrawn' then 'Your application is marked withdrawn.'
      else 'Your housing application status changed.' end;
    perform public.create_notification(
      new.user_id, 'housing_application', v_title, v_body,
      '/housing-application/' || new.id::text, 'housing_app:' || new.id::text || ':' || new.status,
      'housing_application', new.id, jsonb_build_object('application_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

-- Job applications: notify the applicant when someone ELSE (employer/system) changes the status.
create or replace function public.log_job_application_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  who text;
begin
  who := case
    when uid is null then 'system'
    when uid = new.user_id then 'applicant'
    else 'employer'
  end;

  if tg_op = 'INSERT' then
    insert into public.job_application_events
      (application_id, job_id, applicant_id, event_type, from_status, to_status, actor_type, actor_id)
    values (new.id, new.job_id, new.user_id, 'submitted', null, new.status, who, uid);
  elsif new.status is distinct from old.status then
    insert into public.job_application_events
      (application_id, job_id, applicant_id, event_type, from_status, to_status, actor_type, actor_id)
    values (
      new.id, new.job_id, new.user_id,
      case when new.status = 'withdrawn' then 'withdrawn' else 'status_changed' end,
      old.status, new.status, who, uid
    );
    if who <> 'applicant' then
      perform public.create_notification(
        new.user_id, 'job_application', 'Job application update',
        'Your application status changed to ' || replace(new.status, '_', ' ') || '.',
        '/job-application/' || new.id::text, 'job_app:' || new.id::text || ':' || new.status,
        'job_application', new.id, jsonb_build_object('application_id', new.id, 'status', new.status)
      );
    end if;
  end if;
  return null;
end;
$$;
