-- Generated documents (forward-only). Migration 5: the shared document engine's database core.
-- See docs/FAIRPATH_DOCUMENT_EXPORT_ARCHITECTURE.md.
--
--   * generated_documents       : one row per generated version (metadata only; files are private storage objects)
--   * document_export_events    : append-only, metadata-only log of what the member did (preview/download/share/print/save)
--   * document_storage_cleanup  : queue of private storage objects that must be removed (deleted/expired copies)
--   * private bucket 'generated-documents' with owner-only policies (never public)
--
-- Rules enforced HERE (not just in the client):
--   * file names are safe by construction: FairPath_{Subject}_{YYYY-MM-DD}[_vN].{pdf|docx|csv} - no names, ids, spaces
--   * an 'official_form' document must carry an official_form_ref AND be server-generated (a device can never mint one)
--   * highly sensitive documents are on-demand: a stored copy exists only after an explicit "keep a copy" (30/90 days)
--   * metadata holds only allow-listed, non-identifying keys
--   * regeneration creates a NEW version linked to the previous one; nothing is overwritten
--   * members read their own rows; every write is a function (clients have no INSERT/UPDATE/DELETE)

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type ~ '^[a-z][a-z0-9_]{2,60}$'),
  source_module text not null check (source_module ~ '^[a-z][a-z0-9_]{1,40}$'),
  source_record_id uuid,
  title text not null check (length(btrim(title)) between 3 and 160),
  file_name text not null
    check (file_name ~ '^FairPath_[A-Za-z0-9]+(_[A-Za-z0-9]+)*_[0-9]{4}-[0-9]{2}-[0-9]{2}(_v[0-9]{1,3})?\.(pdf|docx|csv)$'),
  format text not null check (format in ('pdf', 'docx', 'csv')),
  kind text not null default 'summary'
    check (kind in ('summary', 'worksheet', 'letter', 'checklist', 'packet_part', 'official_form')),
  status text not null default 'ready' check (status in ('ready', 'failed', 'expired', 'deleted')),
  version integer not null default 1 check (version between 1 and 999),
  supersedes_id uuid references public.generated_documents(id) on delete set null,
  template_id text not null,
  template_version text not null,
  official_form_ref jsonb,
  generated_by text not null default 'server' check (generated_by in ('server', 'device')),
  sensitivity text not null default 'standard' check (sensitivity in ('standard', 'sensitive', 'highly_sensitive')),
  persist_policy text not null default 'on_demand' check (persist_policy in ('on_demand', 'history_only', 'stored')),
  storage_path text,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer check (byte_size is null or byte_size between 1 and 20971520),
  input_fingerprint text not null check (length(input_fingerprint) between 6 and 64),
  confirmed_data_at timestamptz not null default now(),
  expires_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and length(metadata::text) <= 2000),
  created_at timestamptz not null default now(),
  check (kind <> 'official_form' or (official_form_ref is not null and generated_by = 'server')),
  check (official_form_ref is null or (jsonb_typeof(official_form_ref) = 'object' and official_form_ref ? 'form_id' and official_form_ref ? 'source_url' and official_form_ref ? 'verified_at')),
  check (persist_policy <> 'stored' or (storage_path is not null and expires_at is not null)),
  check (status <> 'deleted' or (deleted_at is not null and storage_path is null))
);
create unique index if not exists generated_documents_version_idx
  on public.generated_documents (user_id, document_type, coalesce(source_record_id, '00000000-0000-0000-0000-000000000000'::uuid), version);
create index if not exists generated_documents_user_idx on public.generated_documents (user_id, created_at desc);
create index if not exists generated_documents_expiry_idx on public.generated_documents (expires_at) where status = 'ready' and expires_at is not null;

create table if not exists public.document_export_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('preview', 'download', 'share_sheet_opened', 'save_to_files', 'print', 'regenerate')),
  platform text not null check (platform in ('web', 'ios', 'android')),
  created_at timestamptz not null default now()
);
comment on table public.document_export_events is
  'Metadata only. "share_sheet_opened" means exactly that: the OS never tells us who received the file.';
create index if not exists document_export_events_doc_idx on public.document_export_events (document_id, created_at desc);
create index if not exists document_export_events_user_idx on public.document_export_events (user_id, created_at desc);

create table if not exists public.document_storage_cleanup (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  reason text not null check (reason in ('deleted_by_member', 'expired', 'superseded')),
  requested_at timestamptz not null default now()
);

alter table public.generated_documents enable row level security;
alter table public.document_export_events enable row level security;
alter table public.document_storage_cleanup enable row level security;

drop policy if exists "generated_documents_read_own" on public.generated_documents;
create policy "generated_documents_read_own" on public.generated_documents
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "document_export_events_read_own" on public.document_export_events;
create policy "document_export_events_read_own" on public.document_export_events
  for select to authenticated using (user_id = (select auth.uid()));

