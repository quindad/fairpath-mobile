-- Credit Builder workspace (forward-only). Migration 7.
--
-- A member uploads (or enters) credit reports, reviews what was extracted, sees possible inaccuracies flagged by
-- deterministic rules, decides for THEMSELVES what to dispute, and tracks disputes to an outcome.
--
-- Principles (audited):
--   * Strict owner isolation: every table is owner-read only; all writes are security-definer functions. No employer,
--     partner or admin policy exists. Report files live in a private bucket with owner-only policies.
--   * Extraction is never presented as correct: extracted rows start 'needs_review'; the member confirms or corrects
--     (original extracted values are kept for audit). Only the last 4 digits of an account number are ever stored.
--   * Four separate concepts, four separate stages: negative_item / possible_inaccuracy / member_disputes_accuracy /
--     confirmed_dispute_issue. An accurate negative item is NOT a dispute: there is no path from negative_item to a
--     dispute without the member first stating what they believe is inaccurate, in their own words.
--   * No promises: nothing here predicts a score, promises deletion, or gives legal advice.
--   * Sample data exists only in DEV (load_credit_sample_report refuses unless app_config.environment = 'dev').
--   * Report files are retained 30 days by default (member may extend to 90 or delete any time); highly sensitive.

-- ---------------------------------------------------------------------
-- Private storage for uploaded reports
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credit-uploads', 'credit-uploads', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "credit_uploads_select_own" on storage.objects;
create policy "credit_uploads_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'credit-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "credit_uploads_insert_own" on storage.objects;
create policy "credit_uploads_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'credit-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "credit_uploads_delete_own" on storage.objects;
create policy "credit_uploads_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'credit-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.credit_report_uploads (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bureau text not null default 'unknown' check (bureau in ('equifax', 'experian', 'transunion', 'other', 'unknown')),
  file_kind text not null check (file_kind in ('pdf', 'image')),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  page_count integer check (page_count is null or page_count between 1 and 60),
  byte_size integer not null check (byte_size between 1 and 15728640),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'extracted', 'needs_review', 'failed', 'deleted')),
  failure_code text check (failure_code is null or failure_code in ('unreadable', 'unsupported_layout', 'too_many_pages', 'engine_unavailable', 'other')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  deleted_at timestamptz,
  check (status <> 'deleted' or storage_path is null)
);
create index if not exists credit_report_uploads_user_idx on public.credit_report_uploads (user_id, created_at desc);

create table if not exists public.credit_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.credit_report_uploads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  engine text check (engine is null or engine in ('fixture', 'ocr_v1', 'manual')),
  attempts integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
comment on table public.credit_extraction_jobs is
  'Boundary for the extraction pipeline. A worker (Edge Function / vision-OCR service) claims queued jobs and calls ingest_credit_extraction() with the service role. No engine is connected yet: DEV uses load_credit_sample_report().';

create table if not exists public.credit_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_id uuid references public.credit_report_uploads(id) on delete set null,
  bureau text not null check (bureau in ('equifax', 'experian', 'transunion', 'other', 'unknown')),
  report_date date,
  source text not null check (source in ('extracted', 'manual', 'fixture')),
  created_at timestamptz not null default now()
);
create index if not exists credit_reports_user_idx on public.credit_reports (user_id, created_at desc);

create table if not exists public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.credit_reports(id) on delete cascade,
  furnisher_name text not null check (length(btrim(furnisher_name)) between 2 and 120),
  account_type text not null default 'other' check (account_type in ('revolving', 'installment', 'mortgage', 'auto', 'student', 'collection', 'utility', 'other')),
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  original_creditor text check (original_creditor is null or length(original_creditor) <= 120),
  status_text text check (status_text is null or length(status_text) <= 80),
  payment_status text not null default 'unknown'
    check (payment_status in ('current', 'late_30', 'late_60', 'late_90', 'late_120_plus', 'collection', 'charged_off', 'settled', 'paid_closed', 'unknown')),
  is_collection boolean not null default false,
  is_charged_off boolean not null default false,
  opened_date date,
  closed_date date,
  last_reported_date date,
  first_delinquency_date date,
  balance_cents bigint check (balance_cents is null or balance_cents between 0 and 100000000000),
  credit_limit_cents bigint check (credit_limit_cents is null or credit_limit_cents between 0 and 100000000000),
  monthly_payment_cents bigint check (monthly_payment_cents is null or monthly_payment_cents between 0 and 100000000000),
  extraction_state text not null default 'needs_review' check (extraction_state in ('extracted', 'needs_review', 'member_confirmed', 'corrected_by_member')),
  low_confidence_fields text[] not null default '{}',
  extracted_values jsonb,
  member_says_not_mine boolean not null default false,
  member_notes text check (member_notes is null or length(member_notes) <= 1000),
  source text not null default 'extracted' check (source in ('extracted', 'manual', 'fixture')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_accounts_report_idx on public.credit_accounts (report_id);
create index if not exists credit_accounts_user_idx on public.credit_accounts (user_id, extraction_state);
comment on column public.credit_accounts.account_last4 is 'Only the last four digits are ever stored. Full account numbers are discarded at ingestion.';

create table if not exists public.credit_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.credit_reports(id) on delete cascade,
  inquirer_name text not null check (length(btrim(inquirer_name)) between 2 and 120),
  inquiry_date date,
  inquiry_kind text not null default 'hard' check (inquiry_kind in ('hard', 'soft', 'unknown')),
  extraction_state text not null default 'needs_review' check (extraction_state in ('extracted', 'needs_review', 'member_confirmed', 'corrected_by_member')),
  created_at timestamptz not null default now()
);
create index if not exists credit_inquiries_report_idx on public.credit_inquiries (report_id);

