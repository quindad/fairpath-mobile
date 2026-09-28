-- Resume Studio: owner-only resume drafts. A resume is the member's own editable content, not a live view of the
-- Opportunity Profile — importing from the profile is a one-time COPY into these fields (member_resumes.content),
-- so an edit here never touches member_work_experience/education/credentials/skills, and a later profile edit never
-- silently changes an existing resume. This table stores no facts FairPath invented: everything in `content` is
-- either copied from the member's own profile rows at import time, or typed by the member directly.
create table if not exists public.member_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My resume' check (length(btrim(title)) between 1 and 120),
  target_role text check (target_role is null or length(target_role) <= 120),
  template text not null default 'classic' check (template in ('classic', 'compact')),
  -- Free-form but bounded: { contact, summary, experience[], education[], skills[], credentials[] }. Validated at
  -- the application layer (src/core/resume/resume-types.ts) since its shape is product content, not a DB contract.
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object' and length(content::text) <= 20000),
  imported_from_profile_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_resumes_user_idx on public.member_resumes (user_id, updated_at desc);

create or replace function public.member_resumes_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists member_resumes_touch_trg on public.member_resumes;
create trigger member_resumes_touch_trg before update on public.member_resumes for each row execute function public.member_resumes_touch();

alter table public.member_resumes enable row level security;

drop policy if exists "member_resumes_owner_select" on public.member_resumes;
create policy "member_resumes_owner_select" on public.member_resumes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "member_resumes_owner_insert" on public.member_resumes;
create policy "member_resumes_owner_insert" on public.member_resumes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "member_resumes_owner_update" on public.member_resumes;
create policy "member_resumes_owner_update" on public.member_resumes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "member_resumes_owner_delete" on public.member_resumes;
create policy "member_resumes_owner_delete" on public.member_resumes for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.member_resumes to authenticated;
grant select, insert, update, delete on table public.member_resumes to service_role;

-- A member may keep a reasonable number of drafts; this is a soft product limit, not a security control.
create or replace function public.member_resumes_limit() returns trigger language plpgsql as $$
declare n integer;
begin
  select count(*) into n from public.member_resumes where user_id = new.user_id;
  if n >= 20 then raise exception 'RESUME_LIMIT' using errcode = 'P0001'; end if;
  return new;
end;
$$;
drop trigger if exists member_resumes_limit_trg on public.member_resumes;
create trigger member_resumes_limit_trg before insert on public.member_resumes for each row execute function public.member_resumes_limit();

-- Duplicate a resume as a new independent row (never a live reference to the original).
create or replace function public.duplicate_resume(p_id uuid)
returns public.member_resumes
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  src public.member_resumes%rowtype;
  result public.member_resumes%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into src from public.member_resumes r where r.id = p_id and r.user_id = uid;
  if not found then raise exception 'RESUME_UNAVAILABLE'; end if;
  insert into public.member_resumes (user_id, title, target_role, template, content, imported_from_profile_at)
  values (uid, left(src.title || ' (copy)', 120), src.target_role, src.template, src.content, src.imported_from_profile_at)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.duplicate_resume(uuid) from public, anon;
grant execute on function public.duplicate_resume(uuid) to authenticated, service_role;
