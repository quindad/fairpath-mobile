# FairPath handoff: max build pass (branch `feat/v1-canonical-profile`)

Nothing here is pushed to GitHub. DEV Supabase project only (`znvhmuhojvwvjzmaqwff`) — migrations ARE pushed there
(that's expected; it's the DEV database, not production). Production untouched.

## Update 6 (Record Relief full engine QA + Early Access architecture, built and live-verified)
**Record Relief engine: comprehensively proven, not just seeded.** Drove 8 deliberately distinct fact patterns
through the real TEST-A..D rules live in the Browser pane, all 8 correct: eligible-now, waiting-period (exact
countdown, e.g. "1 year, 8 months, 21 days remaining"), restitution-blocked, offense-excluded (with honest
still-missing-info alongside the exclusion), manual-review-recommended (juvenile flag), stale-rule warning +
more-info-needed together, no-rules-yet (TEST-D, zero fabrication), and edit-and-recalculate (waiting-period →
eligible after changing the date, with an honestly appended history log, not a rewritten one). Document packet
generation (4 documents) confirmed working. TEST jurisdictions are unmistakably labeled "(TEST DATA)" everywhere.
Every "no verified forms" / "fee not listed" case correctly says so instead of inventing data. One minor open
item: two `400` console errors on cold page load of any Record Relief case (isolated to page-load/session-refresh
timing via fetch/XHR interception, not tied to any specific action, zero user-facing effect observed) — logged,
not chased further per explicit instruction to prioritize product functionality over that specific noise.

**External integration audit — real, not guessed.** `docs/EXTERNAL_INTEGRATION_REGISTER.md` and
`docs/STERLING_INTEGRATION_SETUP.md` built from actually reading the codebase (env vars, imports, config files),
with honest CONNECTED / DEV FIXTURE / KEY REQUIRED / NOT STARTED status per feature. Verified the maps
recommendation against the real Expo SDK 57 docs (per AGENTS.md) rather than assumption: SDK 57 has a new
`expo-maps`, but it's alpha and has zero web support, which would regress FairPath's working web map fallback —
staying on `react-native-maps` is correct, not a compromise. Also found `expo-location`'s geocoding is free,
no-key, and web-compatible — a real unlock for future listing work.

**Coverage markets / Early Access: built AND Browser-verified live end to end on DEV**, not just a schema.
`supabase/migrations/20261003100000_coverage_markets.sql` (10/10 new local SQL tests): server-determined coverage
per ZIP (`get_market_coverage`, never client-guessed), idempotent member enrollment (`join_early_access`), and
idempotent market activation (`activate_coverage_market`) that reuses the EXISTING `entitlement_grants`
architecture for the 60-day FairPath+ benefit rather than inventing a second one — one grant per (market, member),
auditable, re-running activation issues zero duplicate grants. Tightened after the security audit correctly
caught an unnecessary anon table grant (guests only need the SECURITY DEFINER function, not direct table select).
New `/early-access` screen (public route) never dead-ends a member: always offers the six tools that work
nationally regardless of local inventory (Resources, Resume Studio, Credit, Record Relief, AI, Opportunity
Profile). Wired into BOTH `find-jobs.tsx` and `find-housing.tsx`'s empty-result paths, replacing the generic
"no matches" message with the honest low-coverage message + JOIN EARLY ACCESS button, ONLY when the ZIP itself
has no configured coverage (checked server-side, never guessed from an empty results array). Verified live:
honest `coming_soon` default for an unconfigured ZIP, a real join proven persisted by reloading the page from
zero client state and getting "Already on the list" back from the server, and both search screens routing
correctly. DEV has zero coverage_markets rows configured yet, so today every ZIP resolves honestly to
`coming_soon` — seeding real market rows (`full`/`growing`/`limited`) is optional future work, not a blocker.

**Not done this pass, explicitly not claimed as done:** the nationwide 50-state/DC/federal real-legal-data
coverage matrix (still 100% NOT STARTED beyond the 4 fictional TEST fixtures — this is a major content-sourcing
project, correctly not attempted in a code session), walkability/location-intelligence provider abstraction,
inventory provenance model for Jobs/Housing/Resources, notifications event architecture, Credit Builder /
Resume Studio / Meetings deep re-QA, FairPath AI new coverage/waitlist intents, the internal DEV integration-health
diagnostics view, and the Partner/Admin contract documentation. All real, scoped work — none of it silently
skipped, all of it genuinely unstarted.

