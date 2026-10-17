# JUICE / CLAUDE — FAIRPATH MOBILE: FULL PLATFORM COMPLETION DIRECTIVE
Issued by FairPath founder, October 6, 2026. Treat this as a build order, not a request for a plan alone.

## The mission
Go DEEP. Inspect every important mobile feature, close implementation gaps, run meaningful tests, and produce actual working code in **fairpath-mobile**. This is a national opportunity platform, NOT just a felony app. FairPath Industries builds opportunity infrastructure. FairPath App (formerly Friend A Felon) is its flagship. Mission: **Technology for good. Opportunity for everyone.** Brand: electric lime #A8F32C as a controlled accent, charcoal/black/white, refined product typography, no generic AI-generated rounded-card look. Dark AND light themes. The mobile experience should feel like a professional consumer product, not a government portal.

## Working directory / actual starting state
Repository: C:\Users\Friend A Felon\Documents\GitHub\fairpath-mobile
Git current branch (as inspected): feat/v1-canonical-profile
Inspected head: 72f4060 ("Build retention engine and member check-ins")
Existing untracked file: big.txt — DO NOT open unnecessarily, remove, modify, stage or commit it. Other code may have changed: recheck status before work.
Repo uses Expo 57 / React Native 0.86 / Expo Router / Supabase Auth + Postgres / TypeScript.
Existing source of truth: src/core/marketplace/marketplace-service.ts; docs/FAIRPATH_MOBILE_LAUNCH_BOARD.md; docs/FAIRPATH_MARKETPLACE_BUILD_STATUS.md; docs/MOBILE_BUILD_EXIT_CRITERIA.md; docs/FAIRPATH_5_WEEK_LAUNCH_PLAN.md; docs/PRODUCTION_DATA_READINESS.md; docs/HANDOFF_NEXT_SESSION.md; scripts/run-all-tests.mjs. Read their contents, but verify every status against current code, actual database, and runtime; docs can be stale.
DEV Supabase project ID znvhmuhojvwvjzmaqwff. There is a different production project: DO NOT write to production. Do not reveal local .env.local or other secrets.

## IMPORTANT cross-platform handoff
Desktop Marketplace is now coded in public website repo:
C:\Users\Friend A Felon\Documents\GitHub\fairpath-public-site
Commit 93d0e1b for Marketplace; subsequent PostCSS security update commit 76ab93e.
Contract file: fairpath-public-site\docs\MARKETPLACE-CROSSPLATFORM-V1.md
Read this file and related web components as READ-ONLY references; do not edit the public site unless explicitly asked. We need true interoperability: same Supabase instance, auth.users.id, public.profiles, data tables, RPC lifecycle, statuses, categories, image/storage paths, quota, consent versions, QR semantics and privacy. The website is not yet fully verified with real giver/recipient OAuth sessions and production configuration, so validate independently, do not assume live feature completion.
On web: designed UI for desktop FB-Marketplace-like grid/sidebar/map, photos, seller listing management, saved items, claim pipeline, safe-pickup privacy and QR. On mobile: mobile-native, photo-first, intuitive, fast and equal feature coverage.
DO NOT create duplicate marketplace tables or a second auth silo.

## Foundation build protocol — FIRST
1. Run git status, branch, newest commits; identify active work and avoid overwriting it. Keep all edits limited to mobile repo. Do NOT push to GitHub, merge, switch branches, rewrite history or modify production without founder approval.
2. Run npm run typecheck and npm run test:all to record actual baseline; run additional security, marketplace, auth, entitlement, notification, navigation and device audits.
3. Inspect current mobile routes, components, Supabase schema/migrations/RPC definitions, auth provider code, RLS, storage policies, feature flags, notifications, migrations and DEV deployment reality. Produce a precise matrix: WORKING / IMPLEMENTED-NOT-VERIFIED / BLOCKED-EXTERNAL / MISSING / DEFERRED and prioritize P0/P1/P2. Do not present a previously written document as proof.
4. Pick highest-impact P0 and build actual code immediately, not just plans. Continue implementing coherent passes with local commits. Use a no-secrets, no-fake-data discipline. For each pass, typecheck, run relevant tests, add regressions, document results; repair failures before proceeding.
5. Keep a live progress file in docs/JUICE_MOBILE_COMPLETION_PROGRESS.md noting implemented files, local commit IDs, test counts, data migrations (draft vs applied), device/provider blockers and next actions. Stop only for truly external credentials, physical hardware or dangerous production changes; otherwise move to next buildable module.

