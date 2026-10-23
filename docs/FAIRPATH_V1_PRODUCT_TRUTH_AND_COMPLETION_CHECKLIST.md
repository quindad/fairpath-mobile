# FAIRPATH MOBILE V1 — PRODUCT TRUTH & RELEASE COMPLETION CHECKLIST
**Prepared:** 2026-10-23 | **Scope:** member mobile only | **Branch:** development/mobile-v1-completion
**Rule:** This document is the acceptance checklist, not a claim of completion. An existing route, green static audit or committed UI is NOT proof a user journey works.
**Progress definitions:** [ ] pending/unverified; [x] verified with evidence and committed. Add SHA + test proof when checking any item.
**Release objective:** all P0 journeys proven on DEV AND actual iPhone, no known P0/P1 defects, honest treatment of unavailable dependencies.
**DO NOT:** apply DEV migrations, deploy, push, touch production, buy APIs, or overwrite other agents' uncommitted work without explicit approval.

## VERIFIED CODE INSPECTION FINDINGS (not native testing)
- EXP-001: src/app/explore.tsx hardcodes 18 destinations as status 'live' based on route, without per-feature backend or E2E readiness.
- START-001: src/app/entrepreneurship.tsx only offers a 15-step checked list in AsyncStorage, text idea + Signal response, and generic program reference cards; no durable business workbook or lesson completion evidence.
- FOOD-001: src/app/food-rescue.tsx calls loadMarketplace({foodRescueOnly:true}), links back to /marketplace, links food cards to /market-item/[id], and references Marketplace safety. src/app/marketplace-list-item.tsx lets a Marketplace donor toggle 'SHOW IN FOOD RESCUE'. Separate user experience/data policy not implemented.
- GIVE-001: src/app/community/can-help.tsx mixes listing Marketplace items, Food Rescue navigation, open request board and Marketplace claim-limit explanation. 'I can help' is not a coherent action.
- PATH-001: src/core/opportunity/v1-pathways.ts maps many paths into generic /resources or /community/help-now, not a dedicated guided flow; resolveGrowthDiscovery currently maps legal -> transportation, record_relief -> education_scholarships, housing -> family_center. Fix misrouting with regression coverage.
- PREF-001: **Fixed in `01b6755`** — Neither → explicit No; veteran opt-in in profile_answers.
- PREF-002: **Mostly fixed in `01b6755` + follow-up** — Me/Explore/Home/Signal gated; justice-records + profile-readiness gated; notifications TBD.
- PREF-003 (in progress): `member-capabilities-core.ts` + `/member-tool-preferences`. P0-004 DEV matrix **NOT TESTED**.
- EXP-001 (in progress): `explore-readiness.ts` wired in Explore UI; P0-001 inventory in engineering queue doc.
- PATH-001 (partial): `resolveGrowthDiscovery` special-cases `record_relief`, `legal`, `housing` routes — see `tests/member-capabilities.test.ts`.
- RR-001: Record Relief home loads cases/evaluations and links add, scan, finder, detail, coverage. src/core/record-relief/relief-service.ts contains both shared engine/Edge evaluation AND coverage based on DB record_relief_rules; metadata/comments indicate previous divergence for manually entered cases. Actual live DEV rules, scan, saved results and iPhone journey NOT VERIFIED. Treat 57-jurisdiction registry existence separately from verified live rule coverage.
- SIG-001: prior Signal UI and gateway commits exist; do not infer native tool execution, backend conversation sync, or streaming completion from test names.
- WORKTREE: extensive modified/untracked files belong to parallel agents; never use git add -A, git reset, git clean, blanket stash, or rewrite their work.

## RELEASE GATES — CRITICAL PATH (P0)
- [ ] P0-001: Build one full route-to-data-to-action inventory for ALL Explore destinations and five tabs. Mark LIVE only with working backend proof; distinguish pending, blocked, link-only, unsupported. Verify direct navigation/back/deep links.
- [ ] P0-002: Correct onboarding justice and veteran intent model: explicit Yes / No / Prefer not to say, independent justice/veteran selections, persisted properly, reversible via settings; do not infer felony history from 'Reentry' goal or vague interest.
- [ ] P0-003: Implement ONE canonical member-capabilities/visibility selector applied to Home, Explore, Profile, My Path, Signal suggestions, readiness, notifications and relevant downstream surfaces. By default NO justice prompts/records/relief or veteran-specific prompts for members who did not opt in; separately offer a clear opt-in path later. Preserve privacy and authorization (UI hiding is not RLS).
- [ ] P0-004: Two end-to-end DEV test accounts: non-justice/non-veteran member sees zero justice/veteran personalization; justice-only sees justice not veteran; veteran-only sees veteran not justice; both sees both; changing choices updates all UI surfaces after reload/reinstall. Test unknown/prefer-not-to-say separately.

