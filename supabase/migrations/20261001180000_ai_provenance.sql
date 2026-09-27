-- FairPath AI provenance (forward-only). Migration 9.
--
-- The FairPath AI layer orchestrates real workflows (Resources, Profile, Credit, Record Relief, Documents) over
-- allow-listed structured state. It never receives raw table access and never edits a member record. This table is the
-- audit trail of what an answer was based on:
--   * WHICH task and engine produced it (a deterministic router today; a model adapter later),
--   * WHICH records (ids only), rule versions and official sources it used,
--   * HOW confident it was and whether the member confirmed anything consequential.
-- No question text, no answer text and no record contents are stored here. Owner-only; members can delete all of it.

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null check (task in (
    'intent_router', 'resource_search', 'profile_help', 'next_steps', 'credit_explain', 'dispute_help', 'relief_explain', 'relief_countdown', 'document_help', 'education', 'navigation')),
  intent text not null check (intent ~ '^[a-z][a-z0-9_]{1,60}$'),
  engine text not null check (engine in ('deterministic_router', 'model')),
  route text check (route is null or (route ~ '^/[a-zA-Z0-9/_\-?=&\[\]]*$' and length(route) <= 200)),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array' and jsonb_array_length(source_refs) <= 20),
  rule_versions jsonb not null default '[]'::jsonb check (jsonb_typeof(rule_versions) = 'array' and jsonb_array_length(rule_versions) <= 20),
  official_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(official_sources) = 'array' and jsonb_array_length(official_sources) <= 10),
  confidence text not null check (confidence in ('deterministic', 'high', 'medium', 'low', 'unavailable')),
  confirmation_state text not null default 'not_required' check (confirmation_state in ('not_required', 'pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index if not exists ai_interactions_user_idx on public.ai_interactions (user_id, created_at desc);
comment on table public.ai_interactions is 'Provenance only. No question text, answer text or record contents are stored.';

alter table public.ai_interactions enable row level security;
drop policy if exists "ai_interactions_owner_read" on public.ai_interactions;
create policy "ai_interactions_owner_read" on public.ai_interactions for select to authenticated using (user_id = (select auth.uid()));
grant select on table public.ai_interactions to authenticated;
grant select, insert, update, delete on table public.ai_interactions to service_role;

create or replace function public.log_ai_interaction(
  p_task text, p_intent text, p_engine text, p_route text, p_source_refs jsonb, p_rule_versions jsonb, p_official_sources jsonb, p_confidence text, p_confirmation text default 'not_required')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  el jsonb;
  new_id uuid;
  recent integer;
  refs jsonb := coalesce(p_source_refs, '[]'::jsonb);
  vers jsonb := coalesce(p_rule_versions, '[]'::jsonb);
  offs jsonb := coalesce(p_official_sources, '[]'::jsonb);
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select count(*) into recent from public.ai_interactions a where a.user_id = uid and a.created_at > now() - interval '24 hours';
  if recent >= 300 then raise exception 'AI_LOG_RATE_LIMIT'; end if;
  if jsonb_typeof(refs) <> 'array' or jsonb_typeof(vers) <> 'array' or jsonb_typeof(offs) <> 'array' then raise exception 'INVALID_PROVENANCE'; end if;

  -- Record references are ids of the member's own records, never content. Kinds are an allow-list.
  for el in select * from jsonb_array_elements(refs) loop
    if jsonb_typeof(el) <> 'object' or not (el ->> 'kind' = any (array['resource', 'credit_item', 'credit_account', 'credit_dispute', 'relief_case', 'relief_evaluation', 'profile_section', 'document', 'summary', 'notification']))
       or length(coalesce(el ->> 'id', '')) not between 1 and 64 or (select count(*) from jsonb_object_keys(el)) > 2 then
      raise exception 'INVALID_PROVENANCE';
    end if;
  end loop;
  for el in select * from jsonb_array_elements(vers) loop
    if jsonb_typeof(el) <> 'object' or length(coalesce(el ->> 'rule_key', '')) not between 1 and 90 or (select count(*) from jsonb_object_keys(el)) > 2 then raise exception 'INVALID_PROVENANCE'; end if;
  end loop;
  for el in select * from jsonb_array_elements(offs) loop
    if jsonb_typeof(el) <> 'object' or (el ->> 'url') !~ '^https://' or length(coalesce(el ->> 'label', '')) not between 1 and 120 or length(el ->> 'url') > 300 or (select count(*) from jsonb_object_keys(el)) > 2 then raise exception 'INVALID_PROVENANCE'; end if;
  end loop;

  insert into public.ai_interactions (user_id, task, intent, engine, route, source_refs, rule_versions, official_sources, confidence, confirmation_state)
  values (uid, p_task, p_intent, p_engine, p_route, refs, vers, offs, p_confidence, coalesce(p_confirmation, 'not_required'))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.set_ai_confirmation(p_id uuid, p_state text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_state not in ('confirmed', 'rejected') then raise exception 'INVALID_STATE'; end if;
  update public.ai_interactions a set confirmation_state = p_state where a.id = p_id and a.user_id = uid and a.confirmation_state = 'pending';
  if not found then raise exception 'INTERACTION_UNAVAILABLE'; end if;
end;
$$;

create or replace function public.delete_my_ai_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  delete from public.ai_interactions a where a.user_id = uid;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.expire_ai_interactions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.ai_interactions a where a.expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.log_ai_interaction(text, text, text, text, jsonb, jsonb, jsonb, text, text) from public, anon;
revoke all on function public.set_ai_confirmation(uuid, text) from public, anon;
revoke all on function public.delete_my_ai_history() from public, anon;
revoke all on function public.expire_ai_interactions() from public, anon, authenticated;
grant execute on function public.log_ai_interaction(text, text, text, text, jsonb, jsonb, jsonb, text, text) to authenticated, service_role;
grant execute on function public.set_ai_confirmation(uuid, text) to authenticated, service_role;
grant execute on function public.delete_my_ai_history() to authenticated, service_role;
grant execute on function public.expire_ai_interactions() to service_role;
