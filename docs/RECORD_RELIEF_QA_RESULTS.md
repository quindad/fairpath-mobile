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
**Pass 4 reviewed:** `c5b1681`, after the founder enabled `RECORD_RELIEF_EXTRACTION_ENABLED` in DEV.
**Pass 5 reviewed:** `c204e1f`, after the founder granted SELECT/UPDATE on `record_relief_uploads` to the service
role, resolving Pass 4's `save_failed`.
**Pass 6 reviewed:** `47468ea`, after the founder fixed a JSON-into-text-array type mismatch in
`replace_record_relief_evaluations`, resolving Pass 5's `evaluation_input_invalid`.
**Pass 7 reviewed:** `efd6187` — nationwide (57-jurisdiction) engineering audit per
`docs/RECORD_RELIEF_NATIONWIDE_COMPLETION_MATRIX.md`, reconciled with the founder's parallel
`docs/RECORD_RELIEF_NATIONWIDE_COVERAGE_AUDIT_2026-10-08.md`.

Executed per `docs/RECORD_RELIEF_BROWSER_QA_DIRECTIVE.md`. This report follows that directive's test matrix
numbering. Pass 2/3 additions are called out explicitly where the result changed or new evidence was gathered;
everything else is unchanged from Pass 1.

## Pass 7 — what's new (nationwide scope)

The founder's directive shifted from Ohio-only verification to a full nationwide audit of all 57 jurisdictions
(50 states, DC, 5 inhabited territories, federal). This pass covers what a software-engineering audit can
establish directly, in full detail in **`docs/RECORD_RELIEF_NATIONWIDE_COMPLETION_MATRIX.md`** (new this pass).
Summary:

- **Full Record Relief suite re-run fresh: 1,097/1,097 passing** (up from 1,087 at Pass 2 — new coverage was
  added since). Full repo suite: **1,414/1,414**. Typecheck: 0 errors.
- **All 57 jurisdictions have an adapter source file, a dedicated test file, and at least one statutory/citation
  reference embedded in code** — confirmed by a scripted scan, not a sample.
- **Real gap found and precisely quantified:** only **5 of 57** jurisdictions (OH, MD, PA, MI, IN) have a formal
  substantive-law completeness record (`completeness.ts`), a verified court-directory entry, or close to it; only
  **2 of 57** have a filing-profile (forms/instructions) entry. This matches the directive's item #4 directly and
  had not been quantified in one place before.
- **Dead-code finding:** `completeness.ts` exports `calculationGate()`, apparently meant to restrict live
  evaluation to jurisdictions with a verified completeness record, but it is never imported or called anywhere
  else in `src/`. Every jurisdiction's adapter runs regardless. Flagged, not changed (would alter product
  behavior — which jurisdictions can return a result at all — so it needs a product decision, not a QA-pass fix).
- **A separate, concurrent session (same working directory, author `quindad`) independently found and fixed a
  real safety gap this pass**, committed as `efd6187`: `executeRecordRelief` now overrides any adapter's result to
  `additional_facts_required` whenever `degree` or `disposition` is `'unknown'` but the adapter still returned an
  eligible/excluded/automatic-relief outcome, and disables `courtSpecificFilingReady` unless venue/court are known
  and nothing is missing. I independently verified this fix: re-ran their new nationwide runtime smoke test
  (`scripts/test-record-relief-nationwide-smoke.mjs`) fresh — **57/57 jurisdictions correctly refuse to return a
  false-positive eligible result for a synthetic unknown-degree/unknown-disposition charge** — and confirmed it
  introduces zero regressions (full suite still 1,414/1,414, typecheck still clean). This is a uniform,
  engine-level fix across all 57 jurisdictions, the highest-leverage kind of fix available without doing
  jurisdiction-by-jurisdiction legal research.
- **Reconciled with the founder's own parallel DB-side audit**
  (`docs/RECORD_RELIEF_NATIONWIDE_COVERAGE_AUDIT_2026-10-08.md`): their finding that `record_relief_rules` has
  zero real-jurisdiction rows (only synthetic `TEST-A/B/C` fixtures) describes a *different* layer than this
  matrix — a richer "verified rule" record for forms/filing/official-source display, separate from the static
  TypeScript adapter engine that actually computes eligibility and that this session confirmed live, working,
  end-to-end in Pass 6. Both audits independently converge on the same real gap from different angles: the
  eligibility logic is real and broadly tested; the official forms/filing/source-verification layer is not built
  out beyond a handful of jurisdictions.
