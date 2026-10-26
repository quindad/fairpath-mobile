-- Community resource reactions + member contributions (moderation required before verified catalog changes).
-- DRAFT — do not apply without owner approval. DEV target: znvhmuhojvwvjzmaqwff only.

-- ---------------------------------------------------------------------
-- Reactions (one per member per resource; anonymous to other members)
-- ---------------------------------------------------------------------
create table if not exists public.resource_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  reaction text not null check (reaction in ('helpful', 'worked', 'not_helpful', 'broken_link', 'outdated')),
  anonymous_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, resource_id)
);

create index if not exists resource_reactions_resource_idx on public.resource_reactions (resource_id);
create index if not exists resource_reactions_user_day_idx on public.resource_reactions (user_id, updated_at desc);

alter table public.resource_reactions enable row level security;
revoke all on table public.resource_reactions from public, anon;
grant select, insert, update, delete on table public.resource_reactions to authenticated, service_role;

create policy resource_reactions_own on public.resource_reactions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Generic contributions (resources + record relief sources)
-- ---------------------------------------------------------------------
create table if not exists public.community_contributions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('resource_add', 'resource_edit', 'record_relief_source')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'needs_more_info')),
  resource_id uuid references public.resources (id) on delete set null,
  jurisdiction_code text,
  display_name text,
  anonymous_public boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  reviewer_id uuid references auth.users (id),
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_contributions_queue_idx
  on public.community_contributions (status, created_at desc) where status = 'pending';
create index if not exists community_contributions_contributor_idx
  on public.community_contributions (contributor_id, created_at desc);

alter table public.community_contributions enable row level security;
revoke all on table public.community_contributions from public, anon;
grant select, insert on table public.community_contributions to authenticated;
grant select, insert, update, delete on table public.community_contributions to service_role;

create policy community_contributions_read_own on public.community_contributions
  for select to authenticated using (contributor_id = auth.uid());

create policy community_contributions_insert_own on public.community_contributions
  for insert to authenticated with check (contributor_id = auth.uid());

