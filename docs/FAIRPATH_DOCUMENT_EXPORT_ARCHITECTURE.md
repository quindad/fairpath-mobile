# Documents, export and sharing — platform architecture (proposal 2026-09-26, no code or migrations yet)

Rule: anything FairPath generates that a member may need outside the app goes through ONE export system. No per-module download code.
Record Relief and Credit Builder are built on this. Meetings, Resume Studio and Partner exports reuse it later.
Companion to `PROFILE_RESOURCES_ARCHITECTURE.md`. Target DEV only; nothing here touches production.

## 1. Layers (each replaceable, each testable)
1. **Document spec** (pure, import-free TS so audits can execute it): `DocumentSpec` = type key, title, audience, ordered blocks (heading, paragraph, key-value, table, checklist, dated timeline, notice), source refs, `confirmedDataAt`, `inputFingerprint`, and `officialFormRef`. `officialFormRef` (form id, version, source URL, verified_at) exists ONLY for a real official form. Module "builders" produce specs from confirmed data. One spec drives preview, PDF, DOCX and CSV, so the member reviews exactly what gets exported.
2. **Renderers**: spec to PDF (default for finished/official-looking documents), DOCX (editable: resume, cover letter, letters, worksheets), CSV (structured lists/history), PNG only where a real use case exists. Official forms are filled from a version-registered template, never generated to merely look official.
3. **Delivery**: one `deliverDocument(file, action)` interface with platform files, capability-detected so the UI shows only actions that exist on that device.
   - iOS/iPad: native share sheet (Save to Files, Print, Mail, Messages, Open in...), popover anchored on iPad.
   - Android: system share chooser, system file picker (Storage Access Framework) for save-to-device, system print.
   - Web: Blob download, Web Share API with files only where the browser supports it, browser print. Nothing is faked in the web preview; unsupported actions are hidden.
   - Temp files live in the app cache and are removed after hand-off. FairPath never writes sensitive files to shared or public directories itself.
4. **Registry and history**: `generated_documents` (section 3) plus a per-type policy file `document-types.ts` (sensitivity, formats, default persistence, retention, allowed audiences, required confirmed fields).

## 2. Where rendering runs (recommendation; needs a spike before we commit)
- Recommended: an Edge Function `render-document` (pdf-lib for PDF and official-form fill, `docx` for DOCX). It reads confirmed data itself with the caller's JWT (the client sends only a document type and source id, never contents), returns bytes, logs no bodies, and persists nothing unless the type policy or the member says so. Output is identical on web, iOS and Android, and official-form templates stay private and versioned on the server.
- Alternative: client-side (`expo-print` HTML to PDF on native; web needs a library). Data stays on-device, but output is inconsistent and there is no DOCX.
- Spike first (small, throwaway): prove pdf-lib and `docx` run in a Supabase Edge Function and that the bytes open in Files, Word, Pages and Google Docs. In-app preview never depends on a PDF viewer: the app renders the SPEC natively ("review everything"), then the file opens through the OS viewer.
- Before coding the delivery layer I read the Expo SDK 57 docs for `expo-file-system`, `expo-sharing` and `expo-print` (APIs changed; per AGENTS.md).

## 3. `generated_documents` (owner-only, private by default)
- Columns: id, user_id, document_type, source_module, source_record_id, title, file_name, format (pdf/docx/csv/png), status (generating/ready/failed/expired/deleted), version, supersedes_id, template_id, template_version, official_form_ref jsonb, sensitivity (standard/sensitive/highly_sensitive), persist_policy (on_demand/history_only/stored), storage_path (nullable), checksum_sha256, byte_size, input_fingerprint, confirmed_data_at, expires_at, deleted_at, metadata jsonb (non-sensitive only), created_at.
- Regeneration creates a NEW version linked by `supersedes_id`. It never silently overwrites.
- CHECK: a document of kind `official_form` requires `official_form_ref`. The UI may say "official form" only then; otherwise it says "prepared summary".
- `input_fingerprint` (hash of the confirmed inputs) lets the app show "your information changed since this was made" and offer regeneration.
- `document_export_events` (append-only): document_id, user_id, action (preview/download/share_sheet_opened/save_to_files/print), platform, at. Metadata only, never contents. "Share sheet opened" is recorded as exactly that, because the OS does not tell us who received the file.
- Packets (`01_Dispute_Letter.pdf`, `02_Evidence_Checklist.pdf`...) get a `document_packets` table WHEN the first packet feature is built. No speculative packet or meeting tables now.
- The legacy `FilingPacket.generatedPdfUrl` field in `src/core/record-relief/filing.ts` is a URL and is retired in favor of a `generated_document_id`.

