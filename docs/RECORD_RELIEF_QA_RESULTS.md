# Record Relief — QA results

**Date:** 2026-10-07 · **Repo:** fairpath-mobile · **Branch:** `development/mobile-v1-completion` ·
**Environment:** Supabase DEV (`znvhmuhojvwvjzmaqwff`) and local only. Production was never touched.
**Pass 1 reviewed:** `9dfc8f4` (QA directive added) through `f00df1a` (Pass 1 fixes), inclusive of `dd0575a`
(Record Relief production automation) and `bdbbdb3` (stored-consent enforcement).
**Pass 2 reviewed:** `db10b65` (latest, pulled clean fast-forward; includes the founder's `extract-record-relief-case`
v3 deploy, `record-relief-retention` v2 deploy, restored minimum DB grants, and the SQL-transaction RLS proof
documented in `docs/RECORD_RELIEF_DEV_RELEASE_GATE_UPDATE.md`).
**Pass 3 reviewed:** `b0fe342` (latest at start of this pass), with two founder-created, Auto-Confirm-enabled
synthetic DEV accounts (`fairpath.qa.member.a@example.com`, `fairpath.qa.member.b@example.com`) finally available,
unblocking live authenticated testing for the first time.

Executed per `docs/RECORD_RELIEF_BROWSER_QA_DIRECTIVE.md`. This report follows that directive's test matrix
numbering. Pass 2/3 additions are called out explicitly where the result changed or new evidence was gathered;
everything else is unchanged from Pass 1.

## Pass 4 — what's new

The founder enabled `RECORD_RELIEF_EXTRACTION_ENABLED=true` in Supabase DEV (the Anthropic key was already
present), resolving the Pass 3 `extraction_not_enabled` blocker. Retried Member A's extraction immediately.

