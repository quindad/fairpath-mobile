-- Auth/profile hardening for social sign-in (forward-only).
--
-- One FairPath identity model: auth.users.id == public.profiles.id (primary key + trigger). Apple/Google sign-ins
-- create an auth.users row, and this trigger creates the single profile for it. Two changes are required so
-- that identity/authorization never depends on client-controlled data:
--   1. handle_new_user no longer trusts raw_user_meta_data.account_type (a client could send 'admin').
--      Every self-created account is a 'member'. It also reads provider names (Google) when present.
--   2. Signed-in clients can no longer change profiles.account_type.
-- Elevated account types (partner/admin) are issued only by trusted server code / SQL.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_name text := nullif(btrim(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ', 1))), '');
  last_name text := nullif(btrim(coalesce(meta ->> 'last_name', meta ->> 'family_name',
                     nullif(substr(coalesce(meta ->> 'full_name', meta ->> 'name', ''), length(split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ', 1)) + 2), ''))), '');
begin
  insert into public.profiles (id, first_name, last_name, account_type)
  values (new.id, first_name, last_name, 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.protect_profile_account_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.account_type is distinct from old.account_type and current_user in ('authenticated', 'anon') then
    raise exception 'ACCOUNT_TYPE_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_account_type on public.profiles;
create trigger profiles_protect_account_type
  before update of account_type on public.profiles
  for each row execute function public.protect_profile_account_type();
