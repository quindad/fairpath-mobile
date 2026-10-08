# Record Relief phase 4–6 next-prompt execution brief — 2026-10-07

## DEV project only
Supabase project ref: znvhmuhojvwvjzmaqwff. NEVER touch production ref rqpczemdagoddhuwefxt.

## Verified this session
- Edge Function extract-record-relief-case deployed ACTIVE with verify_jwt=true (Supabase function version 1).
- Edge Function evaluate-record-relief deployed using esbuild bundle, corrected handler to inspect issues instead of nonexistent out.ok, verify_jwt=true.
- DEV evaluation outcome CHECK expanded to current engine enums without invalidating old rows.
- Daily due-date cron exists. Metadata-expiry cron UNSCHEDULED because it erased storage_path before deleting actual objects; do not reschedule until storage deletion is proven.
- 11 focused server/extraction tests passed.
- Pending local change: supabase/functions/evaluate-record-relief/handler.ts. Generated bundle.ts should not be committed.

## Unfinished from phase 1–3
- Extraction depends on RECORD_RELIEF_EXTRACTION_ENABLED=true, ANTHROPIC_API_KEY, RECORD_RELIEF_EXTRACTION_MODEL; availability has not been verified. Never print secrets.
- Server persist currently marks old rows superseded before inserting new; must become atomic RPC/transaction. Verify insert and case ownership, request validation, audit logs.
- Upload MIME magic-byte validation, consent audit, status transition protection, object deletion, no-PII logs, authenticated E2E remain.
- Scheduled automatic recalculation is NOT deployed; only notification cron.
- Live authenticated user flow not yet tested; do not call production-ready.

## Next prompt tasks 4–6
4. Primary official legal source monitoring for 57 jurisdictions every 30 days. Record changes as drafts, enforce human approval and no AI autopublish. Avoid invented source URLs.
5. Full regression/security QA: RLS multi-user negative tests, case-packet lifecycle, signed-out/forbidden endpoint responses, no duplicate notifications, all 57 hostile legal cases, audit and migration consistency.
6. Full DEV E2E: authenticated mobile user -> private upload -> extraction -> packet confirmation -> shared evaluator -> persisted result -> reminder. Use synthetic data only, record exact outcomes. Fix failures before release.

## Known deployment caveat
Supabase CLI cannot bundle shared code outside function directory automatically. esbuild with --bundle --platform=neutral --format=esm --external:jsr:* generates evaluate-record-relief/bundle.ts, temporarily replace index.ts for deployment then restore. NEVER leave bundle replacing source index. Ensure no unrelated untracked staffing files staged.