create table if not exists public.community_contribution_events (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.community_contributions (id) on delete cascade,
  actor_id uuid references auth.users (id),
  event_type text not null check (event_type in ('submitted', 'approved', 'rejected', 'needs_more_info', 'reaction_flag')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.community_contribution_events enable row level security;
revoke all on table public.community_contribution_events from public, anon, authenticated;
grant select, insert on table public.community_contribution_events to service_role;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.resource_feedback_is_sensitive(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.resource_category_links rcl
    join public.resource_categories rc on rc.slug = rcl.category_slug
    where rcl.resource_id = p_resource_id
      and rc.slug in ('emergency_help', 'health_wellness')
  );
$$;
revoke all on function public.resource_feedback_is_sensitive(uuid) from public;
grant execute on function public.resource_feedback_is_sensitive(uuid) to anon, authenticated, service_role;

create or replace function public.community_contribution_reject_private_payload(p_payload jsonb)
returns void
language plpgsql
immutable
as $$
declare t text := lower(coalesce(p_payload::text, ''));
begin
  if t ~ '(case[_ ]?number|docket|ssn|social security|date of birth|defendant name|victim)' then
    raise exception 'PRIVATE_INFO_REJECTED';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Reaction RPCs
-- ---------------------------------------------------------------------
create or replace function public.get_resource_reaction_summary(p_resource_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sensitive boolean;
  totals bigint;
  c_helpful bigint; c_worked bigint; c_not bigint; c_broken bigint; c_out bigint;
  suppress boolean;
  mine_reaction text;
  mine_anonymous boolean;
begin
  if not exists (
    select 1 from public.resources r
    where r.id = p_resource_id and r.publish_status = 'published' and r.verification_state = 'verified'
  ) then
    return jsonb_build_object('available', false);
  end if;

  sensitive := public.resource_feedback_is_sensitive(p_resource_id);

  select count(*) into totals from public.resource_reactions where resource_id = p_resource_id;
  select count(*) filter (where reaction = 'helpful'), count(*) filter (where reaction = 'worked'),
         count(*) filter (where reaction = 'not_helpful'), count(*) filter (where reaction = 'broken_link'),
         count(*) filter (where reaction = 'outdated')
    into c_helpful, c_worked, c_not, c_broken, c_out
    from public.resource_reactions where resource_id = p_resource_id;

  suppress := sensitive and totals < 10;

  mine_reaction := null;
  mine_anonymous := null;
  if uid is not null then
    select reaction, anonymous_public into mine_reaction, mine_anonymous
    from public.resource_reactions where resource_id = p_resource_id and user_id = uid;
  end if;

  return jsonb_build_object(
    'available', true,
    'sensitive', sensitive,
    'counts_suppressed', suppress,
    'total', case when suppress then null else totals end,
    'counts', case when suppress then null else jsonb_build_object(
      'helpful', c_helpful, 'worked', c_worked, 'not_helpful', c_not, 'broken_link', c_broken, 'outdated', c_out
    ) end,
    'my_reaction', mine_reaction,
    'my_anonymous', coalesce(mine_anonymous, true)
  );
end;
$$;
revoke all on function public.get_resource_reaction_summary(uuid) from public;
grant execute on function public.get_resource_reaction_summary(uuid) to anon, authenticated, service_role;

create or replace function public.set_resource_reaction(
  p_resource_id uuid,
  p_reaction text,
  p_anonymous boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  recent int;
  clean_reaction text := lower(trim(p_reaction));
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if clean_reaction not in ('helpful', 'worked', 'not_helpful', 'broken_link', 'outdated') then
    raise exception 'INVALID_REACTION';
  end if;
  if not exists (
    select 1 from public.resources r
    where r.id = p_resource_id and r.publish_status = 'published' and r.verification_state = 'verified'
  ) then
    raise exception 'RESOURCE_UNAVAILABLE';
  end if;

  select count(*) into recent from public.resource_reactions
  where user_id = uid and updated_at > now() - interval '1 day';
  if recent >= 100 then raise exception 'REACTION_RATE_LIMIT'; end if;

  insert into public.resource_reactions (user_id, resource_id, reaction, anonymous_public, updated_at)
  values (uid, p_resource_id, clean_reaction, coalesce(p_anonymous, true), now())
  on conflict (user_id, resource_id) do update
    set reaction = excluded.reaction,
        anonymous_public = excluded.anonymous_public,
        updated_at = now();

  if clean_reaction in ('broken_link', 'outdated') then
    insert into public.community_contributions (contributor_id, kind, status, resource_id, anonymous_public, payload)
    select uid, 'resource_edit', 'pending', p_resource_id, coalesce(p_anonymous, true),
           jsonb_build_object('from_reaction', clean_reaction, 'note', 'Member flagged via reaction')
    where not exists (
      select 1 from public.community_contributions c
      where c.contributor_id = uid and c.resource_id = p_resource_id and c.status = 'pending'
        and c.payload->>'from_reaction' = clean_reaction
    );
  end if;

  return public.get_resource_reaction_summary(p_resource_id);
end;
$$;
revoke all on function public.set_resource_reaction(uuid, text, boolean) from public;
grant execute on function public.set_resource_reaction(uuid, text, boolean) to authenticated, service_role;

create or replace function public.clear_resource_reaction(p_resource_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  delete from public.resource_reactions where user_id = uid and resource_id = p_resource_id;
  return public.get_resource_reaction_summary(p_resource_id);
end;
$$;
revoke all on function public.clear_resource_reaction(uuid) from public;
grant execute on function public.clear_resource_reaction(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Contribution RPCs
-- ---------------------------------------------------------------------
create or replace function public.submit_community_contribution(
  p_kind text,
  p_payload jsonb,
  p_resource_id uuid default null,
  p_jurisdiction_code text default null,
  p_display_name text default null,
  p_anonymous boolean default true
)
returns public.community_contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_kind text := lower(trim(p_kind));
  row public.community_contributions;
  recent int;
  dn text := nullif(trim(p_display_name), '');
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if clean_kind not in ('resource_add', 'resource_edit', 'record_relief_source') then
    raise exception 'INVALID_KIND';
  end if;
  perform public.community_contribution_reject_private_payload(p_payload);

  select count(*) into recent from public.community_contributions
  where contributor_id = uid and created_at > now() - interval '1 day';
  if recent >= 20 then raise exception 'CONTRIBUTION_RATE_LIMIT'; end if;

  if clean_kind in ('resource_add', 'resource_edit') and p_resource_id is not null then
    if not exists (
      select 1 from public.resources r where r.id = p_resource_id
        and r.publish_status = 'published' and r.verification_state = 'verified'
    ) then
      raise exception 'RESOURCE_UNAVAILABLE';
    end if;
  end if;

  insert into public.community_contributions (
    contributor_id, kind, resource_id, jurisdiction_code, display_name, anonymous_public, payload
  ) values (
    uid, clean_kind, p_resource_id, nullif(trim(p_jurisdiction_code), ''), dn, coalesce(p_anonymous, true), coalesce(p_payload, '{}'::jsonb)
  )
  returning * into row;

  insert into public.community_contribution_events (contribution_id, actor_id, event_type, detail)
  values (row.id, uid, 'submitted', jsonb_build_object('kind', clean_kind));

  return row;
end;
$$;
revoke all on function public.submit_community_contribution(text, jsonb, uuid, text, text, boolean) from public;
grant execute on function public.submit_community_contribution(text, jsonb, uuid, text, text, boolean) to authenticated, service_role;

create or replace function public.admin_list_community_contributions(
  p_status text default 'pending',
  p_limit int default 50
)
returns setof public.community_contributions
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_fairpath_admin() then raise exception 'FORBIDDEN'; end if;
  return query
  select * from public.community_contributions c
  where c.status = coalesce(nullif(trim(p_status), ''), 'pending')
  order by c.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;
revoke all on function public.admin_list_community_contributions(text, int) from public;
grant execute on function public.admin_list_community_contributions(text, int) to authenticated, service_role;

create or replace function public.admin_review_community_contribution(
  p_id uuid,
  p_status text,
  p_reason text default null
)
returns public.community_contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_status text := lower(trim(p_status));
  row public.community_contributions;
begin
  if not public.is_fairpath_admin() then raise exception 'FORBIDDEN'; end if;
  if clean_status not in ('approved', 'rejected', 'needs_more_info') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.community_contributions c
  set status = clean_status,
      reviewer_id = uid,
      review_reason = nullif(trim(p_reason), ''),
      reviewed_at = now(),
      updated_at = now()
  where c.id = p_id and c.status in ('pending', 'needs_more_info')
  returning * into row;

  if row.id is null then raise exception 'NOT_FOUND'; end if;

  insert into public.community_contribution_events (contribution_id, actor_id, event_type, detail)
  values (row.id, uid, clean_status, jsonb_build_object('reason', nullif(trim(p_reason), '')));

  -- Audited handoff to ops review queues (does not auto-publish to verified directory).
  if clean_status = 'approved' and row.kind = 'resource_edit' and row.resource_id is not null then
    if not exists (
      select 1 from public.resource_reports rr
      where rr.user_id = row.contributor_id and rr.resource_id = row.resource_id and rr.status = 'open'
    ) then
      insert into public.resource_reports (user_id, resource_id, reason, note, status)
      values (row.contributor_id, row.resource_id, 'wrong_info',
        coalesce(row.review_reason, 'Approved community edit pending catalog update'), 'open');
    end if;
  end if;

  return row;
end;
$$;
revoke all on function public.admin_review_community_contribution(uuid, text, text) from public;
grant execute on function public.admin_review_community_contribution(uuid, text, text) to authenticated, service_role;

create or replace function public.community_contributions_backend_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_community_contribution'
  );
$$;
revoke all on function public.community_contributions_backend_ready() from public;
grant execute on function public.community_contributions_backend_ready() to anon, authenticated, service_role;