grant select on table public.generated_documents to authenticated;
grant select on table public.document_export_events to authenticated;
grant select, insert, update, delete on table public.generated_documents to service_role;
grant select, insert, update, delete on table public.document_export_events to service_role;
grant select, insert, update, delete on table public.document_storage_cleanup to service_role;

-- ---------------------------------------------------------------------
-- Private storage bucket (owner-only; never public; signed URLs are minted per explicit member action)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-documents', 'generated-documents', false, 20971520,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv'])
on conflict (id) do nothing;

drop policy if exists "generated_documents_objects_select_own" on storage.objects;
create policy "generated_documents_objects_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'generated-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "generated_documents_objects_insert_own" on storage.objects;
create policy "generated_documents_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'generated-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "generated_documents_objects_delete_own" on storage.objects;
create policy "generated_documents_objects_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'generated-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy: stored files are immutable (regeneration = a new version).

-- ---------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------
-- Subject -> a safe file-name token: letters/digits, words joined by underscores, capped. Never a member name.
create or replace function public.document_safe_token(p_text text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(left(regexp_replace(regexp_replace(btrim(coalesce(p_text, '')), '[^A-Za-z0-9]+', '_', 'g'), '^_+|_+$', '', 'g'), 60), ''), 'Document');
$$;

create or replace function public.document_file_name(p_subject text, p_ext text, p_version integer, p_on date)
returns text
language sql
immutable
as $$
  select 'FairPath_' || public.document_safe_token(p_subject) || '_' || to_char(p_on, 'YYYY-MM-DD')
         || case when coalesce(p_version, 1) > 1 then '_v' || p_version::text else '' end
         || '.' || p_ext;
$$;

-- ---------------------------------------------------------------------
-- Registration (metadata only). Callable by the member (device-generated summaries) or the service role (Edge Function).
-- ---------------------------------------------------------------------
create or replace function public.register_generated_document(
  p_document_type text,
  p_source_module text,
  p_source_record_id uuid,
  p_subject text,
  p_title text,
  p_format text,
  p_kind text,
  p_template_id text,
  p_template_version text,
  p_sensitivity text,
  p_input_fingerprint text,
  p_confirmed_data_at timestamptz,
  p_metadata jsonb default '{}'::jsonb,
  p_official_form_ref jsonb default null,
  p_target_user uuid default null
)
returns public.generated_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  uid uuid := case when is_service then coalesce(p_target_user, auth.uid()) else auth.uid() end;
  prev public.generated_documents%rowtype;
  next_version integer;
  fname text;
  result public.generated_documents%rowtype;
  bad_keys text[];
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_format not in ('pdf', 'docx', 'csv') then raise exception 'INVALID_FORMAT'; end if;

  -- A device can never mint an official form, and never a server-verified template.
  if not is_service and (p_kind = 'official_form' or p_official_form_ref is not null) then
    raise exception 'OFFICIAL_FORM_SERVER_ONLY';
  end if;

  -- Metadata is limited to non-identifying counters.
  select coalesce(array_agg(k), '{}') into bad_keys
  from jsonb_object_keys(coalesce(p_metadata, '{}'::jsonb)) k
  where k <> all (array['page_count', 'section_count', 'item_count', 'packet_position', 'packet_total', 'locale']);
  if cardinality(bad_keys) > 0 then raise exception 'METADATA_NOT_ALLOWED:%', array_to_string(bad_keys, ','); end if;

  select * into prev from public.generated_documents d
   where d.user_id = uid and d.document_type = p_document_type
     and d.source_record_id is not distinct from p_source_record_id
   order by d.version desc limit 1;
  next_version := coalesce(prev.version, 0) + 1;
  fname := public.document_file_name(p_subject, p_format, next_version, current_date);

  insert into public.generated_documents (
    user_id, document_type, source_module, source_record_id, title, file_name, format, kind, version, supersedes_id,
    template_id, template_version, official_form_ref, generated_by, sensitivity, persist_policy,
    input_fingerprint, confirmed_data_at, metadata
  ) values (
    uid, p_document_type, p_source_module, p_source_record_id, btrim(p_title), fname, p_format, coalesce(p_kind, 'summary'), next_version, prev.id,
    p_template_id, p_template_version, p_official_form_ref, case when is_service then 'server' else 'device' end,
    coalesce(p_sensitivity, 'standard'),
    -- Sensitive documents are metadata-only history until the member explicitly keeps a copy.
    case when coalesce(p_sensitivity, 'standard') = 'standard' then 'history_only' else 'on_demand' end,
    p_input_fingerprint, coalesce(p_confirmed_data_at, now()), coalesce(p_metadata, '{}'::jsonb)
  ) returning * into result;
  return result;
end;
$$;

