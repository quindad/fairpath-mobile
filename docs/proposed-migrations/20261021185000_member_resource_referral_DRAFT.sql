-- Member-initiated resource referral requests (DRAFT). Separate from community_help and justice/profile migrations.
-- NOT APPROVED FOR SHARED DEV.
--
-- Rollback:
--   drop function if exists public.partner_complete_resource_referral_request(uuid,text);
--   drop function if exists public.partner_respond_resource_referral_request(uuid,boolean);
--   drop function if exists public.partner_list_resource_referral_inbox(uuid);
--   drop function if exists public.list_my_resource_referral_requests();
--   drop function if exists public.member_submit_resource_referral_request(uuid,text);
--   drop table if exists public.member_resource_referral_requests;

create table if not exists public.member_resource_referral_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','accepted','declined','completed','cancelled')),
  member_note text check (member_note is null or char_length(member_note) <= 500),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_resource_referral_member_idx on public.member_resource_referral_requests (member_id, status, created_at desc);
create index if not exists member_resource_referral_org_idx on public.member_resource_referral_requests (organization_id, status);

alter table public.member_resource_referral_requests enable row level security;
revoke all on table public.member_resource_referral_requests from public, anon, authenticated, service_role;
grant select on table public.member_resource_referral_requests to authenticated, service_role;

create policy member_resource_referral_read_own on public.member_resource_referral_requests
  for select to authenticated using (member_id = auth.uid());

create or replace function public.member_submit_resource_referral_request(p_resource_id uuid, p_member_note text)
returns public.member_resource_referral_requests
language plpgsql
security definer
set search_path to public
as $f$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_row public.member_resource_referral_requests;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  select r.organization_id into v_org
  from public.resources r
  join public.resource_organizations o on o.id = r.organization_id and o.status = 'active'
  where r.id = p_resource_id
    and r.publish_status = 'published'
    and r.verification_state = 'verified'
    and (
      r.source_authority = 'partner_submitted'
      or exists (
        select 1 from public.organization_capabilities oc
        where oc.organization_id = r.organization_id
          and oc.capability = 'case_management'
          and oc.status = 'active'
      )
    );
  if v_org is null then raise exception 'RESOURCE_UNAVAILABLE'; end if;
  if exists (
    select 1 from public.member_resource_referral_requests
    where member_id = v_user and resource_id = p_resource_id and status in ('submitted','accepted')
  ) then raise exception 'DUPLICATE_REFERRAL'; end if;
  insert into public.member_resource_referral_requests(member_id, resource_id, organization_id, member_note)
  values (v_user, p_resource_id, v_org, nullif(trim(p_member_note), ''))
  returning * into v_row;
  insert into public.user_notifications(user_id, category, title, body, route, metadata)
  values (
    v_user, 'referral', 'Referral request sent',
    'The participating organization will review your request. This is not confirmed service yet.',
    '/resource/' || p_resource_id::text,
    jsonb_build_object('referral_request_id', v_row.id)
  );
  return v_row;
end;
$f$;
revoke all on function public.member_submit_resource_referral_request(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.member_submit_resource_referral_request(uuid,text) to authenticated, service_role;

create or replace function public.list_my_resource_referral_requests()
returns setof public.member_resource_referral_requests
language plpgsql
security definer
set search_path to public
as $f$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  return query
  select * from public.member_resource_referral_requests
  where member_id = v_user
  order by created_at desc
  limit 50;
end;
$f$;
revoke all on function public.list_my_resource_referral_requests() from public, anon, authenticated, service_role;
grant execute on function public.list_my_resource_referral_requests() to authenticated, service_role;

-- Partner inbox (org managers only). Separate from CRM participant_needs/referrals until explicit linking is approved.
create or replace function public.partner_list_resource_referral_inbox(p_organization_id uuid)
returns setof public.member_resource_referral_requests
language plpgsql
security definer
set search_path to public
as $f$
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
  if not public.partner_is_org_manager(p_organization_id) then raise exception 'FORBIDDEN'; end if;
  return query
  select *
  from public.member_resource_referral_requests
  where organization_id = p_organization_id
  order by created_at desc
  limit 100;
end;
$f$;
revoke all on function public.partner_list_resource_referral_inbox(uuid) from public, anon, authenticated, service_role;
grant execute on function public.partner_list_resource_referral_inbox(uuid) to authenticated, service_role;

create or replace function public.partner_respond_resource_referral_request(p_request_id uuid, p_accept boolean)
returns public.member_resource_referral_requests
language plpgsql
security definer
set search_path to public
as $f$
declare
  v_row public.member_resource_referral_requests;
  v_status text := case when p_accept then 'accepted' else 'declined' end;
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
  update public.member_resource_referral_requests r
  set status = v_status, updated_at = now()
  where r.id = p_request_id
    and r.status = 'submitted'
    and public.partner_is_org_manager(r.organization_id)
  returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.user_notifications(user_id, category, title, body, route, metadata)
  values (
    v_row.member_id, 'referral', case when p_accept then 'Referral accepted' else 'Referral update' end,
    case when p_accept then 'The organization accepted your referral request. Service is not complete until they confirm delivery.' else 'The organization declined this referral request. You can still use public contact options on the resource.' end,
    '/resource/' || v_row.resource_id::text,
    jsonb_build_object('referral_request_id', v_row.id, 'status', v_status)
  );
  return v_row;
end;
$f$;
revoke all on function public.partner_respond_resource_referral_request(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.partner_respond_resource_referral_request(uuid,boolean) to authenticated, service_role;

create or replace function public.partner_complete_resource_referral_request(p_request_id uuid, p_partner_note text default null)
returns public.member_resource_referral_requests
language plpgsql
security definer
set search_path to public
as $f$
declare
  v_row public.member_resource_referral_requests;
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
  update public.member_resource_referral_requests r
  set status = 'completed', updated_at = now()
  where r.id = p_request_id
    and r.status = 'accepted'
    and public.partner_is_org_manager(r.organization_id)
  returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.user_notifications(user_id, category, title, body, route, metadata)
  values (
    v_row.member_id, 'referral', 'Referral service completed',
    'The organization confirmed service delivery for your referral request. Thank you for using FairPath.',
    '/resource/' || v_row.resource_id::text,
    jsonb_build_object('referral_request_id', v_row.id, 'status', 'completed')
  );
  return v_row;
end;
$f$;
revoke all on function public.partner_complete_resource_referral_request(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.partner_complete_resource_referral_request(uuid,text) to authenticated, service_role;
