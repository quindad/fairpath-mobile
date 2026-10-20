# DEV Supabase — mobile v1 migrations (accept-terms + profile)

**Project ref (DEV):** `znvhmuhojvwvjzmaqwff`  
**Branch:** `development/mobile-v1-completion`

These migrations unblock **Task 018** (accept-terms persistence) and related mobile v1 work. Apply them on DEV before QAing auth/onboarding on a real device or Expo web against cloud Supabase.

## Required migrations (Oct 17, 2026 batch)

| Version | File | Why |
| --- | --- | --- |
| `20261017193000` | `record_document_consent_sync_profiles.sql` | RPC updates `profiles.terms_*` / `privacy_*` so routing does not loop on `/accept-terms`. |
| `20261017201000` | `profiles_experience_summary.sql` | Optional onboarding field for Signal/home copy. |
| `20261017200000` | `member_record_statements_rls_initplan.sql` | RLS perf fix (initplan). |
| `20261017202000` | `rls_initplan_saved_searches_inquiries.sql` | RLS perf fix (initplan). |

Earlier dependency: `20261015130000_record_document_consent.sql` must already be on DEV (creates the RPC). If sign-up consent fails with “function does not exist”, push from an earlier baseline or apply that file first.

## Operator checklist (Phase 15 — Tasks 126–135)

Use this on **`fairpath-mobile-dev` only** (`znvhmuhojvwvjzmaqwff`). **Never** `db push` to production (`rqpczemdagoddhuwefxt`) from this branch without explicit release approval.

| Step | Task | Action | Done |
| ---: | --- | --- | --- |
| 1 | **126** | Confirm CLI login: `npx supabase projects list` shows DEV **linked: true** | ☐ |
| 2 | **127** | From repo root: `npx supabase link --project-ref znvhmuhojvwvjzmaqwff` (if not linked) | ☐ |
| 3 | **128** | `npx supabase migration list` — screenshot or paste pending vs applied | ☐ |
| 4 | **129** | Review pending files match table below; no surprise drops | ☐ |
| 5 | **130** | **BLOCKED:** Do not run `db push`; use separately approved isolated four-file runbook only | ☐ |
| 6 | **131** | SQL verify: `record_document_consent` exists (`20261015130000` or earlier on DEV) | ☐ |
| 7 | **132** | SQL verify: profile columns after push (`terms_accepted_at`, `experience_summary` if migration applied) | ☐ |
| 8 | **133** | Run consent queries in [Verify accept-terms sync](#verify-accept-terms-sync-sql-editor-on-dev) for one test user | ☐ |
| 9 | **134** | App smoke: accept-terms once → no loop (checklist below) | ☐ |
| 10 | **135** | Record evidence in tracker / PR comment: migration list output + test user id (no secrets) | ☐ |

**Rollback:** do not `db reset` on shared DEV. If a migration fails, fix forward with a new migration file — do not revert production-like data without owner approval.

## Apply on DEV (commands)

**Drift (Oct 2026):** `db push` would apply **26** pending locals (22 unreconciled + 4 Oct 17). **Do not push** until `docs/DEV_MIGRATION_RECONCILIATION_2026-10-20.md` is resolved.

**Proposed path for Oct 17 only (requires separate execution approval):** manual four-file apply — **`docs/DEV_MIGRATION_OCT17_ISOLATED_APPLY.md`** (no CLI push, no repair of the 22).

Legacy CLI flow (blocked until reconciliation):

```powershell
cd fairpath-mobile
npx supabase link --project-ref znvhmuhojvwvjzmaqwff
npx supabase migration list
# npx supabase db push   # NO-PUSH until drift reconciled
```

Review the pending list before confirming. **Do not** use `db reset` on shared DEV.

## Verify accept-terms sync (SQL editor on DEV)

Replace `<user_id>` with a test member who just tapped **Agree and continue**:

```sql
select terms_accepted_at, terms_accepted_version, privacy_accepted_at, privacy_accepted_version
from public.profiles
where id = '<user_id>';

select event_type, document_version, granted, created_at
from public.consent_events
where user_id = '<user_id>' and event_type in ('terms_accepted', 'privacy_accepted')
order by created_at desc
limit 4;
```

Both profile pointers and ledger rows should show version `v1` and non-null timestamps.

## Verify in the app (no loop)

1. Sign in as `dev-free@fairpath.test` (or a member missing consent in DEV only).
2. Complete `/accept-terms` once.
3. Force-quit and reopen → should land on `/home` or `/onboarding`, **not** `/accept-terms` again.
4. See also `docs/AUTH_E2E_BROWSER_CHECKLIST.md`.

## Local automated proof (no cloud)

```powershell
npm run test:sql:consent
npm run test:auth
npm run test:all
```

`test:sql:consent` applies all migrations locally (PGlite) and asserts `record_document_consent` updates `profiles`. Full suite (run fresh; historical count may differ) does not replace cloud `db push` — it only proves repo migrations apply cleanly in isolation.

## Post-push regression (operator machine)

After a separately approved isolated DEV apply, from repo with `.env.local` pointing at DEV:

```powershell
npm run typecheck
npm run test:all
npm run qa:dev-anon
```

Optional member flows: `docs/AUTH_E2E_BROWSER_CHECKLIST.md`, `docs/NEW_USER_JOURNEY_E2E.md`.

## Client fallback (already shipped)

If DEV still has the old RPC but ledger rows exist, `src/core/profile/consent-status.ts` backfills profile pointers from `consent_events`. After `20261017193000` is applied, new acceptances stay in sync without relying on the client backfill.
