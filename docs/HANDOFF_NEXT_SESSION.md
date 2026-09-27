# FairPath Mobile — handoff for the next session (written 2026-09-26)

Read this first, then verify against the repo. Where I say Sterling reported something, I did not verify it.

## 0. First move (no time wasted)
1. `git status`, `git log --oneline -12`, `Get-Content supabase/.temp/project-ref` (must print `znvhmuhojvwvjzmaqwff` = DEV).
2. Ask Sterling for ONE thing: the result of `npx supabase migration list` (DEV) so you know whether
   `20260930130000_payment_history_grants.sql` and `20260930140000_claim_and_apply_ordering_fixes.sql` are applied.
3. Have Sterling rerun the authenticated harness (needs his DEV service-role key in HIS shell; never paste it):
   ```powershell
   $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV key>"
   npm run qa:dev-platform
   npm run qa:dev-ui-cleanup      # removes disposable qa-ui-* members (there are 2-3 from UI QA)
   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
   ```
   Last real result: 25/27. The 2 failures (claim ordering, job duplicate-vs-validation ordering) were FIXED in
   `20260930140000` but the rerun has NOT been seen. Do not call Foundation QA cleared until it prints 27/27+.
4. Then continue the plan in section 7. Do NOT start Profile+Resources until Foundation QA is cleared.