## 4. Storage, retention, deletion
- Private bucket `generated-documents`, path `{user_id}/{document_id}/v{version}.{ext}`, owner-only policies, never public. Signed URLs of 60 seconds or less, minted only on an explicit member action.
- Defaults by sensitivity:
  - `highly_sensitive` (credit data, justice history, record-relief packets): on-demand, metadata-only history, no stored file unless the member taps "Keep a copy" (30 or 90 days).
  - `sensitive`: on-demand or short retention.
  - `standard` (resource list, opportunity profile): optional stored copy up to 1 year.
- The member can delete any stored copy and its history at any time (storage object plus row). Expiry runs server-side. Account deletion requests cascade to documents.
- The UI is honest: deleting our copy cannot recall a file already exported to a device or another app.
- Export is member-initiated only. Sharing outside the app goes through the OS share sheet after an explicit tap, with a plain warning for sensitive types. No service-role credentials on the client. No sensitive content in analytics: product events carry document type, format and action only, never titles, file names or content.

## 5. Audience-scoped exports
Each type declares `allowedAudiences` (self, landlord, employer, caseworker...). Non-self audiences build only from fields the member picked on an include-checklist. Sensitive fields default OFF and are excluded by construction: landlord and employer builders may not import justice-history modules, and an audit enforces that. A caseworker share needs an explicit consent event plus the member's exact selection, and comes later. Nothing is visible to employers, landlords or Partners by default.

## 6. File naming
`FairPath_{Subject}_{YYYY-MM-DD}.{ext}` from a pure sanitizer, for example `FairPath_Opportunity_Profile_2026-10-04.pdf` or `FairPath_Ohio_Record_Sealing_Packet_2026-10-04.pdf`. A same-day regeneration becomes `_v2`. Never the member's name, case numbers or identifiers in a file name.

## 7. My Documents (yes, small and purposeful)
- Route `/documents`, reached from `/me` and from contextual buttons. Sections: READY TO EXPORT (types with enough confirmed data), GENERATED (history with version chain and an "out of date" badge), NEEDS ATTENTION (missing information, outdated, expiring copy), UPLOADED (links to existing housing application documents, later the Documents Vault).
- It is not a cloud drive: no folders and no arbitrary uploads. It answers "everything FairPath helped me prepare, in one place".
- One shared `DocumentActions` component drives every module: PREVIEW, DOWNLOAD PDF, SAVE TO FILES, SHARE, PRINT, EDIT/REGENERATE, BUILD PACKET. Actions appear per device capability and document state.

## 8. What this pass builds versus later
- Profile + Resources pass (first consumers): the export foundation and `/documents`, then the Saved Resources list, contact sheet and required-documents checklist (PDF and CSV), and the Opportunity Profile summary (PDF and DOCX).
- Later on the same system: Record Relief packet, Credit dispute packet, Resume Studio (PDF and DOCX), housing readiness packet, FastTrack receipt, progress report, caseworker share packet.
- Official-form generation needs a verified template-registry entry per jurisdiction and form version. Until then the app never says "official form".

## 9. Physical-device QA (cannot be verified in the browser pane)
- iOS: share sheet, Save to Files, Print, Open in, iPad popover.
- Android: share chooser, system file-picker save, print.
- DOCX opening in Word, Pages and Google Docs; fonts and pagination on real devices; large files.
- Web QA covers only the web paths: download, Web Share files support, print.

## 10. Migration sequence change
Insert after migration 3: `3b. 20261001125000_generated_documents.sql` (tables, private bucket, owner-only RLS, export-event ledger, retention functions). The render spike and the export foundation follow it. Migrations 4 to 7 are unchanged; the Opportunity Profile export ships with migration 4's UI. New audits: `audit-documents` (spec purity, naming, no PII in analytics or metadata keys, audience builders never import justice modules, official-form claim check).