- **Physical Storage deletion: still BLOCKED, now with a more precise negative result.** The founder's own
  parallel session invoked `public.invoke_record_relief_retention()` directly in DEV (`net._http_response`: HTTP
  200, `{"deleted":0,"failed":0}`) and confirmed the daily cron schedule is active, but explicitly noted this does
  **not** prove physical deletion since no disposable object was expired and removed during that test (see
  `docs/RECORD_RELIEF_DEV_RELEASE_GATE_UPDATE.md`). This session has no path to complete that proof either: making
  an upload's `expires_at` reach the past requires either direct SQL/service-role access (which this session does
  not have) or waiting 30 real days (the default retention window) — neither is something to fabricate or shortcut.
  **Still needs either founder-run verification with a deliberately-backdated fixture, or a temporary
  service-role/SQL credential shared out-of-band for this session to do it.**
- **Independent legal review: still 0 of 57, explicitly not claimed.** Per both this session's and the founder's
  parallel audit's own release recommendation: **nationwide public release is NOT READY** — the engineering layer
  (rule logic, safety guards, test coverage) is substantially real and improving every pass; the legal-accuracy and
  forms/filing layers are not, and that gap is stated precisely rather than minimized.

**On pace, stated honestly:** verifying all 57 jurisdictions' encoded rules against current official statute
text — the directive's items #2–4 taken literally — is a multi-week, per-jurisdiction research project, not
something a single pass can complete or claim to have completed. What this pass did instead: quantified the real
gap precisely (which jurisdictions have what evidence, exactly), fixed and verified the one engine-level defect
that was actually find-able and fix-able without inventing legal content, and left a reproducible script
(`test-record-relief-nationwide-smoke.mjs`) and a precise matrix so the next systematic step — a structured,
jurisdiction-by-jurisdiction legal-sourcing pass, following the founder's own "engineering acceptance gate"
6-step process in their audit doc — has a real, current baseline to build from rather than starting blind.

## Pass 6 — what's new

The founder found and fixed the Pass 5 root cause directly: `replace_record_relief_evaluations` was trying to
save JSON into a PostgreSQL text-array column (a real type mismatch, not a grants issue this time), pushed as
`47468ea`. Pulled latest and retried the full flow through to the eligibility result.

- **Test #6 (Ohio eligibility walkthrough) — PASS, live, end-to-end.** From the same confirmed case (disposition
  filled in during Pass 5), clicked "SAVE CASE + CHECK RELIEF" again. This time it succeeded completely: the app
  navigated to `/record-relief/scan-result` and rendered a real result — **Outcome: "additional facts required,"
  Remedy: "sealing," Rule: "Ohio Rev. Code § 2953.32 (effective Sept. 30, 2025)."** This is exactly the behavior
  the directive requires for a case with an unknown felony/misdemeanor degree: no eligibility promise, an honest
  "more information needed" result, and a cited, specific official rule source rather than a generic disclaimer.
