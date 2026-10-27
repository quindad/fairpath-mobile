-- FairPath Unified Community Exchange — community help requests & structured offers (DRAFT).
-- NOT APPROVED FOR SHARED DEV. Do not combine with Professional Profile or Justice migrations.
--
-- Rollback (DEV):
--   drop function if exists public.member_respond_community_help_offer(uuid,boolean);
--   drop function if exists public.member_offer_community_help(uuid,text,uuid);
--   drop function if exists public.list_open_community_help_board(text,text);
--   drop function if exists public.member_get_community_help_request(uuid);
--   drop function if exists public.list_my_community_help_requests();
--   drop function if exists public.member_fulfill_community_help_request(uuid);
--   drop function if exists public.member_cancel_community_help_request(uuid);
--   drop function if exists public.member_create_community_help_request(text,text,smallint,text,text,text,text,boolean,boolean,timestamptz);
--   drop function if exists public.touch_community_help_expiry();
--   drop table if exists public.community_help_offers;
--   drop table if exists public.community_help_requests;

create table if not exists public.community_help_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'groceries','food_assistance','clothing','hygiene','baby_supplies','diapers',
    'school_supplies','household_essentials','transportation','other'
  )),
  description text not null check (char_length(trim(description)) between 10 and 500),
  household_size smallint check (household_size is null or household_size between 1 and 20),
  urgency text not null default 'flexible' check (urgency in ('today','this_week','flexible')),
  city text not null check (char_length(trim(city)) >= 2),
  state text not null check (state ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or postal_code ~ '^\d{5}$'),
  pickup_ok boolean not null default true,
  delivery_preferred boolean not null default false,
  status text not null default 'open' check (status in ('open','matched','fulfilled','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists community_help_requests_member_idx on public.community_help_requests (member_id, status, created_at desc);
create index if not exists community_help_requests_board_idx on public.community_help_requests (status, state, category, expires_at);

create table if not exists public.community_help_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.community_help_requests(id) on delete cascade,
  helper_id uuid not null references auth.users(id) on delete cascade,
  marketplace_item_id uuid references public.marketplace_items(id) on delete set null,
  note text check (note is null or char_length(note) <= 280),
  status text not null default 'offered' check (status in ('offered','accepted','declined','withdrawn','expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists community_help_offers_one_active_per_pair
  on public.community_help_offers (request_id, helper_id)
  where status in ('offered','accepted');
create index if not exists community_help_offers_request_idx on public.community_help_offers (request_id, status);

alter table public.community_help_requests enable row level security;
alter table public.community_help_offers enable row level security;
revoke all on table public.community_help_requests from public, anon, authenticated, service_role;
revoke all on table public.community_help_offers from public, anon, authenticated, service_role;
grant select on table public.community_help_requests to authenticated, service_role;
grant select on table public.community_help_offers to authenticated, service_role;

create policy community_help_requests_select_own on public.community_help_requests
  for select to authenticated using (member_id = auth.uid());

create policy community_help_offers_select_participants on public.community_help_offers
  for select to authenticated using (
    helper_id = auth.uid()
    or exists (
      select 1 from public.community_help_requests r
      where r.id = request_id and r.member_id = auth.uid()
    )
  );

create or replace function public.touch_community_help_expiry()
returns void
language plpgsql
security definer
set search_path to public
as $f$
begin
  update public.community_help_requests
  set status = 'expired', updated_at = now()
  where status = 'open' and expires_at <= now();
  update public.community_help_offers o
  set status = 'expired', responded_at = coalesce(responded_at, now())
  from public.community_help_requests r
  where o.request_id = r.id and o.status = 'offered' and r.status <> 'open';
end;
$f$;
revoke all on function public.touch_community_help_expiry() from public, anon, authenticated, service_role;
grant execute on function public.touch_community_help_expiry() to service_role;

create or replace function public.member_create_community_help_request(
  p_category text,
  p_description text,
  p_household_size smallint,
  p_urgency text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_pickup_ok boolean,
  p_delivery_preferred boolean,
  p_expires_at timestamptz
)
returns public.community_help_requests
language plpgsql
security definer
set search_path to public
as $f$
declare
  v_user uuid := auth.uid();
  v_open integer;
  v_row public.community_help_requests;
  v_desc text := trim(p_description);
  v_city text := trim(p_city);
  v_state text := upper(trim(p_state));
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  perform public.touch_community_help_expiry();
  select count(*) into v_open from public.community_help_requests
  where member_id = v_user and status in ('open','matched');
  if v_open >= 3 then raise exception 'TOO_MANY_OPEN'; end if;
  if exists (
    select 1 from public.community_help_requests
    where member_id = v_user and status = 'open'
      and lower(v_desc) = lower(description)
      and created_at > now() - interval '24 hours'
  ) then raise exception 'DUPLICATE_REQUEST'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '14 days' then
    raise exception 'INVALID_EXPIRY';
  end if;
  if p_category is null or p_category not in (
    'groceries','food_assistance','clothing','hygiene','baby_supplies','diapers',
    'school_supplies','household_essentials','transportation','other'
  ) then
    raise exception 'INVALID_CATEGORY';
  end if;
  insert into public.community_help_requests(
    member_id, category, description, household_size, urgency, city, state, postal_code,
    pickup_ok, delivery_preferred, expires_at
  ) values (
    v_user, p_category, v_desc, p_household_size, coalesce(p_urgency,'flexible'), v_city, v_state,
    nullif(trim(p_postal_code), ''), coalesce(p_pickup_ok, true), coalesce(p_delivery_preferred, false), p_expires_at
  )
  returning * into v_row;
  return v_row;
end;
$f$;
revoke all on function public.member_create_community_help_request(text,text,smallint,text,text,text,text,boolean,boolean,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.member_create_community_help_request(text,text,smallint,text,text,text,text,boolean,boolean,timestamptz) to authenticated, service_role;

create or replace function public.member_cancel_community_help_request(p_request_id uuid)
returns public.community_help_requests
language plpgsql
security definer
set search_path to public
as $f$
declare v_user uuid := auth.uid(); v_row public.community_help_requests;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  update public.community_help_requests
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_request_id and member_id = v_user and status in ('open','matched')
  returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.community_help_offers set status = 'expired', responded_at = now()
  where request_id = p_request_id and status = 'offered';
  return v_row;
end;
$f$;
revoke all on function public.member_cancel_community_help_request(uuid) from public, anon, authenticated, service_role;
grant execute on function public.member_cancel_community_help_request(uuid) to authenticated, service_role;

create or replace function public.member_fulfill_community_help_request(p_request_id uuid)
returns public.community_help_requests
language plpgsql
security definer
set search_path to public
as $f$
declare v_user uuid := auth.uid(); v_row public.community_help_requests;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  update public.community_help_requests
  set status = 'fulfilled', fulfilled_at = now(), updated_at = now()
  where id = p_request_id and member_id = v_user and status in ('open','matched')
  returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  return v_row;
end;
$f$;
revoke all on function public.member_fulfill_community_help_request(uuid) from public, anon, authenticated, service_role;
grant execute on function public.member_fulfill_community_help_request(uuid) to authenticated, service_role;

create or replace function public.list_my_community_help_requests()
returns setof public.community_help_requests
language plpgsql
security definer
set search_path to public
as $f$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  perform public.touch_community_help_expiry();
  return query
  select * from public.community_help_requests
  where member_id = v_user
  order by created_at desc
  limit 50;
end;
$f$;
revoke all on function public.list_my_community_help_requests() from public, anon, authenticated, service_role;
grant execute on function public.list_my_community_help_requests() to authenticated, service_role;

create or replace function public.member_get_community_help_request(p_request_id uuid)
returns table (
  id uuid, category text, description text, household_size smallint, urgency text,
  city text, state text, postal_code text, pickup_ok boolean, delivery_preferred boolean,
  status text, expires_at timestamptz, created_at timestamptz, is_owner boolean
)
language plpgsql
security definer
set search_path to public
as $f$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  perform public.touch_community_help_expiry();
  if not exists (
    select 1 from public.community_help_requests r
    where r.id = p_request_id
      and (r.member_id = v_user or (r.status = 'open' and r.expires_at > now()))
  ) then
    raise exception 'NOT_FOUND';
  end if;
  return query
  select r.id, r.category, r.description, r.household_size, r.urgency,
    r.city, r.state, case when r.member_id = v_user then r.postal_code else null end,
    r.pickup_ok, r.delivery_preferred, r.status, r.expires_at, r.created_at,
    (r.member_id = v_user) as is_owner
  from public.community_help_requests r
  where r.id = p_request_id
    and (r.member_id = v_user or (r.status = 'open' and r.expires_at > now()));
end;
$f$;
revoke all on function public.member_get_community_help_request(uuid) from public, anon, authenticated, service_role;
grant execute on function public.member_get_community_help_request(uuid) to authenticated, service_role;

create or replace function public.list_open_community_help_board(p_state text default null, p_category text default null)
returns table (
  id uuid, category text, description text, urgency text, city text, state text,
  pickup_ok boolean, expires_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path to public
as $f$
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
  perform public.touch_community_help_expiry();
  return query
  select r.id, r.category, r.description, r.urgency, r.city, r.state, r.pickup_ok, r.expires_at, r.created_at
  from public.community_help_requests r
  where r.status = 'open' and r.expires_at > now()
    and (p_state is null or r.state = upper(trim(p_state)))
    and (p_category is null or r.category = p_category)
  order by case r.urgency when 'today' then 0 when 'this_week' then 1 else 2 end, r.created_at desc
  limit 100;
end;
$f$;
revoke all on function public.list_open_community_help_board(text,text) from public, anon, authenticated, service_role;
grant execute on function public.list_open_community_help_board(text,text) to authenticated, service_role;

create or replace function public.member_offer_community_help(
  p_request_id uuid,
  p_note text default null,
  p_marketplace_item_id uuid default null
)
returns public.community_help_offers
language plpgsql
security definer
set search_path to public
as $f$
declare
  v_user uuid := auth.uid();
  v_req public.community_help_requests;
  v_offer public.community_help_offers;
  v_title text;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  select * into v_req from public.community_help_requests
  where id = p_request_id and status = 'open' and expires_at > now();
  if not found then raise exception 'REQUEST_UNAVAILABLE'; end if;
  if v_req.member_id = v_user then raise exception 'OWN_REQUEST'; end if;
  if p_marketplace_item_id is not null then
    if not exists (
      select 1 from public.marketplace_items i
      where i.id = p_marketplace_item_id and i.seller_id = v_user and i.status = 'available'
    ) then raise exception 'INVALID_ITEM'; end if;
  end if;
  insert into public.community_help_offers(request_id, helper_id, marketplace_item_id, note)
  values (p_request_id, v_user, p_marketplace_item_id, nullif(trim(p_note), ''))
  returning * into v_offer;
  select left(v_req.description, 80) into v_title;
  insert into public.user_notifications(user_id, category, title, body, route, metadata)
  values (
    v_req.member_id, 'community', 'Someone offered to help',
    'A community member offered help with your request.',
    '/community/need-help/' || p_request_id::text,
    jsonb_build_object('offer_id', v_offer.id, 'request_id', p_request_id)
  );
  return v_offer;
end;
$f$;
revoke all on function public.member_offer_community_help(uuid,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.member_offer_community_help(uuid,text,uuid) to authenticated, service_role;

create or replace function public.member_respond_community_help_offer(p_offer_id uuid, p_accept boolean)
returns public.community_help_offers
language plpgsql
security definer
set search_path to public
as $f$
declare
  v_user uuid := auth.uid();
  v_offer public.community_help_offers;
  v_req public.community_help_requests;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  select o.* into v_offer from public.community_help_offers o
  join public.community_help_requests r on r.id = o.request_id
  where o.id = p_offer_id and r.member_id = v_user and o.status = 'offered';
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_accept then
    update public.community_help_offers set status = 'accepted', responded_at = now() where id = p_offer_id;
    update public.community_help_offers set status = 'declined', responded_at = now()
    where request_id = v_offer.request_id and id <> p_offer_id and status = 'offered';
    update public.community_help_requests set status = 'matched', updated_at = now()
    where id = v_offer.request_id;
    insert into public.user_notifications(user_id, category, title, body, route, metadata)
    values (
      v_offer.helper_id, 'community', 'Your offer was accepted',
      'The member accepted your help. Coordinate pickup safely through Marketplace if you linked an item.',
      '/community/need-help/' || v_offer.request_id::text,
      jsonb_build_object('offer_id', p_offer_id)
    );
  else
    update public.community_help_offers set status = 'declined', responded_at = now() where id = p_offer_id;
    insert into public.user_notifications(user_id, category, title, body, route, metadata)
    values (
      v_offer.helper_id, 'community', 'Offer update',
      'The member declined this offer. You can still help through Marketplace listings.',
      '/marketplace',
      jsonb_build_object('offer_id', p_offer_id)
    );
  end if;
  select * into v_offer from public.community_help_offers where id = p_offer_id;
  return v_offer;
end;
$f$;
revoke all on function public.member_respond_community_help_offer(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.member_respond_community_help_offer(uuid,boolean) to authenticated, service_role;