**Continued past the first "final report" (correctly called out as premature) with more real, verified work:**
found and corrected three real errors in my own earlier integration audit by actually reading schema instead of
grepping for provider names — walkability/schools/nearby-places already have working schema + graceful-empty-
state UI (DEV seed deliberately leaves it null, not broken), a complete Jobs/Housing inventory provenance/
ingestion pipeline already exists in baseline schema but is entirely dormant (zero code references it), and push
notifications already have a full server-side delivery queue (push_tokens, notification_deliveries, auto-queuing
trigger) with only client-side token registration and an actual sending worker missing — deliberately NOT wired
up this pass since expo-notifications is a native module needing a device rebuild I cannot verify from the
Browser pane. Added a new FairPath AI intent (market_coverage: "is FairPath in my area", "am I on the waitlist")
reading real enrollments through the existing read-only gateway, Browser-verified live. Caught and fixed a
self-referencing import bug in gateway.ts during that work before it ever ran. Closed a real cohesion gap: Home's
status card never reflected Early Access enrollment; added it, Browser-verified live. Me and My Documents both
independently spot-checked and confirmed cohesive (7 Record Relief cases, 4 documents, 1 saved home — all
matching exactly what was actually created this session, no stale counts, no dead links).

40/40 offline checks green throughout this pass (was 39; +1 for the new coverage markets SQL suite). 11 new local
commits, all clean, nothing pushed to GitHub, nothing touching production.

## Update 5 (full signed-in integration marathon, real member journey)
Drove a disposable DEV member through Opportunity Profile (8/8) → Easy Apply → Housing FastTrack → Resources →
Documents → Credit → FairPath AI → Privacy, live in the Browser pane. Found and fixed 4 real bugs no offline check
had caught:
1. **`createResume`/`createMeeting` never set `user_id`** — RLS correctly rejected every insert; Resume Studio and
   Meetings creation were completely broken. Local SQL tests insert with an explicit `user_id` and never exercise the
   client service layer, so this was invisible until a real signed-in click. Fixed; new audit `test-client-user-id.mjs`.
2. **Every client-side (device-fallback) PDF/DOCX export was broken on web** — Metro's `unstable_enablePackageExports`
   resolved `tslib` to its ESM build (no `default` export) while `docx`'s CJS bundle expected the CJS shape. Affected
   Credit dispute letters, Record Relief packets, and Resume Studio project-wide. Fixed with `metro.config.js`
   (`unstable_enablePackageExports = false`). **Needs a dev-server restart to take effect** — done on both 8090 and
   the QA server; confirmed live (PDF + DOCX resume export, 4-document dispute packet zip).
3. **Easy Apply autofill read only the legacy `profile_answers` questionnaire** — skills/certifications/desired
   roles/education were silently blank for anyone using the real Opportunity Profile (the only flow the app
   surfaces). Fixed to prefer `member_skills`/`member_credentials`/`member_education`/`member_job_preferences`,
   legacy as fallback only. Regression check in `audit-jobs.mjs`.
4. **`window.confirm`/`alert` on web silently no-op** in this Browser-pane environment (confirmed via console:
   "native JavaScript dialogs are disabled ... confirm() returned false"), which is exactly why "Replace with
   profile" and similar confirm-gated actions did nothing when clicked. Replaced with a themed in-app modal
   (`NotifyHost` + `setNotifyHandler` in `notify.ts`) — same call sites, no other code changes, and now part of the
   real DOM so it's both on-brand and actually testable. Verified on a real delete confirmation.

**Verified working end to end, live, as one continuous member (not just guest, not just code-read):**
Opportunity Profile all 8 sections (skills, work experience incl. "I still work here", education incl. GED/incarcerated-
work framing, job preferences, availability, transportation) → Easy Apply with correct autofill and a **verified
server-built employer snapshot containing exactly the opted-in sections, confirmed by reading the raw stored row
directly** (no DOB, no home address, no justice data, no pay) → Housing FastTrack's full 5-step flow with real
validation and **required-document enforcement that genuinely blocks submission** (the historical bug area) →
Resources save/start with cross-module consistency on Saved Resources → both document generation paths (server via
render-document, device via generateFromSpec) producing real files with correct source labels → My Documents
correctly categorizing everything from Credit, Resume Studio and Resources, with working deletion → Credit's full
stage model (needs-review → possible-inaccuracy → member-disputes → confirmed) including the new dispute-reason
chips and identity-correction letter → FairPath AI's deterministic next-steps, food-search and dispute-status intents
returning real, correctly-prioritized state → Privacy's deletion request/cancel with correct idempotency and honest
"NOT been deleted" language.