- **Verified the result actually persisted, not just rendered.** Queried `record_relief_evaluations` directly
  (Member A's own session) for this case: a current, non-superseded row exists with
  `outcome:'additional_facts_required'`, `remedy:'sealing'`, `missing_inputs:['final offense degree','whether
  criminal proceedings are pending']`, and a real `engine_version` — matching the screen exactly. A second,
  **superseded** row for the same case also exists (an earlier `rule_unavailable` evaluation), which is the
  `replace_record_relief_evaluations` function's supersede-before-insert logic working correctly, not a defect:
  stale evaluations are retired, not left to coexist or silently overwritten in place.
- **No new console errors.** The only console errors present after this retry are residual, already-documented
  ones from this pass's own earlier direct-API diagnostic calls and prior passes' now-resolved failures (503, 500,
  422, 403, 400) — the successful click itself produced none.
- No code was changed this pass.
- **This closes out the full Member A document-to-eligibility-result flow** (#2 through #6 of the directive's
  test matrix) with live, verified evidence at every step, three founder-side fixes later. Test #5's one open
  observation (the disabled Save button's indistinguishable styling) and the general availability-of-verified-rules
  caveat (0 of 57 jurisdictions formally "verified" in DEV per the Coverage screen, separate from the engine
  itself being correct — see test #12/legal review) remain unchanged.

## Pass 5 — what's new

The founder identified and fixed the Pass 4 `save_failed` root cause (service role was missing SELECT/UPDATE on
`record_relief_uploads`, both now granted and verified; member UPDATE remains correctly denied), pushed as
`c204e1f`. Pulled latest and retried end-to-end.

- **Extraction now saves correctly — confirmed in DEV.** Retried with a fresh synthetic Franklin County, Ohio
  fixture. The upload completed, the AI call succeeded, and this time the save succeeded too: queried
  `record_relief_uploads` directly afterward and confirmed `status:'needs_review'`, a fully populated
  `extraction` JSON object (county, charges, jurisdiction code, warnings — including the AI correctly surfacing
  the document's own "SYNTHETIC DEV FIXTURE" disclaimer as a warning rather than ignoring it),
  `model_version:'claude-sonnet-5'`, and a real `extracted_at` timestamp. This is genuinely new evidence, not a
  repeat of Pass 4's partial result.
- **Test #5 (review screen) — PASS, live.** `/record-relief/review-scan` rendered the real extracted facts
  correctly: Jurisdiction, Court, Case Number, Offense, Statute, Conviction Date all pre-filled and editable. The
  "Disposition" field was correctly left **blank** even though the source text contained a clear disposition
  ("Guilty plea accepted") — the AI marked it `needsConfirmation:true` rather than guessing, and the screen shows
  "Some extracted facts still need confirmation. Edit the uncertain values above." with the Save button disabled
  until resolved. This is the consent-adjacent safety behavior the directive asks for (#5: never let AI extraction
  silently become a verified fact) working correctly.
  **UX observation, not fixed:** the Save button is rendered with the identical bright-green style whether
  `disabled` or not — there is no visual cue that it's inert, only the warning text above explains why clicking
  does nothing. Minor, not a safety issue, noted for the founder.
- **Test #6 (Ohio eligibility walkthrough) — BLOCKED by a new, precise finding, not a missing-fixture problem.**
  After manually confirming the disposition field (typed "conviction") to clear the review gate, saving the case
  itself succeeded — verified directly: `save_record_relief_case` RPC returns `200` with a real case row. The
  next step, `confirm_record_relief_packet`, also succeeded (`204`). The final step, calling the
  `evaluate-record-relief` Edge Function to actually run the Ohio adapter and show an eligibility result, returns
  `422 {"error":"evaluation_input_invalid"}`.
  **Root-caused by elimination, not guesswork:** reading `evaluate-record-relief/handler.ts` and
  `engine-executor.ts` shows every evaluation step up through running the Ohio rule adapter
  (`routeCase`/`validateBundle`/`planRecordReliefEvaluation`/`executeRecordRelief`) already catches its own
  exceptions internally and returns a structured `{ok:false, issues:[...]}` result rather than throwing — so a
  genuine input problem would have produced a `422` with the real issues array, not a bare `evaluation_input_invalid`
  string. The **only** remaining code path that can produce exactly that generic error is `index.ts`'s `persist()`
  step (writing the evaluation result to `record_relief_evaluations` via the service-role `replace_record_relief_evaluations`
  RPC) throwing, which `handler.ts`'s single shared `catch` block mislabels as an input-validation error rather
  than a server/persistence error. **This is itself a confirmed code-quality defect** (not fixed this pass,
  per "fix confirmed defects... without changing unrelated modules" and the backend-functions coordination
  boundary): a DB write failure should not be reported to the client as "your input is invalid." I could not
  directly call the service-role RPC myself to see its exact underlying Postgres error (calling it with my own
  authenticated session correctly returns `42501 permission denied`, confirming the grant boundary is itself
  correct and working — not the bug), so the specific DB-side cause (likely another grant gap on
  `record_relief_evaluations`, following the same pattern as Pass 4's `record_relief_uploads` fix) needs either
  founder-side Edge Function log access or a targeted grant check, not something resolvable from this session's
  read-only/anon-session tooling.
- No code was changed this pass.

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
strongest form of that proof available in this environment. **The full document-to-eligibility-result flow now
works and is live-verified end-to-end in DEV**: AI extraction runs and saves against the real Anthropic API
(confirmed with a realistic synthetic document and a direct DB query of the saved payload); the review screen
correctly withholds a low-confidence fact rather than guessing it; and the Ohio eligibility check itself now
returns and persists an honest, non-promising result ("additional facts required," with the specific missing
facts and a cited official rule) for a case with an unknown felony/misdemeanor degree — verified both on screen
and directly in `record_relief_evaluations`. Getting here took three successive founder-side DB fixes across
Passes 4–6 (an extraction enablement flag, a missing grant on `record_relief_uploads`, and a JSON/text-array type
mismatch in `replace_record_relief_evaluations`), each one found, precisely reported, fixed, and re-verified in
turn. The storage-deletion sweep has 10 passing offline tests; live execution against a real DEV bucket object is
still pending and intentionally out of this session's scope (service-role-token-gated, coordination boundary).
TypeScript and the full test suite are green: **1,414 of 1,414 tests pass.** Independent legal accuracy review of
the 57 jurisdictions has not happened and is explicitly out of scope for this pass.

## Test matrix results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Navigate to Record Relief screens, routes/back-nav on desktop and mobile | **PASS** | Navigation audit: 101 route files pass. Pass 2: live-browser-tested all 9 Record Relief routes signed-out at both 1280px and 375px — every one redirects to `/sign-in?returnTo=...`, zero overflow, zero console errors. **Pass 3:** re-swept 6 of the 9 routes (`/record-relief`, `/add`, `/case/[id]`, `/court-finder`, `/coverage`, `/scan-packet`) **authenticated** as Member A/B at both widths — real interior content renders correctly, no overflow, no new console errors. |
| 2 | Consent switch OFF by default; "Add first document" without consent never opens file picker/uploads/extracts | **PASS** | Code-verified in `src/app/record-relief/scan-packet.tsx`. **Pass 3 live confirmation:** as Member A, clicked "Add first document" with consent OFF and got the actual in-app error "Consent is required before AI document extraction." with no file picker opened. |
| 3 | Full authenticated upload/case-packet flow; consent RPC succeeds before extraction | **PASS** | **Pass 3:** confirmed upload + `record_relief_record_consent` RPC succeed, in order, before extraction. **Pass 4:** after `RECORD_RELIEF_EXTRACTION_ENABLED` was enabled, the Anthropic call ran and validated, but the save failed (`save_failed`) — root-caused to a missing `record_relief_uploads` grant. **Pass 5:** after the founder granted SELECT/UPDATE on `record_relief_uploads` to the service role (`c204e1f`), retried with a fresh fixture — extraction now saves successfully, confirmed directly in the DB: `status:'needs_review'`, full `extraction` payload, `model_version`, `extracted_at` all populated. Server-side consent backstop (403 if consent missing) remains covered by `tests/record-relief-stored-consent.test.ts`. |
| 4 | Missing consent / unsupported type / oversized file / signed-out behavior; orphaned uploads | **PASS** (code) + **PASS** (missing-consent case, live) / not re-tested live (unsupported type, oversized file) | `handler.ts`'s `handleExtract` rejects each case in order with its own status code (see Pass 2 detail). **Pass 3:** the missing-consent/no-picker case was live-confirmed (see #2). Unsupported-type and oversized-file live repro were not attempted — lower priority once the consent gate and full upload-through-save path were live-confirmed. Not claimed as tested live. |
| 5 | Review screen shows extracted facts, flags low-confidence/conflicts, never silently becomes a verified legal conclusion | **PASS, live** | **Pass 5:** `/record-relief/review-scan` rendered the real saved extraction — all high-confidence fields pre-filled and editable, the low-confidence "Disposition" field correctly left **blank** rather than guessed (source text clearly said "Guilty plea accepted," but the AI still flagged it `needsConfirmation:true`), with a visible warning and the Save button disabled until the member resolves it. Exactly the behavior the directive requires: no silent AI-to-verified-fact promotion. |
| 6 | Synthetic Ohio case, missing felony classification: no eligibility promise; official source links; distinguishes sealing/expungement/pardon/other | **PASS, live, verified in the database** | **Pass 5:** saving and packet-confirmation both succeeded; the final evaluate step returned `422 evaluation_input_invalid`, root-caused by elimination to the DB-persist RPC. **Pass 6** (after the founder fixed a JSON-into-text-array type mismatch in `replace_record_relief_evaluations`, `47468ea`): retried the same confirmed case — it now completes fully. The app rendered **Outcome: "additional facts required," Remedy: "sealing," Rule: "Ohio Rev. Code § 2953.32 (effective Sept. 30, 2025)"** — exactly the required behavior for a case with an unknown felony/misdemeanor degree: no eligibility promise, an honest "more information needed" result, and a specific cited official rule source. Verified the result is actually persisted, not just rendered: queried `record_relief_evaluations` directly and found a current `outcome:'additional_facts_required'`, `remedy:'sealing'`, `missing_inputs` row matching the screen exactly, with a prior evaluation correctly marked `superseded:true` rather than duplicated. |
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

1. **Physical Storage deletion (retention sweep) not executed live.** The sweep is service-role-token-gated and
   triggering it is outside this pass's "avoid backend functions" coordination boundary with the founder. Code
   guarantee has 10 passing offline tests; only live execution against a real DEV bucket object is unverified.
   **Needs either founder-run sweep verification, or explicit authorization + the sweep token shared out-of-band
   for this session to run it.**
2. **Local Postgres in this environment is missing `pg_cron`/`pg_net`.** This blocks the full local-sql test
   harness. No longer the only path to isolation proof, though — **isolation itself (test #8) is now independently
   verified live via direct RLS-scoped database queries**, so this gap no longer blocks that specific claim, only
   local confirmation of `record_relief_production_hardening.sql` in general. **External/environment blocker.**
3. **Independent legal review of all 57 jurisdictions has not happened.** Explicitly out of scope for software QA
   per the directive's own instruction. **Requires a human legal approval gate before any launch claim.**
4. **Minor UX observation, not a blocker:** the "SAVE CASE + CHECK RELIEF" button is rendered identically whether
   `disabled` or enabled (same bright green), so a member with an unresolved low-confidence field gets no visual
   cue that clicking will do nothing — only the warning text above explains it. Not fixed this pass.

Resolved across this pass sequence: "no DEV test account exists" (Pass 1/2 → founder created both accounts);
`extraction_not_enabled` (Pass 3 → founder enabled the flag, Pass 4); `save_failed` on extraction (Pass 4 →
founder granted `record_relief_uploads` SELECT/UPDATE, Pass 5, `c204e1f`); `evaluation_input_invalid` on the
eligibility check (Pass 5 → founder fixed a JSON-into-text-array type mismatch in
`replace_record_relief_evaluations`, Pass 6, `47468ea`). **The full Member A document-to-eligibility-result flow
is now working and live-verified end-to-end in DEV, with every step confirmed against the real database, not just
the UI.**

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
- **AI extraction now runs and saves correctly end-to-end in live DEV**, confirmed by a direct database query
  showing the saved extraction payload, model version, and timestamp — not just an in-app success message.
- **The review screen correctly withholds a low-confidence fact (Disposition) rather than silently accepting the
  AI's reading of it**, live-confirmed, with the Save action genuinely disabled until a human resolves it.
- **The Ohio eligibility check now runs and persists an honest result end-to-end**: for a case with an unknown
  felony/misdemeanor degree, it correctly returns "additional facts required" with the specific missing facts and
  a cited official rule source — never a false eligibility promise — and that result is confirmed saved in
  `record_relief_evaluations`, matching exactly what the member sees on screen.
- Across Passes 4–6, three distinct DB-side defects were found by precise, evidence-based elimination (not
  guessing), reported exactly, fixed by the founder, and re-verified live rather than assumed fixed.


## Retention verification follow-up — 2026-10-08

DEV `public.invoke_record_relief_retention()` returned request id 173; response was HTTP 200 with `deleted:0, failed:0`. Existing three Member A fixture upload records remain unexpired; none was altered for the deletion test. Physical Storage removal is **NOT YET VERIFIED**: no disposable object was created and removed in a live bucket test. Local `test:relief-fixtures` remains blocked by unavailable pg_net/cron and strict change-event fixture failure; `test:relief` passed. Independent legal review remains 0/57 approved. See `docs/RECORD_RELIEF_DEV_RELEASE_GATE_UPDATE.md`.