-- Member: keep a stored copy for 30/90 days (standard documents may also choose 365). The file must already have been
-- uploaded to the member's own folder at the exact expected path, so a member cannot attach someone else's object.
create or replace function public.keep_document_copy(p_id uuid, p_days integer, p_bytes integer, p_checksum text)
returns public.generated_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.generated_documents%rowtype;
  expected text;
  result public.generated_documents%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into d from public.generated_documents x where x.id = p_id and x.user_id = uid;
  if not found or d.status <> 'ready' then raise exception 'DOCUMENT_UNAVAILABLE'; end if;
  if p_days not in (30, 90, 365) or (p_days = 365 and d.sensitivity <> 'standard') then raise exception 'INVALID_RETENTION'; end if;

  expected := uid::text || '/' || d.id::text || '/v' || d.version::text || '.' || d.format;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'generated-documents' and o.name = expected) then
    raise exception 'FILE_NOT_UPLOADED';
  end if;

  update public.generated_documents g
     set persist_policy = 'stored', storage_path = expected, expires_at = now() + make_interval(days => p_days),
         byte_size = p_bytes, checksum_sha256 = p_checksum
   where g.id = d.id
   returning * into result;
  return result;
end;
$$;

-- Member: delete a document. Removes the FairPath-stored copy (queued for storage cleanup) and keeps only a
-- metadata tombstone. A file the member already exported to a device or another app cannot be recalled.
create or replace function public.delete_generated_document(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.generated_documents%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into d from public.generated_documents x where x.id = p_id and x.user_id = uid;
  if not found then raise exception 'DOCUMENT_UNAVAILABLE'; end if;
  if d.storage_path is not null then
    insert into public.document_storage_cleanup (storage_path, reason) values (d.storage_path, 'deleted_by_member') on conflict do nothing;
  end if;
  update public.generated_documents g
     set status = 'deleted', deleted_at = now(), storage_path = null, expires_at = null, persist_policy = 'history_only'
   where g.id = d.id;
  return d.storage_path;
end;
$$;

create or replace function public.log_document_export(p_id uuid, p_action text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if not exists (select 1 from public.generated_documents d where d.id = p_id and d.user_id = uid and d.status = 'ready') then
    raise exception 'DOCUMENT_UNAVAILABLE';
  end if;
  insert into public.document_export_events (document_id, user_id, action, platform) values (p_id, uid, p_action, p_platform);
end;
$$;

-- Latest version of every document the member has (not deleted), with a flag for older versions.
create or replace function public.list_my_documents()
returns table (doc jsonb, is_latest boolean, export_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    to_jsonb(d) - 'user_id' - 'storage_path' - 'metadata' || jsonb_build_object('has_stored_copy', d.storage_path is not null),
    (d.version = max(d.version) over (partition by d.document_type, coalesce(d.source_record_id, '00000000-0000-0000-0000-000000000000'::uuid))),
    (select count(*) from public.document_export_events e where e.document_id = d.id)
  from public.generated_documents d
  where d.user_id = auth.uid() and d.status <> 'deleted'
  order by d.created_at desc, d.id;
$$;

-- Service: expire stored copies past their date and queue their objects for removal.
create or replace function public.expire_generated_documents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in select g.id, g.storage_path from public.generated_documents g
           where g.status = 'ready' and g.persist_policy = 'stored' and g.expires_at is not null and g.expires_at <= now() loop
    insert into public.document_storage_cleanup (storage_path, reason) values (r.storage_path, 'expired') on conflict do nothing;
    update public.generated_documents g set status = 'expired', storage_path = null, persist_policy = 'history_only' where g.id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.document_safe_token(text) from public;
revoke all on function public.document_file_name(text, text, integer, date) from public;
revoke all on function public.register_generated_document(text, text, uuid, text, text, text, text, text, text, text, text, timestamptz, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.keep_document_copy(uuid, integer, integer, text) from public, anon;
revoke all on function public.delete_generated_document(uuid) from public, anon;
revoke all on function public.log_document_export(uuid, text, text) from public, anon;
revoke all on function public.list_my_documents() from public, anon;
revoke all on function public.expire_generated_documents() from public, anon, authenticated;

grant execute on function public.document_safe_token(text) to authenticated, service_role;
grant execute on function public.document_file_name(text, text, integer, date) to authenticated, service_role;
grant execute on function public.register_generated_document(text, text, uuid, text, text, text, text, text, text, text, text, timestamptz, jsonb, jsonb, uuid) to authenticated, service_role;
grant execute on function public.keep_document_copy(uuid, integer, integer, text) to authenticated, service_role;
grant execute on function public.delete_generated_document(uuid) to authenticated, service_role;
grant execute on function public.log_document_export(uuid, text, text) to authenticated, service_role;
grant execute on function public.list_my_documents() to authenticated, service_role;
grant execute on function public.expire_generated_documents() to service_role;