**One real architecture finding, not patched blind:** the legacy "FairPath Readiness" score on Home (`/complete-profile`,
`profile_answers` table) is fed by different write paths than the new Opportunity Profile (`member_*` tables) — it
moved from 0%→20% purely from a Housing FastTrack draft, which writes DOB/address into the legacy table. The two
systems are real and separately useful today, but need an explicit merge/retire decision, not a silent rename.

**Session boundary note:** the QA dev server (port 8091) hit a Metro heap-limit crash after ~71 minutes of continuous
use — restarted cleanly, no code issue. A later environment reset (usage-limit boundary) cleared the Browser pane's
session entirely; testing stopped there since re-entering needs a fresh `qa:dev-ui` callback link. Sign-out/sign-in
session-restore was therefore not explicitly exercised (though the same underlying mechanism was implicitly proven
correct dozens of times via reloads and navigation all session).

39/39 offline checks pass after every fix. 4 new commits this pass, all local, clean tree.

## State
- Applied to DEV: resources migrations (`20261001100000`..`20261001120000`).
- Written and tested locally only (PGlite): `20261001130000` opportunity_profile, `140000` generated_documents, `150000` privacy_and_member_summary, `160000` credit_workspace, `170000` record_relief, `180000` ai_provenance, `190000` member_reminders.
- `npm run test:all` runs 32 offline checks (tsc, audits, render tests, SQL suites). All pass.
- Built: Resources, Opportunity Profile, Me/Privacy, Document engine (PDF/DOCX/CSV), Credit workspace, Record Relief, FairPath AI assistant, reminders, Home status card, theme system (dark default).

## Morning sequence (Sterling's terminal, in order)
1. `npx supabase db push` (applies the 7 pending migrations in order)
2. `$env:SUPABASE_SERVICE_ROLE_KEY = "<DEV key>"`
3. `npm run seed:dev:relief` (TEST-A..D fixtures, dev only)
4. `npm run qa:dev-pass2` (real Auth/RLS/Storage checks, disposable users, cleans up)
5. `npm run qa:dev-resources-member`
6. `Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY`
7. `npx supabase functions deploy render-document --project-ref znvhmuhojvwvjzmaqwff`
8. `npm run qa:dev-ui` (and `qa:dev-ui-cleanup`) for signed-in browser QA
9. Rebuild the iOS dev client (new native modules: expo-apple-authentication, expo-crypto, expo-file-system, expo-sharing, expo-print, Stripe)

