# FairPath Mobile — Master Completion Board

**Single source of truth for app completion.**  
**Branch:** `development/mobile-v1-completion`  
**Verified baseline (2026-10-27):** `npm run test:all` → **125/125**; TypeScript clean.  
**ECC (Claude Code):** `ecc-universal@2.2.3` **core** installed to `~/.claude` with **`--no-hooks`**; Cursor uses `.cursor/rules/fairpath-engineering.mdc` only (no second ECC harness).  
**DEV Supabase:** `znvhmuhojvwvjzmaqwff` (read-only inspection + prior deploys; no production).  
**Physical iPhone:** Metro **8083** + LAN **192.168.40.7** serve iOS bundle (Sprint 2); dev client reconnect per [IPHONE_METRO_RECOVERY_SPRINT2.md](./IPHONE_METRO_RECOVERY_SPRINT2.md) — **device acceptance not signed off**.

Legend: **Complete (verified)** · **Implemented (unverified)** · **Partial** · **UI only** · **Broken** · **Not built** · **Gated/deferred**

---

## Inventory snapshot

| Metric | Count | Evidence |
|--------|------:|----------|
| Expo Router screen files | **134** | `src/app/**/*.tsx`; `audit-navigation.mjs` → 133 route files checked |
| Edge Functions (folders) | **33** | `supabase/functions/*/index.ts` |
| Offline regression checks | **125** | `scripts/run-all-tests.mjs` |
| Major workstreams | **18** | Table below |

---

## Workstream board

### A. Authentication & onboarding

| Feature | Status | Evidence | Gaps / next action | Sev |
|---------|--------|----------|-------------------|-----|
| Email sign-up / sign-in | Implemented (unverified) | `sign-in.tsx`, `sign-up.tsx`, `test:auth`, `test:auth-post-auth` | Device proof: verify-email, session restore, deep link reset | P0 |
| Apple / Google OAuth | Gated | `social-auth.ts`; tasks 013–014 OPEN | Requires Apple/Google config + physical device | P0 |
| Accept terms + onboarding (5 steps) | Implemented (unverified) | `onboarding.tsx`, `test:onboarding` | Full new-user journey on iPhone | P1 |
| Profile completion | Implemented (unverified) | `complete-profile.tsx`, `test:profile` | Keyboard + long-form on device | P2 |
| Account deletion | Partial | RPC/docs in member audits | End-to-end DEV proof | P1 |

### B. Home

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Personalized dashboard | Implemented (unverified) | `home.tsx`, `get_member_home_summary`, `test:home` | Live DEV data + iPhone layout | P1 |
| Quick actions / saved counts | Implemented (unverified) | Home summary strip | — | P2 |
| Notifications entry | Implemented (unverified) | `notifications.tsx` | Push P0-005 | P0 |

### C. Explore & resources

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Category discovery | Implemented (unverified) | `explore.tsx`, pathways | Thin-market honest CTAs; not every category has local inventory | P1 |
| Resource Center search | Implemented (unverified) | `resources.tsx`, `search_resources` RPC, `test:resources` | Location + national toggle UX; iPhone scroll | P1 |
| Veteran / justice pathways | Partial | `veterans.tsx`, `justice-records`, pathways registry | Some cards “not yet reviewed” | P2 |
| Placeholder categories | Mitigated | `thin-market-value.ts` | Audit each explore tile vs real backend | P1 |

### D. Jobs

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Search + filters + location | Implemented (unverified) | `find-jobs.tsx`, `test:jobs`, `test:sql:jobs-e2e` | Live DEV member loop P1-001 | P1 |
| Apply + tracking | Implemented (unverified) | `job-apply`, `job-applications`, RPC | Duplicate apply handling verified in SQL tests | P1 |
| Second-chance matching | Implemented (unverified) | `search_jobs` `p_second_chance` | Employer policy data coverage | P2 |
| My Path / Signal | Partial | Orchestrator + gateway | Multi-need relevance fix landed `b27d471`; re-test iPhone | P0 |

### E. Housing

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Search + listing detail | Implemented (unverified) | `find-housing`, `housing/[id]`, `test:housing` | Member loop P1-002 | P1 |
| Applications + inquiries | Implemented (unverified) | `housing-apply`, inquiry threads | Inquiry replies not real-time (honest copy) | P2 |
| Documents / tours | Partial | Several `housing-*` routes | DEV proofs | P2 |

### F. Record Relief

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Case tracking + scan | Implemented (unverified) | `record-relief/*`, `test:relief`, SQL relief tests | Legal review gate P1-004 | P1 |
| Nationwide rules engine | Partial | Migrations + `evaluate-record-relief` | Unsupported jurisdictions honest; no invented eligibility | P1 |
| Signal explanations | Implemented (unverified) | `record-relief-explanation` Edge | Provider secrets / device | P2 |