## P0: Mobile Marketplace full product
- Audit and FINISH public/free-goods browse, local search by city/state/ZIP and actual radius, geocoding, category, condition, sorting, filters, empty states, saved items and search, item detail and large multi-photo galleries, photo moderation, correct pagination/infinite scroll. DO NOT create fake production listings.
- Posting: individual and organization giver flows, image upload/reorder/delete with content type and size validation, draft/publish/pause/remove/edit, pickup area public versus private data separation, approval/rejection moderation, reporting, listing expiry, charity/organization dashboards as authorized.
- Recipient journey: anonymous claim requests, server-side fair monthly quotas, seller chooses anonymous claimant rather than seeing identities, one approval, automatic decline/refund others, 48-hour window, approved/ready/picked_up/no_show/expired/cancel states, recovery, pickup receipts, cancellation behavior, audit events and idempotency. Enforce existing RPCs rather than client writes. Test with two different signed-in DEV accounts and malicious cross-user attempts.
- Real map integration: list/map toggle, real map markers from coarse item locations, functional radius/location, *never* show private home addresses or precise pickup coordinates publicly, public safe-pickup place finder (police stations, libraries, designated business locations) with verified place details, permission/hours caveats, selection flow and navigation. Provider tile licensing/rate limits and key requirements must be researched and documented rather than invented.
- Pickup handoff: secure per-approved-claim QR/token/code generation; camera scan for giver if device supports it, manual code fallback, server-authoritative verify, no public share or secret in URLs, short usable expiry, replay protection, check-in, receipt and evidence event, prevent forged/replayed QR; phone camera permissions. Website currently encodes fairpath:pickup:v1:<claim-id>:<pickup-code>; align deliberately but validate compatibility and never consider QR itself authorization.
- No general direct messaging. Only consent-aware, tightly scoped pickup coordination if truly required by backend and privacy rules. Reporting, blocking/abuse, rating system after verified handoff, notifications, no-show/reschedule and safety escalation. Account type supports anyone—not only justice impacted.
- Marketplace's web and mobile read/write same rows and auth IDs. Write repeatable cross-platform contract/integration tests. Quotas MUST reflect frozen Free=1, FairPath+=7, Premium=7 marketplace claims per billing month; for Premium add only after checking real entitlement model and founder-approved database flow. Don't assume a pricing change implies deployment.

## P0: Authentication / account onboarding
- Audit sign up/in, email/password, password reset, magic link, phone if already supported, guest browse, email verification, session restoration, protected routes, secure consent ledger, onboarding and account deletion request. Cross-device auth identity, RLS, session expiry and account linking when providers overlap.
- Google native/web OAuth, Sign in with Apple (including proper iOS nonce and capability), Microsoft personal/business Outlook via Supabase Azure provider, Yahoo accounts via secure email login/magic link. Yahoo OAuth is NOT a native completed option: use email login unless a supported fully configured Yahoo integration can be securely implemented. Do not invent an enabled provider. Ensure OAuth failure/cancel flows work and no provider silently produces duplicate profiles.
- Build functional screens, callback logic and QA harness first; list actual external credentials, iOS hardware or Supabase provider configuration needed before claiming real login E2E.
- Onboarding must be accessible, welcoming, not presumptively label users justice-impacted. Opt-in for sensitive disclosures, role choice individual/giver/employer/housing/org, privacy and verified consent.

## P0: Shared entitlements & pricing synchronization
Founder approved member **product policy** (not live billing): Free $0/5 AI credits/mo/1 marketplace claim; FairPath+ $2/mo/30 AI credits/mo/7 claims; FairPath+ Premium $4.99/mo/100 AI credits/mo/7 claims. One-time refills 15 credits $0.99, 40 credits $1.99, 100 credits $3.99; purchased credits 12-month expiry, included credits do not roll over; no auto-refill, negative balances or surprise charges.
AI debit examples: resume rewrite 2, job fit 1, resource concierge 1, personalized plan 2, record-relief explanation 2, dispute-letter draft 2 (Premium-only), full credit report analysis 10 (Premium-only). Never charge credits to browse/apply jobs, find housing, access urgent resources, read basic record-relief info or essential member services. AI costs need measurement, payment/app-store compliance and strict server-side metering before enabling checkout; do not silently enact a migration or charge consumers.
$10 FastTrack discount mentioned in prior proposal must be gated pending frequency and economics review, not repeatedly exploitable. B2B prices NOT founder-finalized.
Unify member tiers/credit ledger across mobile and web. Distinguish PLANNED from ACTIVE. Keep an audit trail of entitlements and atomic usage.