## Update (after DEV verification)
- All 7 migrations applied to DEV, `seed:dev:relief` done, `qa:dev-pass2` 26/26 green on real DEV.
- `render-document` DEPLOYED to DEV. Unauthenticated probes pass (`node scripts/probe-render-unauth.mjs`, 6/6).
- Authenticated verification is ready but NOT yet run: `npm run qa:dev-render` (needs the DEV service key in Sterling's shell; makes two disposable members, proves real PDF/DOCX/CSV, names, versioning, private storage, isolation, forged/malformed requests).
- Credit report reading: uploads (PDF/JPG/PNG/HEIC) are stored privately; the UI says automatic reading is not available. Built (not deployed, off by default): `extract-credit-report` Edge Function + strict validator `src/core/credit/extraction.ts` (last-4 only, no invention, gaps flagged, consent required). It needs `CREDIT_EXTRACTION_ENABLED=true` and `ANTHROPIC_API_KEY` secrets AND a founder decision to send member-consented credit reports to a model provider. The client does not call it yet (needs a consent screen). Tested offline only (`npm run test:extraction`).
- Signed-in Browser QA has NOT been done: it needs a disposable DEV member (`npm run qa:dev-ui`, service key).
- Guest Browser QA in light mode at phone width: Appearance and Assistant look right; assistant asks guests to sign in for credit questions.

## Update 2 (autonomous pass while Sterling away)
- `qa:dev-render` was run and failed on setup, not on the function: DEV has no verified resources loaded. Queued in `docs/STERLING_ACTION_QUEUE.md` item 1 (`npm run seed:dev:resources` then `npm run qa:dev-render`).
- Credit: built the client-side consent flow for automatic reading (`readUploadedReport` in `src/core/credit/credit-service.ts`, a confirm dialog + "READ AUTOMATICALLY" button per upload in `src/app/credit/index.tsx`). The server function stays disabled until Sterling sets the extraction secrets (queue item 3) — calling it today returns `extraction_not_enabled`, which the UI now explains in place.
- Reviewed My Documents staleness/versioning UI (`src/app/documents/index.tsx`): already flags "changed since you created this" from `input_fingerprint`, shows expiring stored copies, and distinguishes server- vs device-generated. No gap found; nothing changed.
- Audit updated to check the new honest copy and the explicit-consent call path (`scripts/audit-credit.mjs`).
- All 34 offline checks green. Signed-in Browser QA still blocked on queue item 2 (`npm run qa:dev-ui`).

## Update 3 (Browns-game pass)
- Root-caused and fixed all three `qa:dev-render` failures reported from real DEV (10/12 → expected 12/12). None were app bugs: two were wrong-column/wrong-predicate mistakes in the harness itself, one was the harness hardcoding a document version instead of reading the one the server actually returned. Regression coverage added at both the harness level (`test-qa-harness-columns`, `test-resource-availability`) and the app level (`test-local-documents.mjs`, now 12/12, proves version is one sequence per document_type across every export format).
- Static Phase 2 sweep of the signed-in routes (home, me, opportunity-profile, resources, saved-resources, documents, credit, record-relief, fairpath-ai, privacy, appearance): no dead `onPress` handlers, no TODO/placeholder markers, no hardcoded hex colors in themed routes, and the public/gated route split matches what was already verified live (guests redirected from every module route). Nothing needed fixing.
- 36/36 offline checks green. Signed-in Browser QA is still blocked on `npm run qa:dev-ui` (queue item 2) — I did not fabricate a pass for it.
- Given the size of the remaining marathon backlog (Credit Builder depth, Record Relief engine breadth, FairPath AI tool surface, Resume Studio, virtual meetings), I stopped after the concrete, verifiable bug-fix and audit work rather than claim large feature builds I could not exercise against real data or the Browser pane this pass. Those phases are unstarted, not silently skipped — flagging that honestly here instead of reporting fake progress.

## Update 4 (overnight cohesion pass)
- `/me` reorganized into YOUR PATH (Opportunity Profile, Resume Studio, Credit Builder, Record Relief) / ACTIVITY / ACCOUNT. Fixed a real pre-existing gap: Credit Builder and Record Relief had NO entry point on `/me` at all until now.
- FairPath AI: 9 new deterministic intents total this session (jobs, housing, credit dispute status, record relief coverage, create/my resumes, my meetings), each Browser-verified live as a guest where guest-accessible, all with local test coverage.
- Home's real-state status card now surfaces the next upcoming meeting (owner-only RLS read), alongside the existing credit/record-relief/document/resource chips. Still no fake scores/streaks/points anywhere.
- Resume Studio and Virtual Meetings are fully built (schema, RLS, local tests, screens) — see commits `83b8250` and `67da9bd`. Both need `npx supabase db push` before any signed-in testing.
- Every new screen uses `ScreenFrame`, which owns bottom-nav rendering and structurally prevents duplicates — so navigation consistency across all new routes is guaranteed by construction, not by manual per-screen review.
- 38/38 offline checks green throughout. All new gated routes confirmed redirecting to sign-in with `returnTo` preserved: `/resume-studio`, `/meetings`, `/credit/correct-identity`, `/record-relief/coverage`, `/me`, `/home`.
- NOT done tonight: a full manual click-through of the entire new-member journey (blocked without a signed-in DEV member), Documents cross-module audit beyond what was already built, terminology normalization pass.

## NOT tested (do not assume working)
- `qa-dev-pass2.mjs` has been syntax-checked and its guard confirmed, but never run against DEV.
- Signed-in screens for every new module (need migrations pushed).
- Edge function `render-document` under Deno; not deployed.
- Native share/print/Files on a physical device.
- Sign in with Apple on device (Apple capability + Supabase provider + dev-client rebuild still external; see `EXTERNAL_SETUP_CHECKLIST.md` section 2). Web Apple OAuth deferred.
- Push notifications, Stripe.

## Rules that still apply
Forward migrations only; no push; no production; Meetings/Resume Studio/Marketplace/Staffing/Partner/Admin not started. Record Relief ships no real legal rules, only jurisdiction names; verified rules are production data still needed.