create table if not exists public.credit_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.credit_reports(id) on delete cascade,
  account_id uuid references public.credit_accounts(id) on delete cascade,
  issue_type text not null check (issue_type in (
    'negative_item', 'duplicate_account', 'conflicting_balance', 'conflicting_status', 'date_inconsistency',
    'not_mine_reported', 'missing_information', 'unclear_extraction', 'possible_outdated_item')),
  stage text not null default 'possible_inaccuracy'
    check (stage in ('negative_item', 'possible_inaccuracy', 'member_disputes_accuracy', 'confirmed_dispute_issue', 'dismissed')),
  origin text not null default 'rule' check (origin in ('rule', 'ai', 'member')),
  title text not null check (length(title) between 3 and 160),
  explanation text not null check (length(explanation) between 10 and 1200),
  evidence jsonb not null default '{}'::jsonb,
  member_statement text check (member_statement is null or length(member_statement) between 10 and 1500),
  dedupe_key text not null,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (stage not in ('member_disputes_accuracy', 'confirmed_dispute_issue') or member_statement is not null)
);
create unique index if not exists credit_review_items_dedupe_idx on public.credit_review_items (user_id, dedupe_key);
create index if not exists credit_review_items_user_idx on public.credit_review_items (user_id, stage);

create table if not exists public.credit_disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('bureau', 'furnisher')),
  target_name text not null check (length(btrim(target_name)) between 2 and 120),
  reason text not null check (length(btrim(reason)) between 10 and 1500),
  status text not null default 'draft' check (status in ('draft', 'sent', 'response_received', 'resolved', 'closed')),
  sent_on date,
  sent_method text check (sent_method is null or sent_method in ('mail', 'online', 'other')),
  tracking_reference text check (tracking_reference is null or length(tracking_reference) <= 80),
  response_due_on date,
  response_received_on date,
  outcome text check (outcome is null or outcome in ('verified_accurate', 'corrected', 'removed', 'no_response', 'other')),
  outcome_notes text check (outcome_notes is null or length(outcome_notes) <= 1000),
  follow_up_on date,
  notes text check (notes is null or length(notes) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or sent_on is not null),
  check (response_received_on is null or sent_on is null or response_received_on >= sent_on)
);
create index if not exists credit_disputes_user_idx on public.credit_disputes (user_id, status);

create table if not exists public.credit_dispute_items (
  dispute_id uuid not null references public.credit_disputes(id) on delete cascade,
  item_id uuid not null references public.credit_review_items(id) on delete cascade,
  primary key (dispute_id, item_id)
);

create table if not exists public.credit_dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.credit_disputes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'marked_sent', 'response_recorded', 'follow_up_set', 'notes_updated', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists credit_dispute_events_dispute_idx on public.credit_dispute_events (dispute_id, created_at);

