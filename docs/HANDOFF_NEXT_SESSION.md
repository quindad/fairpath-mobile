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

## NOT tested (do not assume working)
- `qa-dev-pass2.mjs` has been syntax-checked and its guard confirmed, but never run against DEV.
- Signed-in screens for every new module (need migrations pushed).
- Edge function `render-document` under Deno; not deployed.
- Native share/print/Files on a physical device.
- Sign in with Apple on device (Apple capability + Supabase provider + dev-client rebuild still external; see `EXTERNAL_SETUP_CHECKLIST.md` section 2). Web Apple OAuth deferred.
- Push notifications, Stripe.

## Rules that still apply
Forward migrations only; no push; no production; Meetings/Resume Studio/Marketplace/Staffing/Partner/Admin not started. Record Relief ships no real legal rules, only jurisdiction names; verified rules are production data still needed.
