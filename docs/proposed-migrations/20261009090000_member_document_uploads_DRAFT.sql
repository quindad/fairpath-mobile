-- DRAFT -- NOT APPLIED. Lives in docs/proposed-migrations/, never supabase/migrations/, until founder/backend review.
-- Closes docs/proposed-migrations/README.md backlog item #6: generic (non-credit) document upload, blocked today
-- because src/app/documents/upload.tsx has STORAGE_CONNECTED = false (no bucket/table exists for it).
--
-- Mirrors src/core/documents/extraction-contract.ts's field/status shape exactly (DocumentType, Sensitivity,
-- FieldStatus, ExtractedField, DocumentRecord, Audience, ConsentGrant) and reuses the already-proven-secure
-- member-folder-scoped storage pattern from supabase/migrations/20261008520000_record_relief_ai_uploads.sql and
-- supabase/migrations/20260901000100_baseline_constraints_security_logic.sql (housing-application-documents),
-- rather than inventing a new one. Does NOT reuse src/core/documents/document-service.ts's `generated-documents`
-- bucket, because that bucket is for FairPath-generated output documents, not member-uploaded source documents --
-- mixing the two would blur "what FairPath produced" with "what the member gave us", which matters for the
-- highly_sensitive types this table must hold (court_record, sentencing_document, credit_report, identification).
--
-- What this draft does:
--   * public.member_documents -- one row per uploaded original file. Original is stored once and never overwritten
--     (extraction-contract.ts's own comment), so there is no update path for storage_path after insert.
--   * public.member_document_fields -- one row per extracted field, status lifecycle 'proposed' -> 'confirmed' |
--     'corrected' | 'rejected'. Extraction never writes 'confirmed' directly; only the owning member's own review
--     RPC can, mirroring reviewField()/recomputeReviewComplete() in extraction-contract.ts.
--   * public.member_document_consent_grants -- one row per (document, audience) share. 'donor' is rejected at the
--     database level (check constraint), matching mayShareDocument()'s hard "donors never receive documents" rule,
--     not just a client-side check that could be bypassed.
--   * Storage bucket 'member-documents', private, folder-scoped to auth.uid(), same shape as every other
--     member-upload bucket in this project.
--
-- What this draft deliberately leaves alone:
--   * No RPCs are defined here (register/confirm/correct/reject/grant-consent). Those are the next layer, written
--     against this schema once it is reviewed -- see "required before use" below. Writing them now, against a
--     table that does not exist in real DEV, would mean trusting an unreviewed schema; the SQL pattern in every
--     sibling migration (register_credit_upload, log_document_export, etc.) is a thin RPC wrapping a plain insert
--     plus validation, so there is no new design problem to solve, just review time.
--   * src/app/documents/upload.tsx's STORAGE_CONNECTED stays false until this is applied and the RPCs exist.
--   * No extraction/AI pipeline wiring. Whether generic uploads get automatic reading (like credit reports do) is
--     a separate, later decision; this table supports it (fields are extraction-shaped) without requiring it --
--     a document with zero rows in member_document_fields is simply unread, same as credit uploads before you
--     tap "read automatically".
--
-- Rollback: drop the three tables (cascades are member-owned only, nothing else references them) and the bucket's
-- storage policies; the bucket row itself can stay (empty, harmless) or be deleted once empty.
--
-- Required before this is applied:
--   1. Founder/backend review of the sensitivity/consent model below, especially the 'donor' and 'highly_sensitive'
--      guarantees, since court/credit/ID documents are the highest-stakes member data in the app.
--   2. A local Postgres test suite (mirroring scripts/test-local-credit.mjs's structure: guest/role isolation,
--      cross-member isolation, owner-only read/write, 'donor' audience always rejected, review-state transitions
--      cannot skip 'proposed', original file is never overwritten) before this moves to supabase/migrations/.
--   3. The RPC layer (register/confirm/correct/reject/grant/revoke), written and tested against this schema.

create table if not exists public.member_documents(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check(document_type in(
    'court_record','sentencing_document','credit_report','resume','employment_record',
    'housing_document','identification','training_certificate','business_document'
  )),
  sensitivity text not null check(sensitivity in('standard','sensitive','highly_sensitive')),
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check(byte_size between 1 and 15728640),
  page_count int not null default 1 check(page_count between 1 and 60),
  review_complete boolean not null default false,
  status text not null default 'uploaded' check(status in('uploaded','processing','needs_review','ready','failed','deleted')),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_document_fields(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.member_documents(id) on delete cascade,
  key text not null,
  value text not null,
  source_page int not null check(source_page >= 1),
  source_snippet text not null,
  confidence text not null check(confidence in('low','medium','high')),
  status text not null default 'proposed' check(status in('proposed','confirmed','corrected','rejected')),
  corrected_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_document_consent_grants(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.member_documents(id) on delete cascade,
  audience text not null check(audience in('member_only','employer','housing_provider','partner_org','case_manager')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(document_id, audience)
);
-- 'donor' is deliberately absent from the audience check constraint above: mayShareDocument() in
-- extraction-contract.ts says donors never receive documents, so there is no value that would let one exist.

alter table public.member_documents enable row level security;
alter table public.member_document_fields enable row level security;
alter table public.member_document_consent_grants enable row level security;

drop policy if exists "members read own documents" on public.member_documents;
drop policy if exists "members create own documents" on public.member_documents;
drop policy if exists "members update own documents" on public.member_documents;
create policy "members read own documents" on public.member_documents for select using(auth.uid() = owner_id);
create policy "members create own documents" on public.member_documents for insert with check(auth.uid() = owner_id);
create policy "members update own documents" on public.member_documents for update using(auth.uid() = owner_id) with check(auth.uid() = owner_id);

drop policy if exists "members read own document fields" on public.member_document_fields;
create policy "members read own document fields" on public.member_document_fields for select using(
  exists(select 1 from public.member_documents d where d.id = document_id and d.owner_id = auth.uid())
);
-- No client insert/update policy on member_document_fields: extraction and review both go through RPCs
-- (service-role for extraction writes, SECURITY DEFINER for the member's own confirm/correct/reject), matching
-- how credit_accounts/credit_review_items are never written to directly by the client either.

drop policy if exists "members read own consent grants" on public.member_document_consent_grants;
create policy "members read own consent grants" on public.member_document_consent_grants for select using(
  exists(select 1 from public.member_documents d where d.id = document_id and d.owner_id = auth.uid())
);
-- Same reasoning: consent grants are created/revoked through an RPC that enforces reviewComplete and the
-- 'donor'-never rule server-side, not by direct table access.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('member-documents', 'member-documents', false, 15728640, array['application/pdf','image/jpeg','image/png','image/heic','image/heif'])
on conflict(id) do nothing;

drop policy if exists "members upload own document files" on storage.objects;
drop policy if exists "members read own document files" on storage.objects;
drop policy if exists "members delete own document files" on storage.objects;
create policy "members upload own document files" on storage.objects for insert to authenticated
  with check(bucket_id = 'member-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members read own document files" on storage.objects for select to authenticated
  using(bucket_id = 'member-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own document files" on storage.objects for delete to authenticated
  using(bucket_id = 'member-documents' and (storage.foldername(name))[1] = auth.uid()::text);
