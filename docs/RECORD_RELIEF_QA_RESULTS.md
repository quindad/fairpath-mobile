# Record Relief — QA results

**Date:** 2026-10-07 · **Repo:** fairpath-mobile · **Branch:** `development/mobile-v1-completion` ·
**Environment:** Supabase DEV (`znvhmuhojvwvjzmaqwff`) and local only. Production was never touched.
**Commit reviewed from:** `9dfc8f4` (QA directive added) through `f00df1a` (this QA pass's fixes), inclusive of
`dd0575a` (Record Relief production automation) and `bdbbdb3` (stored-consent enforcement).

Executed per `docs/RECORD_RELIEF_BROWSER_QA_DIRECTIVE.md`. This report follows that directive's test matrix
numbering.

## Summary

The core safety boundary — **no AI extraction without recorded consent** — is correct and now has test coverage
on both sides of the gate: client-side (never even opens the file picker) and server-side (403 even if the client
lies). The storage-deletion sweep was already correct in its ordering but had **zero test coverage before this
pass**; it's refactored to be testable and now has 10 passing tests. TypeScript and the full test suite are green:
**1,414 of 1,414 tests pass.** Two categories remain genuinely blocked by environment and access limits, not by
code defects: live authenticated browser testing (no DEV test account exists) and the local Postgres RLS harness
(missing `pg_cron`/`pg_net` extension locally). Independent legal accuracy review of the 57 jurisdictions has not
happened and is explicitly out of scope for this pass.

## Test matrix results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Navigate to Record Relief screens, routes/back-nav on desktop and mobile | **PASS** (routing only; see note) | Navigation audit: 101 route files pass. All `/record-relief/*` routes correctly require sign-in (not in `isPublicRoute`'s allowlist) and redirect to `/sign-in?returnTo=...` with no dead end — confirmed live in the browser at both desktop and 375px mobile viewports. Interior screen content behind the login wall is **BLOCKED** (see #3). |
| 2 | Consent switch OFF by default; "Add first document" without consent never opens file picker/uploads/extracts | **PASS** | Code-verified in `src/app/record-relief/scan-packet.tsx`: `useState(false)` for consent; `add()` checks `if(!consent){setError(...);return}` **before** calling `pickReliefCaseFile()`, so the picker never opens. |
| 3 | Full authenticated upload/case-packet flow; consent RPC succeeds before extraction | **PASS** (flow order, code + server test) / **BLOCKED** (live browser run) | Order confirmed in `scan-packet.tsx`: upload → `record_relief_record_consent` RPC → only then `extractRecordReliefCase`. Server-side backstop confirmed by `tests/record-relief-stored-consent.test.ts` (staged and committed this pass): the Edge Function returns 403 `stored_consent_required` and performs **zero downloads, zero engine calls** if `consented_at` is null, even when the client sends `consent:true`. Live run with a real DEV account: **BLOCKED — no DEV test account exists** (see Blockers). |
| 4 | Missing consent / unsupported type / oversized file / signed-out behavior; orphaned uploads | **PASS** (code read) / **BLOCKED** (live) | `handler.ts`'s `handleExtract` rejects, in order: wrong method, oversized body, no user, extraction disabled, bad JSON, `consent!==true`, bad upload id, missing/foreign upload, **missing stored consent**, wrong status, unsupported MIME, size out of `[1, 15MB]`. Each has its own status code. "Orphaned uploads": investigated — if the consent RPC fails after a successful upload, the row is not literally orphaned (upload already cleans up Storage on its own DB-insert failure in `ai-upload.ts`); an uploaded-but-unconsented row simply sits until its `expires_at` and is swept by the now-tested retention function. Not a defect. Live signed-out/oversized-file browser repro: **BLOCKED — no DEV account**. |
| 5 | Review screen shows extracted facts, flags low-confidence/conflicts, never silently becomes a verified legal conclusion | **PASS** (code) / **BLOCKED** (live render) | `mergeCasePacket` in `case-packet.ts` and the review screen route exist and are exercised by Record Relief's own offline suite (1,087 tests, unchanged by this pass — all passing). Live rendered inspection: **BLOCKED — no DEV account** to produce a real case packet. |
| 6 | Synthetic Ohio case, missing felony classification: no eligibility promise; official source links; distinguishes sealing/expungement/pardon/other | **PASS** (offline test coverage) / **BLOCKED** (live) | Covered by the existing 57-jurisdiction offline suite (`tests/record-relief*.test.ts`), including Ohio-specific rule-engine tests, all passing. Live browser walkthrough with a synthetic case: **BLOCKED — no DEV account**. |
| 7 | Accessibility labels, keyboard, screen reader text, mobile layout, loading/error states, no secrets in console | **PASS**, one observation | Keyboard audit: 29 screens pass, including `scan-packet.tsx`'s `Switch` (has `accessibilityLabel="Consent to AI document extraction"`). Live-inspected the `/sign-in?returnTo=/record-relief` hand-off screen (the one Record Relief screen reachable without an account) at 375px and desktop: clean layout, no overflow, no console errors or warnings. **Observation, not fixed:** the email/password inputs on `/sign-in` get their accessible name from their placeholder text rather than a bound label — a minor, pre-existing issue on the shared sign-in screen, not a Record Relief file, and out of this pass's scope per "fix confirmed defects... without changing unrelated modules." |
| 8 | Member A cannot access member B's cases/uploads/evaluations | **BLOCKED** | Requires two signed-in DEV accounts, which don't exist (see Blockers), **and** the local Postgres RLS harness is blocked independently by a missing `pg_cron` extension (see #11). Neither path is available in this environment. Not claimed as passing. |
| 9 | `tsc --noEmit` and the full Record Relief test suite | **PASS** | `npx tsc --noEmit --pretty false`: 0 errors. `node --test tests/record-relief*.test.ts`: **1,087 of 1,087 pass**. Full repo suite: **1,414 of 1,414 pass**. Navigation audit: 101 routes. Keyboard audit: 29 screens. |
| 10 | Expired upload: physical Storage deletion confirmed, not just a DB flag; retry/error behavior | **PASS** (code, now tested) / **BLOCKED** (live execution) | `record-relief-retention`'s handler always calls `storage.remove([path])` **before** marking a row `deleted`, and **never** marks it deleted if removal fails (confirmed by 10 new offline tests — see Fixes below). Live execution against the real DEV bucket: **BLOCKED — requires the service-role-protected sweep token and a real expired file**, neither available here. |
| 11 | Unauthenticated Edge Function calls fail; RLS enforces ownership; service-only RPC blocked for authenticated role; monitoring doesn't auto-approve legal changes | **PARTIAL PASS** (code) / **BLOCKED** (live/local-DB verification) | Code-verified: every Edge Function checks `getUserId`/auth before doing anything; `record-relief-retention` requires a server-held token (`checkToken`), not a user session, so an authenticated member cannot call it. Live/local-DB confirmation of RLS policies: **BLOCKED** — `node scripts/local-sql-check.mjs` cannot apply the full local migration set; `20261008570000_record_relief_production_hardening.sql` and two unrelated Program Scout migrations fail with `extension "pg_net" is not available` / `relation "cron.job" does not exist`. This is an environment gap (missing `pg_cron`/`pg_net` in this local Postgres), not a Record Relief code defect, and it was already known before this pass from unrelated prior work this session. "Monitoring does not auto-approve legal rule changes": not independently re-verified this pass; would need the same blocked local-DB access or a DEV account to check the review-queue UI. |
| 12 | Independent legal accuracy review of all 57 jurisdictions is a separate approval gate | **NOT CLAIMED** | Per instruction. Software tests prove the rule *engine* behaves correctly against its own fixtures (1,087 passing tests) and that the app never asserts a legal conclusion without going through that engine. They do **not** establish that any jurisdiction's encoded rule is itself legally correct. That requires a human legal reviewer per jurisdiction, not done here, not claimed here. |

## Fixes made this pass

1. **`supabase/functions/record-relief-retention/`** — refactored from a single untested `Deno.serve` handler into
   `handler.ts` (pure, dependency-injected, matching the existing `extract-record-relief-case` pattern) plus a thin
   `index.ts`. This made the critical ordering guarantee (never mark a row deleted before Storage confirms removal)
   testable for the first time. Caught and fixed a real bug introduced by the refactor itself before it shipped: a
   non-POST request must return `405 method_not_allowed`, not `401`.
2. **`tests/record-relief-retention.test.ts`** (new, 10 tests) — proves the ordering guarantee, that a failed
   removal leaves the row for the next sweep rather than losing data, that a null `storage_path` skips the remove
   call, and that auth/method/malformed-input cases are rejected before the sweep runs.
3. **Staged `tests/record-relief-stored-consent.test.ts`** — this file existed uncommitted from the prior session's
   work on `bdbbdb3`/`cac4e28`. Verified it passes and is a genuine regression test (proves the 403 consent gate),
   then committed it rather than leaving it to bit-rot uncommitted.

No other code was changed. Nothing in the staffing work from earlier this session was touched by this pass, and
nothing from this pass touched staffing files.

## Remaining launch blockers

1. **No DEV test account exists.** Supabase's email-send quota for this DEV project has been rate-limited for
   over an hour across repeated attempts this session (`scripts/dev-qa-create-account.mjs`, gitignored credentials
   file never produced). This blocks every "live browser, authenticated" item above (#3, #4 live, #5 live, #6
   live, #8). **External blocker — needs either the quota to clear or an admin-created DEV account.**
2. **Local Postgres in this environment is missing `pg_cron`/`pg_net`.** This blocks the full local-sql test
   harness, which in turn blocks live RLS/isolation verification and local confirmation of
   `record_relief_production_hardening.sql`. **External/environment blocker**, not new to this pass — the same gap
   was found in unrelated Program Scout migrations earlier this session.
3. **Independent legal review of all 57 jurisdictions has not happened.** Explicitly out of scope for software QA
   per the directive's own instruction. **Requires a human legal approval gate before any launch claim.**
4. **Two-account cross-member isolation** cannot be demonstrated until blocker 1 or 2 clears.

## What is genuinely finished and verified

- The consent-before-extraction safety boundary, on both the client and the server, with real test coverage on
  the server side.
- The storage-retention deletion ordering, now with real test coverage for the first time.
- TypeScript correctness and the full automated suite (1,414 tests) across the whole repository, not just
  Record Relief.
- Route-level access control for every `/record-relief/*` screen, confirmed live in the browser at two viewport
  sizes, with a working, honest hand-off to the public website's free checker for signed-out visitors.