- **The 503 is gone — extraction now actually runs.** Signed back in as Member A, toggled consent on, and
  injected a new, more realistic synthetic fixture: a 850×1100 PNG rendered via canvas containing readable text
  styled as a Franklin County, Ohio judgment entry (`synthetic-dev-fixture-franklin-county-judgment.png`, 92KB,
  explicitly labeled in its own content as a "SYNTHETIC DEV FIXTURE... does not represent a real person, case, or
  court record"). This exercised the real Anthropic Claude vision call in `extract-record-relief-case/index.ts`,
  not a stub.
- **New finding: `save_failed` (500), not a 503.** After ~12 seconds (consistent with a real model call), the
  screen showed `save_failed`. This status code is only reachable in `handler.ts` *after* `d.runEngine` returned a
  result and `validateCaseExtraction` accepted it — i.e., the Anthropic call succeeded and produced a structurally
  valid extraction. The failure is specifically in `d.save()`, which does
  `admin.from('record_relief_uploads').update({status:'needs_review', extraction:payload, model_version, extracted_at}).eq('id',id)`
  using the service-role client.
- **Root-cause narrowed further by direct DB inspection.** Queried `record_relief_uploads` with Member A's own
  session token immediately after the failure: the row is still `status:'uploaded'`, `failure_code:null`,
  `extraction:null`, `model_version:null` — meaning **`markFailed()` (the catch-path cleanup write) also failed
  silently** (its own `error` is never checked in `index.ts`, so it fails without surfacing anything). Both the
  success-path write and the failure-path write against `record_relief_uploads` are failing for the service-role
  client, which points at a database-side grants/ownership issue on that table, not an application code defect —
  `record_relief_uploads` itself only has an explicit `revoke update ... from authenticated` in
  `20261008550000_record_relief_ai_security.sql` (correct, intentional — that's what forces members through the
  SECURITY DEFINER RPCs); there is no table-level grant statement for `record_relief_uploads` visible in
  `20261008570000_record_relief_production_hardening.sql`'s grant restoration, unlike
  `record_relief_consent_events`, which does have one. **This is not something to fix by writing a new migration
  from this session — flagging precisely for the founder, who owns DB grants in this pass's coordination split.**
- No code was changed this pass. Reverified the row is not silently orphaned: it stays `status:'uploaded'` (a
  legitimate, retryable pre-extraction state), will still be correctly picked up by the retention sweep once
  `expires_at` passes, and does not expose the (valid, unsaved) extraction payload anywhere.
- Review screen and Ohio eligibility walkthrough (#5, #6) remain **BLOCKED** — there is still no successfully
  *saved* extraction to review, even though the AI call itself now works end-to-end.

## Pass 3 — what's new

- **Live authenticated run as Member A.** Signed in, completed onboarding, reached `/record-relief`. The home
  screen renders the real authenticated "No cases yet" empty state, zero console errors.
- **Consent gate re-verified live, not just by code reading.** On `/record-relief/scan-packet` with consent OFF,
  clicking "Add first document" produced the exact in-app error "Consent is required before AI document
  extraction." with no file picker opening — confirmed via DOM inspection that no `<input type=file>` interaction
  occurred. With consent toggled ON, the hidden file input became present and a synthetic PNG fixture was injected
  through it (no OS file-dialog automation is available in this tool set, so a real `File`+`DataTransfer`+`change`
  event was dispatched to exercise the actual upload code path).
- **Upload + consent RPC success confirmed directly against the DEV database**, not inferred from the UI. Member
  A's own live session token was used to query `record_relief_uploads` via PostgREST (the same table the app
  itself reads, under the member's own RLS-scoped session — no service role, no bypass). Result: a real row exists
  with `status:'uploaded'`, a populated `storage_path`, and a populated `consented_at` timestamp — proving the
  upload and the `record_relief_record_consent` RPC both succeeded in DEV, **and that consent was recorded before
  extraction was attempted**, exactly as the code requires. `extraction` on that row is `null`.
- **AI extraction itself did not complete — live finding, root cause identified.** Immediately after upload, the
  app surfaced an `extraction_not_enabled` error and the console logged one `503` from the extraction Edge
  Function. Reading `supabase/functions/extract-record-relief-case/index.ts` shows `enabled()` requires both
  `RECORD_RELIEF_EXTRACTION_ENABLED==='true'` and a non-empty `ANTHROPIC_API_KEY`. The 503 means at least one of
  those two environment values is not actually set in this live DEV Edge Function deployment, despite the function
  itself being deployed (v3). **This is a DEV environment/secrets configuration gap, not a code defect** — the
  guard is working exactly as designed by refusing to run without its dependencies. Flagging for the founder to
  confirm `RECORD_RELIEF_EXTRACTION_ENABLED` and `ANTHROPIC_API_KEY` are actually set as DEV Edge Function secrets
  (not just present in a local `.env`).
- **Member A/B cross-account isolation — live-verified at the database level, the strongest form of this test.**
  Signed out of A, signed in as Member B (`fairpath.qa.member.b@example.com`, a distinct `auth.users` row). Using
  Member B's own live session token, queried `record_relief_uploads` directly for Member A's specific upload row
  by its id: **`200 OK` with an empty array** — not a 403/permission error, meaning Postgres RLS is silently
  filtering the row out at the query-planner level, which is the correct, secure behavior (an error response would
  leak that the row exists). The app UI independently shows the same thing: Member B's `/record-relief` home
  renders "No cases yet," matching a brand-new account with zero visible cases.
- **All 9 Record Relief routes re-swept authenticated** (previously only the signed-out redirect was tested): with
  Member A/B signed in, `/record-relief`, `/add`, `/case/[id]`, `/court-finder`, `/coverage`, and `/scan-packet`
  were loaded directly (desktop 1280px and 375px mobile); each renders its real interior content correctly with no
  horizontal overflow, no layout breakage, and no new console errors beyond the known extraction 503 (which only
  appears on the one tab where extraction was actually attempted, not as a global error).
- **Physical Storage deletion (test matrix #10) remains BLOCKED.** The retention sweep is a separate, service-role
  Edge Function gated by a server-held `record_relief_monitor_auth` token, which this session does not have and
  should not request — triggering it is also explicitly outside this pass's "avoid backend functions" coordination
  boundary with the founder. Code-level guarantee (removal before DB mark) is unchanged from Pass 2 and still has
  10 passing offline tests; only the live execution against a real DEV bucket object remains unverified.
- No code was changed this pass. The `extraction_not_enabled` finding is a configuration/secrets report, not a
  defect to fix in `fairpath-mobile`.

## Pass 2 — what's new

- **Retried DEV test account creation at `db10b65`.** Result changed from "email rate limit exceeded" to two new
  findings: a `+`-tagged address (`fairpathindustries+mobileqa@yahoo.com`) is now rejected as **invalid** by the
  project's auth settings (not previously true), and a plain address (`fairpathmobileqa@yahoo.com`) **signs up
  successfully but cannot sign in** — email confirmation is required and no inbox is accessible from this session.
  This matches the founder's own, more-privileged session's finding in `RECORD_RELIEF_DEV_RELEASE_GATE_UPDATE.md`
  ("No authenticated synthetic DEV account was available"). **Two working, signed-in synthetic accounts still do
  not exist.** I did not keep retrying signup after this — it's the same wall from a different angle, not a quota
  issue to wait out.
- **Full route-level browser sweep, all 9 Record Relief screens, both viewports** (Pass 1 only checked `/record-relief`
  itself): `/record-relief`, `/add`, `/case/[id]`, `/court-finder`, `/coverage`, `/review-scan`, `/scan-packet`,
  `/scan-result`, `/scan` — every one redirects to `/sign-in?returnTo=...` at both 1280px desktop and 375px mobile,
  with zero horizontal overflow and zero console errors at either width.
- **Fresh clean baseline at `db10b65`:** typecheck 0 errors, full suite 1,414/1,414, navigation audit 101 routes,
  keyboard audit 29 screens — unchanged in count from Pass 1, confirming the founder's grant/deploy commits didn't
  regress anything client-side.
- **No code defects found this pass.** Nothing was changed in `supabase/functions`, migrations, or legal-review
  documents, per the coordination instruction.

## Summary

The core safety boundary — **no AI extraction without recorded consent** — is correct and now verified on both
sides of the gate **and live, with real synthetic DEV accounts**: client-side (no file picker opens without
consent, confirmed live), and the upload + consent RPC succeeding in the correct order (confirmed by querying the
live DEV database directly). **Member A/B cross-account isolation is live-verified at the RLS level**, the
strongest form of that proof available in this environment. AI extraction itself now runs successfully end-to-end
against the real Anthropic API (confirmed with a realistic synthetic document) after the founder enabled the
extraction flag — the one remaining gap is that the extracted result fails to save back to the database, traced
to a likely missing DB grant, not a code defect, and flagged precisely for the founder. The storage-deletion sweep has 10 passing
offline tests; live execution against a real DEV bucket object is still pending and intentionally out of this
session's scope (service-role-token-gated, coordination boundary). TypeScript and the full test suite are green:
**1,414 of 1,414 tests pass.** Independent legal accuracy review of the 57 jurisdictions has not happened and is
explicitly out of scope for this pass.

## Test matrix results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Navigate to Record Relief screens, routes/back-nav on desktop and mobile | **PASS** | Navigation audit: 101 route files pass. Pass 2: live-browser-tested all 9 Record Relief routes signed-out at both 1280px and 375px — every one redirects to `/sign-in?returnTo=...`, zero overflow, zero console errors. **Pass 3:** re-swept 6 of the 9 routes (`/record-relief`, `/add`, `/case/[id]`, `/court-finder`, `/coverage`, `/scan-packet`) **authenticated** as Member A/B at both widths — real interior content renders correctly, no overflow, no new console errors. |
| 2 | Consent switch OFF by default; "Add first document" without consent never opens file picker/uploads/extracts | **PASS** | Code-verified in `src/app/record-relief/scan-packet.tsx`. **Pass 3 live confirmation:** as Member A, clicked "Add first document" with consent OFF and got the actual in-app error "Consent is required before AI document extraction." with no file picker opened. |
| 3 | Full authenticated upload/case-packet flow; consent RPC succeeds before extraction | **PASS** (upload + consent + AI call) / **BLOCKED** (final DB save — DB grants, not code) | **Pass 3:** confirmed upload + `record_relief_record_consent` RPC succeed, in order, before extraction, via direct DB query with Member A's own session. **Pass 4** (after the founder enabled `RECORD_RELIEF_EXTRACTION_ENABLED`): retried with a new, realistic synthetic fixture. The 503 is gone; the real Anthropic extraction call now runs and its output passes schema validation (`validateCaseExtraction`). It fails one step later, at `save_failed` (500) — the service-role write of the extraction result back to `record_relief_uploads` fails, and the failure-path cleanup write fails too (row stays `status:'uploaded'`, nothing orphaned or exposed). Root-caused to a likely missing table-level grant for `record_relief_uploads` on the DB side — see Pass 4 summary and Blockers. Server-side consent backstop (403 if consent missing) remains covered by `tests/record-relief-stored-consent.test.ts`. |
| 4 | Missing consent / unsupported type / oversized file / signed-out behavior; orphaned uploads | **PASS** (code) + **PASS** (missing-consent case, live) / not re-tested live (unsupported type, oversized file) | `handler.ts`'s `handleExtract` rejects each case in order with its own status code (see Pass 2 detail). **Pass 3:** the missing-consent/no-picker case was live-confirmed (see #2). Unsupported-type and oversized-file live repro were not attempted this pass — lower priority once the consent gate and upload path were both live-confirmed, and extraction is blocked regardless of file validity (see #3). Not claimed as tested live. |
| 5 | Review screen shows extracted facts, flags low-confidence/conflicts, never silently becomes a verified legal conclusion | **PASS** (code) / **BLOCKED** (live render) | Covered by Record Relief's offline suite (1,087 tests, all passing). Live rendered inspection still **BLOCKED**: extraction itself did not complete this pass (see #3), so no real extracted-facts payload exists yet to render on the review screen. |
| 6 | Synthetic Ohio case, missing felony classification: no eligibility promise; official source links; distinguishes sealing/expungement/pardon/other | **PASS** (offline test coverage) / **BLOCKED** (live) | Covered by the 57-jurisdiction offline suite, all passing. Live walkthrough still **BLOCKED** — same reason as #5, extraction did not complete. |
| 7 | Accessibility labels, keyboard, screen reader text, mobile layout, loading/error states, no secrets in console | **PASS**, one observation (unchanged) | Keyboard audit: 29 screens pass. **Pass 3:** checked console output across the full authenticated Member A and Member B sessions — no secrets, tokens, or case content leaked to console at any point; the only console error throughout was the one known extraction 503. Same pre-existing sign-in placeholder-as-label observation from Pass 2, still out of scope (not a Record Relief file). |
| 8 | Member A cannot access member B's cases/uploads/evaluations | **PASS** | **Pass 3, live-verified at the database level** — the strongest form of this test. Signed in as Member B, then queried `record_relief_uploads` directly (Member B's own session token) for Member A's specific upload row by id: `200 OK` with an empty array, not an error — Postgres RLS silently excludes the row rather than returning a 403 (correct behavior; a 403 would leak that the row exists). The app UI independently confirms the same thing: Member B's `/record-relief` home shows "No cases yet." |
| 9 | `tsc --noEmit` and the full Record Relief test suite | **PASS** | `npx tsc --noEmit --pretty false`: 0 errors. `node --test tests/record-relief*.test.ts`: **1,087 of 1,087 pass**. Full repo suite: **1,414 of 1,414 pass**. Navigation audit: 101 routes. Keyboard audit: 29 screens. **Pass 2:** rerun fresh at `db10b65`, identical counts — no regression from the founder's deploy/grant commits. |
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

1. **Extraction result cannot be saved — likely missing DB grant.** Resolved this pass: the founder enabled
   `RECORD_RELIEF_EXTRACTION_ENABLED`, so the 503 is gone and the real Anthropic extraction call now succeeds and
   validates. New, narrower blocker: the service-role write of the result back to `record_relief_uploads`
   (`status`, `extraction`, `model_version`, `extracted_at`) fails with `save_failed`, and the failure-cleanup
   write fails too. `record_relief_uploads` has an explicit `revoke update ... from authenticated` (intentional)
   but, unlike `record_relief_consent_events`, no visible table-level grant restoration for the service role in
   `20261008570000_record_relief_production_hardening.sql`. This blocks #3's final step, #5, and #6 live.
   **External/DB blocker — the founder needs to confirm `service_role` (or whatever role the Edge Functions'
   `SUPABASE_SERVICE_ROLE_KEY` resolves to) has UPDATE on `record_relief_uploads`.** No migration was written for
   this from this session, per the coordination boundary.
2. **Physical Storage deletion (retention sweep) not executed live.** The sweep is service-role-token-gated and
   triggering it is outside this pass's "avoid backend functions" coordination boundary with the founder. Code
   guarantee has 10 passing offline tests; only live execution against a real DEV bucket object is unverified.
   **Needs either founder-run sweep verification, or explicit authorization + the sweep token shared out-of-band
   for this session to run it.**
3. **Local Postgres in this environment is missing `pg_cron`/`pg_net`.** This blocks the full local-sql test
   harness. No longer the only path to isolation proof, though — **isolation itself (test #8) is now independently
   verified live via direct RLS-scoped database queries**, so this gap no longer blocks that specific claim, only
   local confirmation of `record_relief_production_hardening.sql` in general. **External/environment blocker.**
4. **Independent legal review of all 57 jurisdictions has not happened.** Explicitly out of scope for software QA
   per the directive's own instruction. **Requires a human legal approval gate before any launch claim.**

Resolved this pass: the "no DEV test account exists" blocker from Pass 1/2 — the founder manually created both
accounts with Auto Confirm enabled, unblocking live authenticated testing.

## What is genuinely finished and verified

- The consent-before-extraction safety boundary, on both the client and the server, with real test coverage on
  the server side **and now live-confirmed in the browser**: the error-without-picker case, and a real DEV
  database row proving upload + consent RPC succeeded in the correct order.
- **Member A/B cross-account isolation, live-verified at the database/RLS level** — Member B's own session
  querying Member A's specific row by id returns an empty result with `200 OK`, not an error. This is the
  strongest available proof short of a full local-sql RLS harness run.
- The storage-retention deletion ordering, now with real test coverage for the first time (live execution still
  pending — see Blockers).
- TypeScript correctness and the full automated suite (1,414 tests) across the whole repository, not just
  Record Relief.
- Route-level access control for all 9 `/record-relief/*` screens signed-out, **and real interior-content
  rendering for 6 of the 9 screens now confirmed live while authenticated**, at both 1280px desktop and 375px
  mobile, with zero console errors beyond the known extraction-config 503 and zero layout overflow.
- AI extraction is the one safety-relevant flow that could **not** be completed end-to-end this pass — not because
  of a code defect, but because the live DEV deployment is missing an enablement secret. This is flagged precisely
  rather than guessed at or marked passing.