### P0-004 harness evidence (Agent H — not a release gate pass)
- **Static gate contract:** `scripts/audit-member-capabilities.mjs` — Explore, Me, fairpath-ai (via `loadSignalSuggestions`), HomeStatus use `loadMemberCapabilities` / filters; `justice-records` uses `JusticeToolsGate`.
- **Onboarding → capability matrix:** `tests/member-capabilities-matrix.test.ts` (seven rows covering skip, single/both opt-in, skip+selection, empty).
- **DEV persistence matrix:** `scripts/qa-dev-member-capabilities-matrix.mjs` — six scenarios PATCH `profiles.justice_impacted` + `profile_answers` (`member.veteran_tools_opt_in`), read back, restore snapshot; requires `--confirm-dev` and `QA_DEV_FREE_PASSWORD` or `QA_COMMUNITY_MEMBER_A_PASSWORD`. Output: `qa-dev-member-capabilities-matrix-results.json` (emails redacted).
- **Still NOT TESTED for P0-004 checkbox:** second DEV account parity, native UI on iPhone after reload/reinstall, and all downstream surfaces (notifications, My Path tiles) under each scenario.
- [ ] P0-005: Record Relief full workflow: create case manually with multiple charges, court/jurisdiction, preserve drafts, save, evaluate, edit, re-evaluate, correct result, sources, missing fields, printable/filing steps, tracking and delete. Use live DEV Edge/RPC and verify persistence after restart; no '57 authorities complete' claim without coverage evidence.
- [ ] P0-006: Record Relief scan workflow: upload consent -> secure storage -> OCR/extraction -> human review/edits -> same deterministic evaluator -> persist and view, including malformed documents, mixed charges, incorrect venue, missing rules, stale rules and unauthorized record access.
- [ ] P0-007: Verify deterministic Record Relief engine parity for manual-entry and scan routes, and reconcile rules table's coverage display with actually supported/verified engine rules. Validate Ohio known noneligible and eligible fixtures, multiple-jurisdiction fixtures and official sources. No AI eligibility overrides.
- [ ] P0-008: Register -> verify -> consent -> onboarding -> Home -> logout -> return, with errors and no loops, on actual iPhone and DEV.
- [ ] P0-009: Expo Go native testing: all main tabs + representative overflow routes, last CTA above nav, keyboard avoidance, safe area, no crash and back navigation.
- [ ] P0-010: Commit discipline: every delivered batch must have owned-file-only commit and exact test evidence; do not mark done from prose status reports. Maintain one live task list here (avoid divergent trackers).

## PRODUCT EXPERIENCES TO COMPLETE (P1)
### Explore & discover
- [ ] EXP-101: Replace generic taxonomy and 'I need help / I want to grow / I can help' duplicates with clear member language and no destination appearing multiple times without a reason.
- [ ] EXP-102: For EACH Explore destination document open -> load -> primary action -> persisted outcome -> revisit -> failure -> device QA; functional service not merely navigation.
- [ ] EXP-103: Improve global search relevance: jobs-only search should not pretend to search all FairPath; verify typed queries land in suitable discovery.

### Startup Academy (real learning and business execution product)
- [ ] START-101: Distinct academy course catalog and useful onboarding by business stage/goal.
- [ ] START-102: Structured lessons and exercises with meaningful content (customer, offer, competition, pricing, costs, business structure, compliance, sales).
- [ ] START-103: Editable saved business idea, one-page plan, basic startup budget, pricing/unit-economics worksheet, first-customer checklist, exports and next actions.
- [ ] START-104: Cloud/user-owned progress across devices (or clearly scoped local-only design with migration plan); avoid meaningless one-tap step completion.
- [ ] START-105: Signal coaches a particular worksheet and saves output with explicit member approval, truthful model/tool limits.
- [ ] START-106: No misleading funding promises; verified resources/links and honest limitations.

### Food Rescue — independent member-facing vertical
- [ ] FOOD-101: Separate /food-rescue home, listing detail, provider donation, rescue request, pickup status and history paths, navigation/breadcrumbs and branding. No Marketplace route dependencies in member-facing flow.
- [ ] FOOD-102: Define food-specific schema/service ownership vs carefully shared lower-level pickup/media infrastructure; no accidental Marketplace claims/pricing/limits applied to Food Rescue.
- [ ] FOOD-103: Donor/partner food donation intake with food-type restrictions, storage/safety, best-by, quantity, time window, approximate location and moderation.
- [ ] FOOD-104: Recipient browse/search by proximity and pickup window, claim/reserve, cancellation, pickup validation, expiry handling, notifications and recipient privacy.
- [ ] FOOD-105: Clear verified fulfillment/audit trail, abuse protection and authoritative safety guidance. Food safety risks must not be hidden under generic item terms.
- [ ] FOOD-106: Two-sided DEV E2E: donor -> moderation -> recipient reserve -> donor accept -> pickup confirm; cross-account protections and expirations.