## P0: Whole mobile app completion — not only Marketplace
Jobs: real jobs ingestion/provenance/verified inventory, role-matched jobs, applicant pipeline, safe employer access, application statuses, saved search, notifications and zero-market waitlist. Prove no fake opportunities in release.
Housing: real properties/provenance, advanced filters, map/list, applications and status, tour scheduling, standard/FastTrack flow, screening integration and payment escrow safety (only when reviewed), privacy and landlord case-handling; no fake guarantees.
Resources: national/state/local inventory with 17 categories, needs-language search and urgent-help filter, stale/verified data, multilingual/accessibility where possible, referral tracking and 24h providers only when verified.
AI: resume builder/edit/export, job-fit score/explanations, resources concierge, My Plan, document wallet, record-relief state/federal source-grounded guidance, safe credit report parsing/error detection/user-approved dispute drafting, proper PII handling, usage metering. No medical/legal/credit outcome guarantees and no fabricated sourced rules.
Member Experience: profile completeness/readiness, progressive onboarding, saved items, notifications, meetings/retention check-ins, permission prompts, accessibility, responsive layout, dark/light themes, error/offline/empty/loading states, search, mobile device QA.
Integrations: Stripe/App Store/Play Billing readiness, push tokens, emails, Apple/Google OAuth, QR-camera, real analytics and crash reporting. No secret exposure, no silent payments.
Shared org platform: mobile member-side only where appropriate; admin and partner workflows belong in FairPath Command Center with role separation and server-side RBAC/RLS. Do not duplicate Admin in consumer mobile.

## Tests, security and quality gates
Run existing scripts (npm run test:all, npm run typecheck, npm run test:marketplace, npm run test:auth, npm run test:security, npm run test:entitlements, npm run test:notifications, etc). New test assertions must prove behaviors, not just inspect keyword presence. Check RLS from anonymous/recipient/giver/cross-user, other organization's items, unsafe photo mime types, upload failure, race/duplicate claims, quota boundaries across rollover, cancelled authorization, expired pickup, code replay/forgery, safe pickup data not in public joins, QR camera permission refusal, app-store policy and reduced-motion/large-font accessibility. User flow tests in actual Expo/web and ideally physical Android/iPhone; label unavailable tests honestly. Avoid applying migrations to live production. Implement migrations in files first; DEV application must be clearly disclosed and validated.
Explore safe performance wins: virtualized lists, image caching, query pagination, Supabase request coalescing, no unnecessary long synchronous work on navigation, skeletons and adequate offline states.
Every new SDK/package should get a security/license/Expo version sanity check; preserve lockfile reproducibility. No wholesale "npm audit fix --force" breaking upgrades.

## Work cadence and success reporting
Build multiple independently testable logical passes; do not pause to ask "what next?" after each pass. Continue until meaningful P0/P1 work is exhausted or a real external blocker stops progress. No invented results. For each pass report:
- Code changed (exact paths and local commit IDs)
- End-to-end user flows completed vs only UI-ready
- Tests (commands, actual pass/fail counts), Expo/web screenshots or device proof if available
- DB migrations created/applied to DEV only (or NOT applied), and what must be approved
- New known blockers, security concerns, secrets/provider/device credentials needed from founder
- Approx completion by subsystem only when evidence supports it; never an arbitrary percentage
- The NEXT actionable implementation you're starting without waiting

## Nonnegotiable boundaries
No direct GitHub push, no production schema changes, no production payments, no irreversible or destructive actions, no secrets printed/stored in commits, no touching other repos, no deleting big.txt, no manufactured inventory. If a blocker is truly external, move to another buildable task rather than stopping. Make bold production-quality software, not placeholder cards or a markdown-only plan. Keep FairPath's identity broad; opportunity infrastructure for all people, with justice-impacted services the flagship origin. Treat this directive as authorization to inspect and implement locally; NOT authorization to launch untested paid features.