### G. Signal AI

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Conversation + credits | Implemented (unverified) | `fairpath-ai.tsx`, gateway, `runSignalCall` auth order | iPhone keyboard fix `b27d471` — **await user re-test** | P0 |
| Multi-need tool execution | Implemented (unverified) | Gateway + orchestrator + relevance module | Irrelevant financial backfill fixed; DEV gateway deployed | P0 |
| Write-tool confirmation | Complete (verified) | `detectWriteToolRequest`, notify before route | — | — |
| Attachments | Partial | Letter explainer route | Full attachment UX | P2 |
| Paid model path | Gated | Signal chains; no secrets in repo | Explicit approval before spend | — |

### H. My Path

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Goals + plan items | Implemented (unverified) | `my-path.tsx`, opportunity sync tests | Force-close persistence on device | P1 |
| Cross-feature sync | Implemented (unverified) | `member_opportunity_plan_items`, QA scripts | Multi-device | P2 |

### I. Community Exchange & Marketplace

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Listings + claims | Implemented (unverified) | `marketplace*`, SQL marketplace tests | Community exchange E2E on DEV | P1 |
| Help exchange | Partial | `community/*`, draft migrations | Apply draft migrations on DEV (approval) | P1 |
| QR / pickup | Partial | Claim flows | Device QA | P2 |

### J. Credit Studio

| Feature | Status | Evidence | Gaps | Sev |
|---------|--------|----------|------|-----|
| Upload + private storage | Implemented (unverified) | `credit-service.ts`, RLS migration | Extraction requires explicit consent + Edge | P1 |
| Extraction → 48 accounts (user) | Implemented (unverified) | User iPhone screenshots; `validateExtraction` tests | Source PDF not in repo; regression tests added | P1 |
| Review + disputes | Complete (verified) offline | `test:credit`, stage machine SQL | Settled-account SQL nuance — proposed copy in UI | P2 |
| Signal explanations | Partial | `credit-report-explanation`; client `signalPlainText` | **Edge prompt updated locally — deploy needs approval** | P1 |
| Counters (48 / 47 / 11) | Implemented (unverified) | DB-derived; `explainAccountConfirmCounts` | User to verify one confirmed account explains 47 | P2 |

### K. Other product surfaces

| Surface | Status | Notes |
|---------|--------|-------|
| Food Rescue | Implemented (unverified) | `food-rescue/*` |
| Startup Academy | Implemented (unverified) | `academy.tsx`, cloud sync constants |
| Entrepreneurship | Implemented (unverified) | `entrepreneurship/*` |
| Resume Studio | Implemented (unverified) | SQL + routes |
| Documents | Implemented (unverified) | Render handler tests |
| Payments / Plus | Gated | Stripe/IAP P0-006 |
| DEV integration health | Complete (DEV only) | `dev-integration-health.tsx`, Profile → DEV only |

---

## P0 blockers (confirmed open)

| ID | Blocker | Owner | Next action |
|----|---------|-------|-------------|
| P0-SIGNAL-IPHONE | Signal keyboard / composer on physical iPhone | User + eng | Metro OK; reconnect `exp://192.168.40.7:8083` — see IPHONE doc |
| P0-SIGNAL-RELEVANCE | Job + transport returned irrelevant financial cards | Eng | Code + tests green; **device re-test** |
| P0-001 | DEV cloud migrations not fully reconciled | Operator | [DEV_MIGRATION_RECONCILIATION_SPRINT1.md](./DEV_MIGRATION_RECONCILIATION_SPRINT1.md) — no repair applied |
| P0-RESOURCES-OH | Thin DEV inventory vs national product goal | Eng | [RESOURCE_COVERAGE_MATRIX_SPRINT2.md](./RESOURCE_COVERAGE_MATRIX_SPRINT2.md); Ohio batch after approval |
| P0-002–003 | Apple/Google sign-in not device-proven | Config | EAS + provider setup |
| P0-005 | Push E2E | Device QA | Token registration + tap |
| P0-006 | IAP / Stripe sandbox | Billing | Sandbox purchase proof |
| P0-007 | Password reset deep link | Device QA | Inbox + `fairpathmobile://` |
| P0-008 | Android Maps key | Config | `EXTERNAL_INTEGRATION_REGISTER.md` |

---

## iPhone acceptance matrix (not complete)