### Community & “I can help”
- [ ] GIVE-101: Replace 'I can help' catch-all with 'Offer help' or 'Volunteer & give' containing separated choices: respond to request, donate goods (Marketplace), donate surplus food (Food Rescue), volunteer for event/drive. Each choice has a coherent next action.
- [ ] GIVE-102: Show relevant, real open community requests with filters and clear offer -> accept -> fulfill states, not a Marketplace claim-limit explanation.
- [ ] GIVE-103: Community Exchange UI two-account native E2E. Backend historical 13/13 assertions are NOT native UI proof.
- [ ] GIVE-104: Never expose private addresses/identities improperly; RLS and abuse prevention.

### Ten V1 pathways
- [ ] PATH-101: Fix wrong mapping and build one coherent primary action for Skills Exchange.
- [ ] PATH-102: Microbusiness/Entrepreneurship points to actual Startup Academy work product.
- [ ] PATH-103: Education & Scholarships: verified courses/providers, eligibility and dates, save/apply or provider CTA.
- [ ] PATH-104: Family: childcare/family resources matching with location and clear action.
- [ ] PATH-105: Events & Volunteering: actual organization/event discovery and response.
- [ ] PATH-106: Benefits: verified government/provider links and enrollment steps; no unsupported eligibility promise.
- [ ] PATH-107: Health & Wellness: vetted discovery and privacy, not medical advice or health data exposure.
- [ ] PATH-108: Mentorship: program matching/contact/referral path.
- [ ] PATH-109: Transportation: transit/vouchers/license restoration as applicable, real provider CTA.
- [ ] PATH-110: Community Drives: active drives and a real participation or giving flow.
- [ ] PATH-111: Test all ten from Explore -> pathway -> meaningful action -> revisit, and no false 'live' badges.

### Jobs, Housing, Signal, core
- [ ] JOB-101: DEV job find/filter/details/save/apply/track flow, errors, ownership, duplicate submission guard.
- [ ] HOUSE-101: DEV housing find/filter/details/save/apply/status flow, bottom CTA, keyboard, verified data.
- [ ] SIG-101: Native chat UX, authenticated read tool results, privacy and provider health E2E.
- [ ] SIG-102: Real conversation persistence (clarify AsyncStorage vs approved Supabase schema), interruption and credits; don't advertise unsupported streaming.
- [ ] SIG-103: Document upload/vision and grounded legal/resource answers with consent and guardrails.
- [ ] MKT-101: Marketplace free goods moderation, list, browse, claim, accept, pickup, quotas, cancel, history, fraud/RLS tests independent from Food Rescue.
- [ ] PROFILE-101: Profile/edit/preferences persist and drive contextual UI across devices, not just Home quick links.
- [ ] MY-PATH-101: Progress from real member workflows, persistence and accurate current state.
- [ ] RSC-101: Resource/refer workflows with verified provider actions and migration approval gates.
- [ ] PAY-101: Entitlements/credits/safety accounting and honest unavailable paid features. No unauthorized payment activation.

## EXACT ACCEPTANCE REQUIREMENTS — EACH CHECKBOX
For every task mark [x] ONLY when evidence includes:
1. Source files + behavior before/after.
2. DEV endpoint or service used and actual test response (with private values redacted).
3. Positive, negative, signed-out, permission-denied and retry behavior as relevant.
4. Automated checks (tsc / targeted / full regression).
5. On-device iPhone result for UI-affecting tasks; mark NOT TESTED instead when unavailable.
6. Scoped local commit SHA; no unrelated files.
7. Any remaining dependency clearly marked BLOCKED, owner approval required.

## EXECUTION ORDER FOR THE SIX-DAY WINDOW
**Immediate P0**: resolve consent flags + universal visibility logic and broken pathway mappings; finish Record Relief full loop; truthful Explore readiness.
**Parallel product tracks**: substantive Startup Academy, standalone Food Rescue, coherent Community can-help, ten pathways.
**Integration**: Jobs/Housing/Marketplace/Signal, onboarding/accounts, member state/persistence, backend permissions.
**Final gate**: DEV E2E + real iPhone regression + release-candidate checklist; freeze scope and triage.
Do not burn another day replacing labels/badges while feature workflows remain incomplete.

## START HERE — OWNER'S NEXT CURSOR EXECUTION BLOCK
1. Read this file and docs/FAIRPATH_V1_SIX_DAY_EXECUTION_BOARD.md.
2. Audit code + backend contract of each unchecked P0 and P1. Assign independent file ownership to agents.
3. Open tasks PREF-001 to PREF-004, PATH misrouting, RR manual+scan parity immediately.
4. In parallel design full Startup Academy and standalone Food Rescue services/UX.
5. Implement feature slices to real DEV working endpoints; commit each scoped tested slice immediately.
6. Update THIS checklist with evidence and SHA. Never mark untested done.
7. Keep selecting next unblocked task and proceeding until the approved scope is complete or execution/session limits require a checkpoint.