create table if not exists public.credit_dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.credit_disputes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (length(btrim(description)) between 3 and 300),
  generated_document_id uuid references public.generated_documents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS: owner-read only; every write is a function. No employer/partner/admin access.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['credit_report_uploads', 'credit_extraction_jobs', 'credit_reports', 'credit_accounts', 'credit_inquiries',
                           'credit_review_items', 'credit_disputes', 'credit_dispute_events', 'credit_dispute_evidence'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_owner_read" on public.%I', t, t);
    execute format('create policy "%s_owner_read" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
alter table public.credit_dispute_items enable row level security;
drop policy if exists "credit_dispute_items_owner_read" on public.credit_dispute_items;
create policy "credit_dispute_items_owner_read" on public.credit_dispute_items for select to authenticated
  using (exists (select 1 from public.credit_disputes d where d.id = dispute_id and d.user_id = (select auth.uid())));
grant select on table public.credit_dispute_items to authenticated;
grant select, insert, update, delete on table public.credit_dispute_items to service_role;

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------
create or replace function public.credit_norm(p text)
returns text language sql immutable as $$ select lower(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Ingestion of a normalized report (service role, or the DEV sample loader). Every consequential field starts as
-- needs_review; the member must confirm or correct it. Full account numbers are never stored: only the last 4 digits.
create or replace function public.ingest_credit_report(p_user uuid, p_upload uuid, p_payload jsonb, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  a jsonb;
  i jsonb;
  digits text;
begin
  insert into public.credit_reports (user_id, upload_id, bureau, report_date, source)
  values (p_user, p_upload, coalesce(p_payload ->> 'bureau', 'unknown'), nullif(p_payload ->> 'report_date', '')::date, p_source)
  returning id into rid;

  for a in select * from jsonb_array_elements(coalesce(p_payload -> 'accounts', '[]'::jsonb)) loop
    digits := regexp_replace(coalesce(a ->> 'account_number', a ->> 'account_last4', ''), '[^0-9]', '', 'g');
    insert into public.credit_accounts (
      user_id, report_id, furnisher_name, account_type, account_last4, original_creditor, status_text, payment_status, is_collection, is_charged_off,
      opened_date, closed_date, last_reported_date, first_delinquency_date, balance_cents, credit_limit_cents, monthly_payment_cents,
      extraction_state, low_confidence_fields, source)
    values (
      p_user, rid, left(btrim(a ->> 'furnisher_name'), 120), coalesce(a ->> 'account_type', 'other'),
      case when length(digits) >= 4 then right(digits, 4) else null end,
      left(nullif(a ->> 'original_creditor', ''), 120), left(nullif(a ->> 'status_text', ''), 80), coalesce(a ->> 'payment_status', 'unknown'),
      coalesce((a ->> 'is_collection')::boolean, false), coalesce((a ->> 'is_charged_off')::boolean, false),
      nullif(a ->> 'opened_date', '')::date, nullif(a ->> 'closed_date', '')::date, nullif(a ->> 'last_reported_date', '')::date, nullif(a ->> 'first_delinquency_date', '')::date,
      nullif(a ->> 'balance_cents', '')::bigint, nullif(a ->> 'credit_limit_cents', '')::bigint, nullif(a ->> 'monthly_payment_cents', '')::bigint,
      'needs_review', coalesce(array(select jsonb_array_elements_text(coalesce(a -> 'low_confidence_fields', '[]'::jsonb))), '{}'), p_source);
  end loop;

  for i in select * from jsonb_array_elements(coalesce(p_payload -> 'inquiries', '[]'::jsonb)) loop
    insert into public.credit_inquiries (user_id, report_id, inquirer_name, inquiry_date, inquiry_kind, extraction_state)
    values (p_user, rid, left(btrim(i ->> 'inquirer_name'), 120), nullif(i ->> 'inquiry_date', '')::date, coalesce(i ->> 'inquiry_kind', 'unknown'), 'needs_review');
  end loop;
  return rid;
end;
$$;
revoke all on function public.ingest_credit_report(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_credit_report(uuid, uuid, jsonb, text) to service_role;

-- Service: the extraction worker's entry point.
create or replace function public.ingest_credit_extraction(p_upload uuid, p_payload jsonb, p_engine text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  up public.credit_report_uploads%rowtype;
  rid uuid;
begin
  select * into up from public.credit_report_uploads u where u.id = p_upload;
  if not found or up.status = 'deleted' then raise exception 'UPLOAD_UNAVAILABLE'; end if;
  rid := public.ingest_credit_report(up.user_id, up.id, p_payload, 'extracted');
  update public.credit_report_uploads u set status = 'needs_review', processed_at = now() where u.id = up.id;
  update public.credit_extraction_jobs j set status = 'succeeded', engine = p_engine, finished_at = now(), attempts = j.attempts + 1 where j.upload_id = up.id and j.status in ('queued', 'running');
  return rid;
end;
$$;
revoke all on function public.ingest_credit_extraction(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_credit_extraction(uuid, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- Uploads
-- ---------------------------------------------------------------------
create or replace function public.register_credit_upload(p_upload_id uuid, p_bureau text, p_ext text, p_pages integer, p_bytes integer, p_mime text, p_checksum text)
returns public.credit_report_uploads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  expected text;
  result public.credit_report_uploads%rowtype;
  n integer;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_ext not in ('pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif') then raise exception 'UNSUPPORTED_TYPE'; end if;
  if p_bytes is null or p_bytes < 1 or p_bytes > 15728640 then raise exception 'FILE_TOO_LARGE'; end if;
  if p_pages is not null and p_pages > 60 then raise exception 'TOO_MANY_PAGES'; end if;
  select count(*) into n from public.credit_report_uploads u where u.user_id = uid and u.status <> 'deleted';
  if n >= 20 then raise exception 'UPLOAD_LIMIT'; end if;

  expected := uid::text || '/' || p_upload_id::text || '/report.' || p_ext;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'credit-uploads' and o.name = expected) then
    raise exception 'FILE_NOT_UPLOADED';
  end if;

  insert into public.credit_report_uploads (id, user_id, bureau, file_kind, mime_type, page_count, byte_size, checksum_sha256, storage_path, status)
  values (p_upload_id, uid, coalesce(nullif(p_bureau, ''), 'unknown'), case when p_ext = 'pdf' then 'pdf' else 'image' end, p_mime, p_pages, p_bytes, p_checksum, expected, 'uploaded')
  returning * into result;
  insert into public.credit_extraction_jobs (upload_id, user_id) values (p_upload_id, uid);
  return result;
end;
$$;

create or replace function public.extend_credit_upload_retention(p_id uuid, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_expiry timestamptz;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_days not in (30, 90) then raise exception 'INVALID_RETENTION'; end if;
  update public.credit_report_uploads u set expires_at = now() + make_interval(days => p_days)
   where u.id = p_id and u.user_id = uid and u.status <> 'deleted' returning u.expires_at into new_expiry;
  if new_expiry is null then raise exception 'UPLOAD_UNAVAILABLE'; end if;
  return new_expiry;
end;
$$;

create or replace function public.delete_credit_upload(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  up public.credit_report_uploads%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into up from public.credit_report_uploads u where u.id = p_id and u.user_id = uid;
  if not found then raise exception 'UPLOAD_UNAVAILABLE'; end if;
  if up.storage_path is not null then
    insert into public.document_storage_cleanup (bucket, storage_path, reason) values ('credit-uploads', up.storage_path, 'deleted_by_member') on conflict do nothing;
  end if;
  update public.credit_report_uploads u set status = 'deleted', deleted_at = now(), storage_path = null where u.id = up.id;
  update public.credit_extraction_jobs j set status = 'failed', error_code = 'deleted' where j.upload_id = up.id and j.status in ('queued', 'running');
  return up.storage_path;
end;
$$;

-- Service: uploads past their retention date are removed (file queued for cleanup; normalized data the member kept stays).
create or replace function public.expire_credit_uploads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in select u.id, u.storage_path from public.credit_report_uploads u where u.status <> 'deleted' and u.expires_at <= now() loop
    if r.storage_path is not null then
      insert into public.document_storage_cleanup (bucket, storage_path, reason) values ('credit-uploads', r.storage_path, 'expired') on conflict do nothing;
    end if;
    update public.credit_report_uploads u set status = 'deleted', deleted_at = now(), storage_path = null where u.id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.delete_credit_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  delete from public.credit_reports r where r.id = p_id and r.user_id = uid;
  if not found then raise exception 'REPORT_UNAVAILABLE'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- DEV-only sample reports (clearly marked source = 'fixture'; refuses anywhere else)
-- ---------------------------------------------------------------------
create or replace function public.load_credit_sample_report()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  env text;
  tu uuid;
  eq uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select c.value #>> '{}' into env from public.app_config c where c.key = 'environment';
  if coalesce(env, '') <> 'dev' then raise exception 'SAMPLE_DATA_DEV_ONLY'; end if;
  if exists (select 1 from public.credit_reports r where r.user_id = uid and r.source = 'fixture') then raise exception 'SAMPLE_ALREADY_LOADED'; end if;

  tu := public.ingest_credit_report(uid, null, jsonb_build_object('bureau', 'transunion', 'report_date', (current_date - 20)::text, 'accounts', jsonb_build_array(
    jsonb_build_object('furnisher_name', 'Lakeside Auto Finance', 'account_type', 'auto', 'account_number', '000000004421', 'payment_status', 'current', 'opened_date', '2022-03-10', 'last_reported_date', (current_date - 25)::text, 'balance_cents', 820000, 'credit_limit_cents', 1800000, 'monthly_payment_cents', 41500),
    jsonb_build_object('furnisher_name', 'Metro Credit Card', 'account_type', 'revolving', 'account_number', '5100007788', 'payment_status', 'late_30', 'opened_date', '2019-05-02', 'last_reported_date', (current_date - 30)::text, 'balance_cents', 265000, 'credit_limit_cents', 300000, 'monthly_payment_cents', 8000, 'first_delinquency_date', (current_date - 60)::text),
    jsonb_build_object('furnisher_name', 'Metro Credit Card', 'account_type', 'revolving', 'account_number', '5100007788', 'payment_status', 'late_30', 'opened_date', '2019-05-02', 'last_reported_date', (current_date - 30)::text, 'balance_cents', 265000, 'credit_limit_cents', 300000),
    jsonb_build_object('furnisher_name', 'Riverbend Collections', 'account_type', 'collection', 'original_creditor', 'Riverbend Medical Group', 'account_number', '1102', 'payment_status', 'collection', 'is_collection', true, 'opened_date', '2016-01-15', 'first_delinquency_date', '2015-06-01', 'last_reported_date', (current_date - 40)::text, 'balance_cents', 64000),
    jsonb_build_object('furnisher_name', 'Sunrise Utilities', 'account_type', 'utility', 'account_number', '3350', 'payment_status', 'paid_closed', 'opened_date', '2019-01-01', 'closed_date', '2018-02-01', 'balance_cents', 0, 'low_confidence_fields', jsonb_build_array('closed_date')),
    jsonb_build_object('furnisher_name', 'Unknown Lender LLC', 'account_type', 'installment', 'account_number', '9931', 'payment_status', 'current', 'opened_date', (current_date - 400)::text, 'balance_cents', 120000, 'monthly_payment_cents', 9900)
  ), 'inquiries', jsonb_build_array(
    jsonb_build_object('inquirer_name', 'Lakeside Auto Finance', 'inquiry_date', '2022-03-01', 'inquiry_kind', 'hard'),
    jsonb_build_object('inquirer_name', 'Unknown Lender LLC', 'inquiry_date', (current_date - 410)::text, 'inquiry_kind', 'hard'))), 'fixture');

  eq := public.ingest_credit_report(uid, null, jsonb_build_object('bureau', 'equifax', 'report_date', (current_date - 15)::text, 'accounts', jsonb_build_array(
    jsonb_build_object('furnisher_name', 'Lakeside Auto Finance', 'account_type', 'auto', 'account_number', '4421', 'payment_status', 'current', 'opened_date', '2022-03-10', 'last_reported_date', (current_date - 20)::text, 'balance_cents', 510000, 'credit_limit_cents', 1800000, 'monthly_payment_cents', 41500),
    jsonb_build_object('furnisher_name', 'Metro Credit Card', 'account_type', 'revolving', 'account_number', '7788', 'payment_status', 'current', 'opened_date', '2019-05-02', 'last_reported_date', (current_date - 22)::text, 'balance_cents', 262000, 'credit_limit_cents', 300000, 'monthly_payment_cents', 8000),
    jsonb_build_object('furnisher_name', 'Harbor Bank Card', 'account_type', 'revolving', 'account_number', '2044', 'payment_status', 'current', 'opened_date', '2021-08-09', 'last_reported_date', (current_date - 18)::text, 'balance_cents', 15000, 'credit_limit_cents', 100000, 'low_confidence_fields', jsonb_build_array('balance_cents'))
  ), 'inquiries', '[]'::jsonb), 'fixture');

  perform public.run_credit_review(tu);
  perform public.run_credit_review(eq);
  return 2;
end;
$$;

-- ---------------------------------------------------------------------
-- Member edits: confirm / correct / add / not-mine
-- ---------------------------------------------------------------------
create or replace function public.confirm_credit_account(p_id uuid, p_corrections jsonb default '{}'::jsonb)
returns public.credit_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.credit_accounts%rowtype;
  c jsonb := coalesce(p_corrections, '{}'::jsonb);
  changed boolean := false;
  original jsonb;
  result public.credit_accounts%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into a from public.credit_accounts x where x.id = p_id and x.user_id = uid;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;

  original := jsonb_build_object('furnisher_name', a.furnisher_name, 'payment_status', a.payment_status, 'opened_date', a.opened_date, 'closed_date', a.closed_date,
    'balance_cents', a.balance_cents, 'credit_limit_cents', a.credit_limit_cents, 'last_reported_date', a.last_reported_date, 'first_delinquency_date', a.first_delinquency_date);

  if c ? 'furnisher_name' and length(btrim(c ->> 'furnisher_name')) >= 2 and btrim(c ->> 'furnisher_name') is distinct from a.furnisher_name then a.furnisher_name := left(btrim(c ->> 'furnisher_name'), 120); changed := true; end if;
  if c ? 'payment_status' and (c ->> 'payment_status') is distinct from a.payment_status then a.payment_status := c ->> 'payment_status'; changed := true; end if;
  if c ? 'opened_date' and nullif(c ->> 'opened_date', '')::date is distinct from a.opened_date then a.opened_date := nullif(c ->> 'opened_date', '')::date; changed := true; end if;
  if c ? 'closed_date' and nullif(c ->> 'closed_date', '')::date is distinct from a.closed_date then a.closed_date := nullif(c ->> 'closed_date', '')::date; changed := true; end if;
  if c ? 'last_reported_date' and nullif(c ->> 'last_reported_date', '')::date is distinct from a.last_reported_date then a.last_reported_date := nullif(c ->> 'last_reported_date', '')::date; changed := true; end if;
  if c ? 'first_delinquency_date' and nullif(c ->> 'first_delinquency_date', '')::date is distinct from a.first_delinquency_date then a.first_delinquency_date := nullif(c ->> 'first_delinquency_date', '')::date; changed := true; end if;
  if c ? 'balance_cents' and nullif(c ->> 'balance_cents', '')::bigint is distinct from a.balance_cents then a.balance_cents := nullif(c ->> 'balance_cents', '')::bigint; changed := true; end if;
  if c ? 'credit_limit_cents' and nullif(c ->> 'credit_limit_cents', '')::bigint is distinct from a.credit_limit_cents then a.credit_limit_cents := nullif(c ->> 'credit_limit_cents', '')::bigint; changed := true; end if;

  update public.credit_accounts x set
    furnisher_name = a.furnisher_name, payment_status = a.payment_status, opened_date = a.opened_date, closed_date = a.closed_date,
    last_reported_date = a.last_reported_date, first_delinquency_date = a.first_delinquency_date, balance_cents = a.balance_cents, credit_limit_cents = a.credit_limit_cents,
    is_collection = (a.payment_status = 'collection' or x.is_collection), is_charged_off = (a.payment_status = 'charged_off' or x.is_charged_off),
    extraction_state = case when changed then 'corrected_by_member' else 'member_confirmed' end,
    extracted_values = case when changed and x.extracted_values is null then original else x.extracted_values end,
    low_confidence_fields = '{}', updated_at = now()
  where x.id = a.id returning * into result;
  perform public.run_credit_review(result.report_id);
  return result;
end;
$$;

create or replace function public.add_credit_account(p_report uuid, p jsonb)
returns public.credit_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  digits text := regexp_replace(coalesce(p ->> 'account_number', ''), '[^0-9]', '', 'g');
  result public.credit_accounts%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if not exists (select 1 from public.credit_reports r where r.id = p_report and r.user_id = uid) then raise exception 'REPORT_UNAVAILABLE'; end if;
  insert into public.credit_accounts (user_id, report_id, furnisher_name, account_type, account_last4, payment_status, is_collection, is_charged_off, opened_date, closed_date, last_reported_date, balance_cents, credit_limit_cents, extraction_state, source)
  values (uid, p_report, left(btrim(p ->> 'furnisher_name'), 120), coalesce(p ->> 'account_type', 'other'), case when length(digits) >= 4 then right(digits, 4) else null end,
          coalesce(p ->> 'payment_status', 'unknown'), (p ->> 'payment_status') = 'collection', (p ->> 'payment_status') = 'charged_off',
          nullif(p ->> 'opened_date', '')::date, nullif(p ->> 'closed_date', '')::date, nullif(p ->> 'last_reported_date', '')::date,
          nullif(p ->> 'balance_cents', '')::bigint, nullif(p ->> 'credit_limit_cents', '')::bigint, 'member_confirmed', 'manual')
  returning * into result;
  perform public.run_credit_review(p_report);
  return result;
end;
$$;

create or replace function public.create_manual_credit_report(p_bureau text, p_report_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  insert into public.credit_reports (user_id, bureau, report_date, source) values (uid, coalesce(nullif(p_bureau, ''), 'unknown'), p_report_date, 'manual') returning id into rid;
  return rid;
end;
$$;

-- The member says an account is not theirs: that is the MEMBER'S claim (their words), tracked separately from anything FairPath flags.
create or replace function public.flag_credit_account_not_mine(p_account uuid, p_statement text)
returns public.credit_review_items
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.credit_accounts%rowtype;
  result public.credit_review_items%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if length(btrim(coalesce(p_statement, ''))) < 10 then raise exception 'STATEMENT_REQUIRED'; end if;
  select * into a from public.credit_accounts x where x.id = p_account and x.user_id = uid;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  update public.credit_accounts x set member_says_not_mine = true, updated_at = now() where x.id = a.id;
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, member_statement, dedupe_key)
  values (uid, a.report_id, a.id, 'not_mine_reported', 'member_disputes_accuracy', 'member', 'You said this account is not yours',
          'You told us this account does not belong to you. FairPath cannot verify that. If it is true, you may have grounds to dispute it, and you may also want to check for identity theft.',
          jsonb_build_object('furnisher', a.furnisher_name, 'last4', a.account_last4), btrim(p_statement), 'notmine:' || a.id)
  on conflict (user_id, dedupe_key) do update set member_statement = btrim(p_statement), stage_changed_at = now()
  returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Deterministic review rules
-- ---------------------------------------------------------------------
-- These flag things worth a second look. They do not decide anything. A "possible inaccuracy" is a question for the
-- member, and a negative item that is accurate is not a dispute.
create or replace function public.run_credit_review(p_report uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  n integer := 0;
  c integer;
begin
  select r.user_id into owner from public.credit_reports r where r.id = p_report;
  if owner is null then raise exception 'REPORT_UNAVAILABLE'; end if;
  -- Callable by the owner, or by other definer functions/service role acting for the owner.
  if uid is not null and uid <> owner then raise exception 'REPORT_UNAVAILABLE'; end if;

  -- Only untouched rule findings are rebuilt; anything the member advanced is left exactly as it is.
  delete from public.credit_review_items i
   where i.report_id = p_report and i.user_id = owner and i.origin = 'rule' and i.stage in ('negative_item', 'possible_inaccuracy');

  -- R1: negative items (informational; accurate negative information is not a dispute by itself)
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'negative_item', 'negative_item', 'rule',
         a.furnisher_name || ': negative item',
         'This account shows negative information. Negative information that is accurate generally is not removable, so a dispute is only worth considering if something on it is wrong. Check each detail against your own records.',
         jsonb_build_object('payment_status', a.payment_status, 'is_collection', a.is_collection, 'is_charged_off', a.is_charged_off, 'balance_cents', a.balance_cents),
         'neg:' || a.id
  from public.credit_accounts a
  where a.report_id = p_report and not a.member_says_not_mine
    and (a.is_collection or a.is_charged_off or a.payment_status in ('late_30', 'late_60', 'late_90', 'late_120_plus', 'collection', 'charged_off'))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- R2: possible duplicate listing inside one report
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'duplicate_account', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ' may be listed twice',
         'Two accounts on this report have the same creditor, the same last four digits and the same open date. That can be a duplicate listing. Compare them before deciding anything.',
         jsonb_build_object('account_ids', jsonb_build_array(a.id, b.id), 'furnisher', a.furnisher_name, 'last4', a.account_last4, 'opened_date', a.opened_date),
         'dup:' || a.id || ':' || b.id
  from public.credit_accounts a
  join public.credit_accounts b on b.report_id = a.report_id and b.id > a.id
   and public.credit_norm(a.furnisher_name) = public.credit_norm(b.furnisher_name)
   and a.account_last4 is not null and a.account_last4 = b.account_last4 and a.opened_date is not distinct from b.opened_date and a.opened_date is not null
  where a.report_id = p_report
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- R3 / R4: same account, different bureau reports, conflicting balance or status
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'conflicting_balance', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ': balances differ between reports',
         'The same account shows different balances on two reports that were dated close together. That can happen with timing, but it is worth checking which figure matches your statements.',
         jsonb_build_object('this_report_balance_cents', a.balance_cents, 'other_report_balance_cents', b.balance_cents, 'other_report_id', b.report_id, 'furnisher', a.furnisher_name, 'last4', a.account_last4),
         'bal:' || public.credit_norm(a.furnisher_name) || ':' || a.account_last4 || ':' || least(a.report_id, b.report_id) || ':' || greatest(a.report_id, b.report_id)
  from public.credit_accounts a
  join public.credit_accounts b on b.user_id = a.user_id and b.report_id <> a.report_id
   and public.credit_norm(a.furnisher_name) = public.credit_norm(b.furnisher_name) and a.account_last4 is not null and a.account_last4 = b.account_last4
  where a.report_id = p_report and a.balance_cents is not null and b.balance_cents is not null
    and abs(a.balance_cents - b.balance_cents) > greatest(1000, 0.10 * greatest(a.balance_cents, b.balance_cents))
    and abs(coalesce(a.last_reported_date, current_date) - coalesce(b.last_reported_date, current_date)) <= 60
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'conflicting_status', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ': status differs between reports',
         'One report shows this account as ' || replace(a.payment_status, '_', ' ') || ' and another shows ' || replace(b.payment_status, '_', ' ') || '. Check your own payment records to see which is right.',
         jsonb_build_object('this_report_status', a.payment_status, 'other_report_status', b.payment_status, 'other_report_id', b.report_id, 'furnisher', a.furnisher_name, 'last4', a.account_last4),
         'stat:' || public.credit_norm(a.furnisher_name) || ':' || a.account_last4 || ':' || least(a.report_id, b.report_id) || ':' || greatest(a.report_id, b.report_id)
  from public.credit_accounts a
  join public.credit_accounts b on b.user_id = a.user_id and b.report_id <> a.report_id
   and public.credit_norm(a.furnisher_name) = public.credit_norm(b.furnisher_name) and a.account_last4 is not null and a.account_last4 = b.account_last4
  where a.report_id = p_report and a.payment_status <> b.payment_status and a.payment_status <> 'unknown' and b.payment_status <> 'unknown'
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- R5: dates that cannot all be true
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'date_inconsistency', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ': dates do not line up',
         'The dates on this account cannot all be correct (for example, closed before it opened). It may be a reporting error, or the date may have been read incorrectly from the file.',
         jsonb_build_object('opened_date', a.opened_date, 'closed_date', a.closed_date, 'last_reported_date', a.last_reported_date),
         'date:' || a.id
  from public.credit_accounts a
  where a.report_id = p_report and not a.member_says_not_mine
    and ((a.closed_date is not null and a.opened_date is not null and a.closed_date < a.opened_date)
      or (a.last_reported_date is not null and a.opened_date is not null and a.last_reported_date < a.opened_date)
      or (a.opened_date is not null and a.opened_date > current_date))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- R6: negative account missing the dates that matter
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'missing_information', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ': missing dates',
         'This negative account is missing an open date or a first-delinquency date, which makes it hard to check. Add them if you have them from your own records.',
         jsonb_build_object('opened_date', a.opened_date, 'first_delinquency_date', a.first_delinquency_date),
         'miss:' || a.id
  from public.credit_accounts a
  where a.report_id = p_report and not a.member_says_not_mine
    and (a.is_collection or a.is_charged_off or a.payment_status in ('late_30', 'late_60', 'late_90', 'late_120_plus', 'collection', 'charged_off'))
    and (a.opened_date is null or (a.first_delinquency_date is null and (a.is_collection or a.is_charged_off)))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- R7: an old negative item. Reporting-period rules are a legal matter: this is a prompt to verify with the official sources.
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'possible_outdated_item', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ': old negative item',
         'The first-delinquency date on this item is more than 7 years ago. Negative items are generally only reported for a limited time, but the exact rules depend on the item. Check the dates and the official guidance before deciding anything.',
         jsonb_build_object('first_delinquency_date', a.first_delinquency_date, 'years_ago', extract(year from age(current_date, a.first_delinquency_date))),
         'old:' || a.id
  from public.credit_accounts a
  where a.report_id = p_report and not a.member_says_not_mine and a.first_delinquency_date is not null
    and a.first_delinquency_date < (current_date - interval '7 years')::date
    and (a.is_collection or a.is_charged_off or a.payment_status in ('late_30', 'late_60', 'late_90', 'late_120_plus', 'collection', 'charged_off'))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- R8: extraction the member has not reviewed / low-confidence reads
  insert into public.credit_review_items (user_id, report_id, account_id, issue_type, stage, origin, title, explanation, evidence, dedupe_key)
  select owner, p_report, a.id, 'unclear_extraction', 'possible_inaccuracy', 'rule',
         a.furnisher_name || ': confirm what was read',
         'Some details on this account were hard to read from the file. Please confirm or correct them so nothing is built on a misread number.',
         jsonb_build_object('fields', to_jsonb(a.low_confidence_fields)),
         'unclear:' || a.id
  from public.credit_accounts a
  where a.report_id = p_report and a.extraction_state in ('needs_review', 'extracted') and cardinality(a.low_confidence_fields) > 0
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- The four stages
-- ---------------------------------------------------------------------
-- negative_item -> (member states what is wrong) -> member_disputes_accuracy -> (member confirms) -> confirmed_dispute_issue.
-- There is no path from negative_item or possible_inaccuracy straight to a confirmed dispute issue.
create or replace function public.set_credit_item_stage(p_item uuid, p_stage text, p_statement text default null)
returns public.credit_review_items
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.credit_review_items%rowtype;
  stmt text := nullif(btrim(coalesce(p_statement, '')), '');
  result public.credit_review_items%rowtype;
  reopen_to text;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into it from public.credit_review_items x where x.id = p_item and x.user_id = uid;
  if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
  if exists (select 1 from public.credit_dispute_items di join public.credit_disputes d on d.id = di.dispute_id where di.item_id = it.id and d.status in ('sent', 'response_received')) then
    raise exception 'ITEM_IN_ACTIVE_DISPUTE';
  end if;

  if p_stage = 'member_disputes_accuracy' then
    if it.stage not in ('negative_item', 'possible_inaccuracy', 'dismissed') then raise exception 'INVALID_TRANSITION'; end if;
    if stmt is null or length(stmt) < 10 then raise exception 'STATEMENT_REQUIRED'; end if;
  elsif p_stage = 'confirmed_dispute_issue' then
    if it.stage <> 'member_disputes_accuracy' then raise exception 'INVALID_TRANSITION'; end if;
    stmt := coalesce(stmt, it.member_statement);
    if stmt is null or length(stmt) < 10 then raise exception 'STATEMENT_REQUIRED'; end if;
  elsif p_stage = 'dismissed' then
    if it.stage = 'confirmed_dispute_issue' then raise exception 'INVALID_TRANSITION'; end if;
  elsif p_stage = 'reopen' then
    if it.stage not in ('dismissed', 'member_disputes_accuracy') then raise exception 'INVALID_TRANSITION'; end if;
    reopen_to := case when it.issue_type = 'negative_item' then 'negative_item' else 'possible_inaccuracy' end;
  else
    raise exception 'INVALID_STAGE';
  end if;

  update public.credit_review_items x set
    stage = case when p_stage = 'reopen' then reopen_to else p_stage end,
    member_statement = case when p_stage in ('member_disputes_accuracy', 'confirmed_dispute_issue') then stmt when p_stage = 'reopen' then null else x.member_statement end,
    stage_changed_at = now()
  where x.id = it.id returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Disputes and the tracker
-- ---------------------------------------------------------------------
create or replace function public.create_credit_dispute(p_target_kind text, p_target_name text, p_item_ids uuid[], p_reason text)
returns public.credit_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.credit_disputes%rowtype;
  n_ok integer;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_target_kind not in ('bureau', 'furnisher') then raise exception 'INVALID_TARGET'; end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0 then raise exception 'ITEMS_REQUIRED'; end if;
  select count(*) into n_ok from public.credit_review_items i where i.id = any (p_item_ids) and i.user_id = uid and i.stage = 'confirmed_dispute_issue';
  if n_ok <> cardinality(p_item_ids) then raise exception 'ITEMS_NOT_CONFIRMED'; end if;

  insert into public.credit_disputes (user_id, target_kind, target_name, reason) values (uid, p_target_kind, btrim(p_target_name), btrim(p_reason)) returning * into d;
  insert into public.credit_dispute_items (dispute_id, item_id) select d.id, x from unnest(p_item_ids) x;
  insert into public.credit_dispute_events (dispute_id, user_id, event_type) values (d.id, uid, 'created');
  return d;
end;
$$;

create or replace function public.mark_credit_dispute_sent(p_id uuid, p_sent_on date, p_method text, p_reference text default null, p_response_window_days integer default 30)
returns public.credit_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.credit_disputes%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_sent_on is null or p_sent_on > current_date then raise exception 'INVALID_DATE'; end if;
  if p_method not in ('mail', 'online', 'other') then raise exception 'INVALID_METHOD'; end if;
  update public.credit_disputes x set status = 'sent', sent_on = p_sent_on, sent_method = p_method, tracking_reference = nullif(left(btrim(coalesce(p_reference, '')), 80), ''),
         response_due_on = p_sent_on + least(greatest(coalesce(p_response_window_days, 30), 15), 90), updated_at = now()
   where x.id = p_id and x.user_id = uid and x.status = 'draft' returning * into d;
  if not found then raise exception 'DISPUTE_UNAVAILABLE'; end if;
  insert into public.credit_dispute_events (dispute_id, user_id, event_type) values (d.id, uid, 'marked_sent');
  return d;
end;
$$;

create or replace function public.record_credit_dispute_response(p_id uuid, p_received_on date, p_outcome text, p_notes text default null)
returns public.credit_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.credit_disputes%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if p_outcome not in ('verified_accurate', 'corrected', 'removed', 'no_response', 'other') then raise exception 'INVALID_OUTCOME'; end if;
  if p_received_on is null or p_received_on > current_date then raise exception 'INVALID_DATE'; end if;
  update public.credit_disputes x set status = case when p_outcome = 'no_response' then 'sent' else 'response_received' end,
         response_received_on = case when p_outcome = 'no_response' then null else p_received_on end,
         outcome = p_outcome, outcome_notes = nullif(left(btrim(coalesce(p_notes, '')), 1000), ''), updated_at = now()
   where x.id = p_id and x.user_id = uid and x.status in ('sent', 'response_received') returning * into d;
  if not found then raise exception 'DISPUTE_UNAVAILABLE'; end if;
  insert into public.credit_dispute_events (dispute_id, user_id, event_type) values (d.id, uid, 'response_recorded');
  return d;
end;
$$;

create or replace function public.update_credit_dispute(p_id uuid, p_follow_up_on date default null, p_notes text default null, p_close boolean default false)
returns public.credit_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.credit_disputes%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  update public.credit_disputes x set
    follow_up_on = coalesce(p_follow_up_on, x.follow_up_on),
    notes = case when p_notes is null then x.notes else nullif(left(btrim(p_notes), 1500), '') end,
    status = case when p_close then 'closed' when x.status = 'response_received' and x.outcome is not null and p_close then 'resolved' else x.status end,
    updated_at = now()
  where x.id = p_id and x.user_id = uid returning * into d;
  if not found then raise exception 'DISPUTE_UNAVAILABLE'; end if;
  insert into public.credit_dispute_events (dispute_id, user_id, event_type) values (d.id, uid, case when p_close then 'closed' when p_follow_up_on is not null then 'follow_up_set' else 'notes_updated' end);
  return d;
end;
$$;

create or replace function public.add_credit_dispute_evidence(p_dispute uuid, p_description text, p_document uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if not exists (select 1 from public.credit_disputes d where d.id = p_dispute and d.user_id = uid) then raise exception 'DISPUTE_UNAVAILABLE'; end if;
  if p_document is not null and not exists (select 1 from public.generated_documents g where g.id = p_document and g.user_id = uid) then raise exception 'DOCUMENT_UNAVAILABLE'; end if;
  insert into public.credit_dispute_evidence (dispute_id, user_id, description, generated_document_id) values (p_dispute, uid, btrim(p_description), p_document) returning id into eid;
  return eid;
end;
$$;

create or replace function public.delete_credit_dispute(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  delete from public.credit_disputes d where d.id = p_id and d.user_id = uid;
  if not found then raise exception 'DISPUTE_UNAVAILABLE'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Home summary + reminders
-- ---------------------------------------------------------------------
create or replace function public.member_summary_credit(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reports', (select count(*) from public.credit_reports r where r.user_id = p_user),
    'accounts_to_confirm', (select count(*) from public.credit_accounts a where a.user_id = p_user and a.extraction_state in ('needs_review', 'extracted')),
    'items_to_review', (select count(*) from public.credit_review_items i where i.user_id = p_user and i.stage = 'possible_inaccuracy')
                     + (select count(*) from public.credit_accounts a where a.user_id = p_user and a.extraction_state in ('needs_review', 'extracted')),
    'disputes_active', (select count(*) from public.credit_disputes d where d.user_id = p_user and d.status in ('draft', 'sent', 'response_received')),
    'disputes_awaiting_response', (select count(*) from public.credit_disputes d where d.user_id = p_user and d.status = 'sent'),
    'response_due_soon', (select count(*) from public.credit_disputes d where d.user_id = p_user and d.status = 'sent' and d.response_due_on <= current_date + 7),
    'overdue', (select count(*) from public.credit_disputes d where d.user_id = p_user and d.status = 'sent' and d.response_due_on < current_date));
$$;
revoke all on function public.member_summary_credit(uuid) from public, anon, authenticated;
grant execute on function public.member_summary_credit(uuid) to service_role;

-- Service: disputes that need a reminder (used by the notifications job; deduped by the caller with the dispute id + date).
create or replace function public.credit_dispute_reminders_due()
returns table (dispute_id uuid, user_id uuid, kind text, due_on date)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.user_id, case when d.response_due_on < current_date then 'overdue' else 'due_soon' end, d.response_due_on
    from public.credit_disputes d where d.status = 'sent' and d.response_due_on <= current_date + 7
  union all
  select d.id, d.user_id, 'follow_up', d.follow_up_on
    from public.credit_disputes d where d.status in ('sent', 'response_received') and d.follow_up_on is not null and d.follow_up_on <= current_date;
$$;
revoke all on function public.credit_dispute_reminders_due() from public, anon, authenticated;
grant execute on function public.credit_dispute_reminders_due() to service_role;

-- ---------------------------------------------------------------------
-- Grants: member functions are signed-in only
-- ---------------------------------------------------------------------
revoke all on function public.credit_norm(text) from public;
revoke all on function public.register_credit_upload(uuid, text, text, integer, integer, text, text) from public, anon;
revoke all on function public.extend_credit_upload_retention(uuid, integer) from public, anon;
revoke all on function public.delete_credit_upload(uuid) from public, anon;
revoke all on function public.expire_credit_uploads() from public, anon, authenticated;
revoke all on function public.delete_credit_report(uuid) from public, anon;
revoke all on function public.load_credit_sample_report() from public, anon;
revoke all on function public.confirm_credit_account(uuid, jsonb) from public, anon;
revoke all on function public.add_credit_account(uuid, jsonb) from public, anon;
revoke all on function public.create_manual_credit_report(text, date) from public, anon;
revoke all on function public.flag_credit_account_not_mine(uuid, text) from public, anon;
revoke all on function public.run_credit_review(uuid) from public, anon;
revoke all on function public.set_credit_item_stage(uuid, text, text) from public, anon;
revoke all on function public.create_credit_dispute(text, text, uuid[], text) from public, anon;
revoke all on function public.mark_credit_dispute_sent(uuid, date, text, text, integer) from public, anon;
revoke all on function public.record_credit_dispute_response(uuid, date, text, text) from public, anon;
revoke all on function public.update_credit_dispute(uuid, date, text, boolean) from public, anon;
revoke all on function public.add_credit_dispute_evidence(uuid, text, uuid) from public, anon;
revoke all on function public.delete_credit_dispute(uuid) from public, anon;

grant execute on function public.credit_norm(text) to authenticated, service_role;
grant execute on function public.register_credit_upload(uuid, text, text, integer, integer, text, text) to authenticated, service_role;
grant execute on function public.extend_credit_upload_retention(uuid, integer) to authenticated, service_role;
grant execute on function public.delete_credit_upload(uuid) to authenticated, service_role;
grant execute on function public.expire_credit_uploads() to service_role;
grant execute on function public.delete_credit_report(uuid) to authenticated, service_role;
grant execute on function public.load_credit_sample_report() to authenticated, service_role;
grant execute on function public.confirm_credit_account(uuid, jsonb) to authenticated, service_role;
grant execute on function public.add_credit_account(uuid, jsonb) to authenticated, service_role;
grant execute on function public.create_manual_credit_report(text, date) to authenticated, service_role;
grant execute on function public.flag_credit_account_not_mine(uuid, text) to authenticated, service_role;
grant execute on function public.run_credit_review(uuid) to authenticated, service_role;
grant execute on function public.set_credit_item_stage(uuid, text, text) to authenticated, service_role;
grant execute on function public.create_credit_dispute(text, text, uuid[], text) to authenticated, service_role;
grant execute on function public.mark_credit_dispute_sent(uuid, date, text, text, integer) to authenticated, service_role;
grant execute on function public.record_credit_dispute_response(uuid, date, text, text) to authenticated, service_role;
grant execute on function public.update_credit_dispute(uuid, date, text, boolean) to authenticated, service_role;
grant execute on function public.add_credit_dispute_evidence(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.delete_credit_dispute(uuid) to authenticated, service_role;
grant execute on function public.credit_dispute_reminders_due() to service_role;