| Journey | Automated | Device status |
|---------|-----------|---------------|
| Sign in + session restore | Partial (`test:auth-post-auth`) | **Not verified** |
| Onboarding complete | `test:onboarding` | **Not verified** |
| Local resource search | SQL + RPC tests | **Not verified** |
| Job search + save | Audits + SQL | **Not verified** |
| Housing search + save | Audits + SQL | **Not verified** |
| Signal multi-need | `signal-resource-relevance.test.ts`, `signal-iphone-journey.test.ts` | **Automated 7/7 — device re-test required** |
| My Path persistence (force-close) | Unit tests | **Not verified** |
| Record Relief open case | Audits | **Not verified** |
| Community / Marketplace | SQL + partial QA JSON | **Not verified** |
| Credit Studio 48-account flow | User reported working | **Accuracy pass in progress** |
| Keyboard / tabs / scroll | Keyboard audit | **Signal fix pending device** |

---

## First five implementation priorities (this mission)

1. **P0-SIGNAL-IPHONE** — User re-test Signal composer (Metro reload, build `e52815e1`).
2. **P0-SIGNAL-RELEVANCE** — Same session: job + transport prompt on DEV with ZIP set.
3. **Credit Studio** — Deploy `credit-report-explanation` when approved; settled/Verizon copy (UI done).
4. **P0-001** — Reconcile DEV migrations with repo (operator, read-only diff).
5. **P1-001 / P1-002** — Run jobs + housing DEV member loops with documented accounts.

---

## Sprint 1 execution log (2026-10-26)

| Task | Root cause | Files | Tests | DEV | iPhone |
|------|------------|-------|-------|-----|--------|
| Signal keyboard/composer | Double keyboard insets + no safe-area on composer | `FormScrollView.tsx`, `fairpath-ai.tsx` (`footerScroll`, `chatScrollRef`, `useSafeAreaInsets`, `onFocus` scroll) — base in `b27d471` + sprint padding | `audit-keyboard`, `signal-iphone-journey.test.ts` | N/A (client) | **OPEN — user re-test** |
| Multi-need relevance | Nationwide `search_resources` + no financial filter | `signal-resource-relevance.ts`, orchestrator, gateway (`b27d471`) | `signal-resource-relevance.test.ts` | Gateway deployed prior session; re-deploy if `_shared` changed | **OPEN** |
| Missing location (“near me”) | Silent nationwide search when no ZIP | `nearMeRequiresZip`, orchestrator skip; sprint: `nearMeLocationNudgePart` + `/location-setup` action in `fairpath-ai.tsx` | `signal-resource-relevance`, `signal-iphone-journey` | — | **OPEN** |
| Credit audit regression | UI copy moved off `credit/index.tsx` | `credit/index.tsx`, `CreditStudioHome`, `signal-plain-text.ts`, etc. (uncommitted) | `test:credit`, `credit-extraction-regression` | — | User reported working; Markdown fix **unverified** |
| DEV schema drift | 37 remote-only + ~30 local-only migrations | — | `db push --dry-run` blocked | **Reconciliation doc only** | — |

**Sprint 1 docs:** [DEV_MIGRATION_RECONCILIATION_SPRINT1.md](./DEV_MIGRATION_RECONCILIATION_SPRINT1.md)  
**ECC review:** Cursor subagents unavailable (usage limit); use Claude Code `code-reviewer` / `security-review` skills on this diff.

## Sprint 2 execution log (2026-10-27)

| Task | Root cause / gap | Files | Tests | DEV | iPhone |
|------|------------------|-------|-------|-----|--------|
| Metro / bundle health | User could not load app | — | iOS bundle HTTP 200 ~5.9MB | N/A | **Reconnect LAN URL — user action** |
| Location nudge (“near me”) | No ZIP → weak results | `fairpath-ai.tsx` | `signal-iphone-journey` | — | OPEN |
| Resource coverage matrix | No evidence-backed counts | `resource-coverage-matrix-sprint2.mjs`, catalog OH sources | dry-run catalog | RPC snapshot in JSON | — |
| DEV migration Phase A/B | Ledger drift blocks `db push` | `DEV_MIGRATION_RECONCILIATION_SPRINT1.md` | dry-run only | **Not repaired** | — |
| Credit Markdown in explanations | Raw `**` in UI | `signal-plain-text.ts`, Edge prompt | `test:credit`, extraction regression | Deploy Edge when approved | OPEN |

**Resource matrix:** [RESOURCE_COVERAGE_MATRIX_SPRINT2.md](./RESOURCE_COVERAGE_MATRIX_SPRINT2.md)  
**iPhone recovery:** [IPHONE_METRO_RECOVERY_SPRINT2.md](./IPHONE_METRO_RECOVERY_SPRINT2.md)

**Related:** `docs/FAIRPATH_MOBILE_FULL_APP_AUDIT.md`, `docs/FAIRPATH_ENGINEERING_SCOREBOARD.md`, `docs/P0_P1_DEFECT_REGISTER.md`.