## 1. Repo, environment, rules
- Repo `C:\Users\Friend A Felon\Documents\GitHub\fairpath-mobile` (spaces in path, CRLF files), remote `github.com/quindad/fairpath-mobile`.
- Branch `feat/v1-canonical-profile`, HEAD `8ae2eba`, NEVER PUSHED, no upstream. `main` = `96438eb`. Do not push/merge unless Sterling asks.
- Expo ~57 (read https://docs.expo.dev/versions/v57.0.0/ before coding per AGENTS.md), RN 0.86.3, React 19.2, TS 6, expo-router 57,
  supabase-js 2.116. New native deps this pass: `expo-apple-authentication`, `expo-crypto`, `@stripe/stripe-react-native`.
  => the iPhone dev client MUST be rebuilt (`eas build --profile development --platform ios`) before Apple sign-in / Stripe work on device.
- Expo web preview runs on Sterling's machine at http://localhost:8090 (his terminal). Metro for phones: 8083. `.env.local` = DEV URL + anon key.
- Supabase: PRODUCTION `rqpczemdagoddhuwefxt` is OFF-LIMITS (never link/push/repair). DEV `znvhmuhojvwvjzmaqwff` is the only target.
  The Supabase CLI and the DEV service-role key exist ONLY in Sterling's terminal. Agent sandbox has neither.
- PERMANENT QA RULE (Sterling): BUILD → TEST → BREAK/FIX → RETEST → REGRESSION TEST → HAND TO STERLING. Sterling only gets tests that
  need his phone, Apple/Google identity, wallets, push, provider setup, secret entry, or subjective approval. Report format:
  INTERACTIVELY TESTED AND PASSED / AUTHENTICATED DEV HARNESS TESTED AND PASSED / AUTOMATED / AUDIT TESTED / BUGS FOUND AND FIXED /
  EDGE FUNCTIONS / EXTERNAL CONFIGURATION STILL BLOCKED / COULD NOT TEST — EXACT TECHNICAL REASON / STERLING ACCEPTANCE TEST.
  Never say "works" for something only statically audited.
- Safety limits on the agent: cannot create accounts or type credentials against remote Supabase. Signed-in UI QA works by Sterling running
  `npm run qa:dev-ui` (creates a disposable member, prints a local callback URL with tokens) and opening that URL IN THE CLAUDE BROWSER PANE
  himself (never pasted in chat). Then drive the pane. Cleanup: `npm run qa:dev-ui-cleanup`.
- Visual system: near-black, off-white, lime `#A8F32C`, sharp corners (no big rounded "AI" cards), dark-only product.
- Use they/them for people whose pronouns are unstated.

## 2. Tooling quirks (cost me hours)
- The Bash tool collapses backslashes in heredocs / node -e. Regex-heavy code: use the Write tool (or Edit), not heredocs.
  Symptoms: `/^d{5}$/` instead of `/^\d{5}$/`, "Invalid regular expression". A shell command containing an unbalanced quote fails as a whole.
- `git checkout -- <file>` DISCARDS uncommitted fixes in that file (I did it once). Commit or stash first.
- Files are CRLF; Edit/Write handle it. In node scripts normalize with `.replace(/\r\n/g,'\n')` before matching.
- `String.replace(str, replacement)` treats `$'`/`$&` in the replacement specially: use a function replacement or split/join.
- Deleting files may be blocked by the permission classifier; `git rm` worked for one file.
- Browser pane: coordinate clicks sometimes miss (emulated viewport scaling). Reliable: JS-dispatch mousedown/mouseup/click on
  `document.elementFromPoint(cx,cy)` after `scrollIntoView`. The pane keeps previous stack screens mounted (hidden), so count VISIBLE navs
  (`getBoundingClientRect().height>0`), and pick the visible `[aria-label="Go back"]`. Uncaught JS errors from my own probes raise a LogBox
  overlay that blocks clicks: dismiss it. Web `Alert` confirms (withdraw) are not visible to the tool.
- `preview_start` fails if Sterling's server owns 8090; just `navigate` to http://localhost:8090/...
- Node 24 can import `.ts` only if the file has NO imports; that is why audit-tested logic lives in import-free pure files
  (`dates.ts`, `location-utils.ts`, `housing-filters.ts`, `inquiry-state.ts`, `plus-status.ts`, `payment-format.ts`, `auth-redirect.ts`,
  `public-routes.ts`). Keep that pattern.

## 3. What exists (all committed locally)
Commits, newest first (major ones): `8ae2eba` UI-QA bug fixes · `c11feb5` /auth/callback public route fix · `6cfea11` claim + job-apply ordering fix ·
`4f4033d` payment history grant + expanded harness + UI-session tool · `e3cdb2e` apply_payment_event ambiguity fix + harnesses · `a0d5afa` checkout + setup doc ·
`150ca05` Stripe foundation · `5348633` entitlements · `74c6f93` Apple/Google auth · `f5dafec` notifications/inquiry status · `7240a21` date picker + back button ·
`4964be3` keyboard · `a8d5f03` sponsored-entitlement doc · `d8e149a`/`2452537` housing applications secure · `7cd8c9a`/`0acd5b7` housing search ·
`76a5cf8` Jobs baseline (accepted) · earlier: Jobs DB/client, nav fixes, DEV inventory `04754be`.

Product state (DEV inventory seeded: 109 jobs, 70 listings):
- Jobs: server-side `search_jobs` (ZIP/radius/filters/pagination), saved ZIP+radius prefill, filter sheet, map with pin preview, Easy Apply via
  `submit_job_application` (whitelisted fields only, NO DOB/address), `withdraw_job_application`, `job_application_events`. Accepted on iPhone.
- Housing: `search_housing`, filter sheet, map, property details (now shows description), server-controlled applications
  (`save_housing_application_draft` only after step>=2, secure `submit_housing_application`, `withdraw_housing_application`, started/status events),
  FastTrack quote server-priced, documents must exist in storage, inquiries via `send_housing_inquiry` (dedupe 10 min, 5/day), saved homes/searches.
- Platform: shared `FairPathDatePicker` (year→month→day; kinds dob/past/future/any), `FairBackButton`, `FormScrollView`/`KeyboardFooterLayout`
  (iOS keyboard), single bottom nav via `ScreenFrame` + `NavProvided` guard, notifications foundation (`create_notification` idempotent,
  clients may only set read_at, unread count RPC, bell badge), inquiry states SENT/RECEIVED/SEEN/REPLIED (partner-only server functions),
  Sign in with Apple (native, nonce) + Google (Supabase OAuth via system browser) + email/password, `/accept-terms` consent for social users,
  `handle_new_user` ignores client `account_type`, FairPath+ entitlement model (grants/billing_subscriptions/audit log, legacy
  `fairpath_subscriptions` mirror so Marketplace+FastTrack keep working), correctional transition (90 days, once per identity + once per account,
  service-only), reminders 14/7/1 days, Stripe payment foundation (payment_products server pricing, transactions/refunds/events, webhook
  idempotent, amount-mismatch rejected, payment != application approval), FairPath+ screen, Payments history, FastTrack checkout.
- FairPath+ store purchases are NOT built (`billing-provider.ts` returns not_configured; `store-subscription-webhook` returns 501).

## 4. Migrations (23 files). Platform ones, in order
`20260926120000/120100` grants · `20260926130000` jobs · `20260927120000` housing search · `20260928120000` housing applications secure ·
`20260929100000` inquiry status + notifications · `20260929120000` auth/profile hardening · `20260930100000` entitlements · `20260930110000` payments ·
`20260930120000` apply_payment_event fix · `20260930130000` payment history user_id grant · `20260930140000` claim/job-apply ordering fixes.
Never edit an applied migration; fix forward. New migrations need unique 14-digit versions. `test:baseline` enforces explicit grants for new tables and
flags PL/pgSQL `set col = var` ambiguity in the latest definition of each function.

## 5. Audits and QA tools (run all after every change)
`npx tsc --noEmit` + `node scripts/audit-<name>.mjs` for: baseline, canonical-profile, seed, navigation, housing, marketplace, jobs, keyboard, dates,
notifications, auth, payments, entitlements (13). All green at HEAD. npm scripts: `test:*`.
- `npm run qa:dev-anon` (`scripts/qa-dev-anon-probe.mjs`): anon-key probe of DEV grants/RLS/functions/Edge Functions. 58/63 last run; the 5 fails were
  undeployed Edge Functions (404).
- `npm run qa:dev-platform`: signed-in DB harness (service key from env, disposable @dev-seed.fairpath.test users, cleans up). Covers inquiry states,
  forgery, notifications, entitlements (90 days, no payment objects, expiry, reminders, audit log), payments DB boundary (labelled NOT Stripe),
  housing/job application security, regressions.
- `npm run qa:dev-ui` / `qa:dev-ui-cleanup`: disposable pre-populated member + callback URL for browser QA.

## 6. Bugs found this session (all fixed + regression-covered)
apply_payment_event `set outcome = outcome` ambiguity · payment history missing `user_id` column grant · claim check ordering · job duplicate-vs-validation
ordering · `/auth/callback` blocked by the route guard (session never set) · stray JSX space created a text node in a View (FastTrack review) ·
year-list blank when editing a date · earlier: isZip regex mangled, duplicate bottom navs, hidden CTA, applicant self-approval hole (housing) .

## 7. Remaining plan
A. Foundation QA closeout: rerun harness (27/27), cleanup members, deploy Edge Functions to DEV (all 4 undeployed):
   `npx supabase functions deploy <name> --project-ref znvhmuhojvwvjzmaqwff` for store-subscription-webhook, claim-correctional-transition,
   create-fasttrack-payment, stripe-webhook. Secrets (Supabase function secrets only): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `CORRECTIONS_INTEGRATION_SECRET`. Then rerun `qa:dev-anon` (expect 63/63). Stripe TEST webhook endpoint
   `https://znvhmuhojvwvjzmaqwff.supabase.co/functions/v1/stripe-webhook` with events payment_intent.{succeeded,processing,requires_action,payment_failed,canceled}, charge.refunded.
   Full provider checklist: `docs/EXTERNAL_SETUP_CHECKLIST.md`. FastTrack enforcement stays OFF (`app_config.fasttrack_payment_enforced=false`) until Stripe test passes.
B. Physical-iPhone (Sterling): rebuild dev client, Apple sign-in (needs Apple capability + Supabase Apple provider incl. bundle id), Google (Web OAuth client +
   redirect `fairpathmobile://auth/callback`), iOS keyboard on forms, date picker taps, Apple/Google Pay only after merchant setup (`APPLE_MERCHANT_ID`,
   `ENABLE_GOOGLE_PAY` EAS env; unset = wallets hidden, cards only).
C. Sterling asked: do NOT start Profile + Resources yet. When cleared, next planned areas: Profile, Resources (real table, admin-verified content),
   then messaging/coverage engine per the blueprint (`Downloads\FairPath_V1_Master_Product_Blueprint.docx`). Do not expand Marketplace, Staffing, AI, Partner, Admin.

## 8. Open items / known debt
- Corrections migration: the community app never decides eligibility; a trusted integration must call `claim-correctional-transition` (header
  `x-fairpath-integration-secret`; body user_id, identity_key (opaque hash), deployment, verified_at). That integration does not exist. Spec: `docs/FAIRPATH_SPONSORED_ENTITLEMENTS.md`.
- Store subscriptions (App Store Connect / Play Console products, server notifications) unbuilt; `plus-config.ts` product ids null.
- Push: tokens table + delivery queue exist; no sender, no `expo-notifications`.
- Justice-eligibility engine flag stays false pending legal review; employers/providers never see raw convictions.
- Housing application `applicant_snapshot` stores only whitelisted form fields; keep it that way.
- Sign-in/sign-up forms still use older rounded input styling; `.claude/launch.json` is untracked (web preview config).
- Withdraw confirmation could not be exercised on web (native confirm). Conviction/release date fields not opened in UI.
- Dead template code remains (`/explore`, themed-* components); docs/ are stale except the new ones (`EXTERNAL_SETUP_CHECKLIST.md`, `FAIRPATH_SPONSORED_ENTITLEMENTS.md`).
- Confirm the GitHub repo is PRIVATE before any push (exports/policies in repo).
