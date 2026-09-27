# FairPath handoff: max build pass (branch `feat/v1-canonical-profile`)

Nothing here is pushed. DEV project only (`znvhmuhojvwvjzmaqwff`). Production untouched.

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

## NOT tested (do not assume working)
- `qa-dev-pass2.mjs` has been syntax-checked and its guard confirmed, but never run against DEV.
- Signed-in screens for every new module (need migrations pushed).
- Edge function `render-document` under Deno; not deployed.
- Native share/print/Files on a physical device.
- Sign in with Apple on device (Apple capability + Supabase provider + dev-client rebuild still external; see `EXTERNAL_SETUP_CHECKLIST.md` section 2). Web Apple OAuth deferred.
- Push notifications, Stripe.

## Rules that still apply
Forward migrations only; no push; no production; Meetings/Resume Studio/Marketplace/Staffing/Partner/Admin not started. Record Relief ships no real legal rules, only jurisdiction names; verified rules are production data still needed.
