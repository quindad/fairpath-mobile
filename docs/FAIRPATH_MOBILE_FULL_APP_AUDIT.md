# FairPath Mobile — Full Application Audit

**Date:** 2026-10-26  
**Branch:** `development/mobile-v1-completion`  
**Auditor:** Principal engineer session (code + automated tests; not production)  
**Method:** Route inventory, audit scripts, SQL/static review, targeted Credit Studio + Signal trace. **No claim of device PASS without user evidence.**

---

## 1. Executive summary

FairPath Mobile is a **broad, real backend-connected** Expo app (134 screen files, 33 Edge functions, extensive Supabase RPC/RLS). The **offline regression suite is strong** (124 checks) but **did not prevent iPhone-only Signal and relevance defects** — those required physical QA.

**False “complete” labels to retire:** Any checklist that marks Signal, Credit Studio, or “122/122 tests” as launch-ready **without device matrices and DEV live-data loops** is overstated.

---

## 2. Verified numbers (this session)

| Check | Result |
|-------|--------|
| Route files | **134** under `src/app` |
| Navigation audit | **PASS** (133 files) |
| `npm run test:all` | **124/124 PASS** (after credit audit fix + new extraction tests) |
| TypeScript | **PASS** (`npx tsc --noEmit`) |
| Credit audit (`test:credit`) | **PASS** |
| DEV authenticated gateway QA | **BLOCKED** without vault passwords (anon 401 OK) |
| Physical iPhone | **OPEN** — see matrix in Master Board |

---

## 3. Critical journeys tested (automated)

| Journey | Tooling | Outcome |
|---------|---------|---------|
| Auth post-routing | `test:auth-post-auth` | Pass |
| Onboarding funnel | `test:onboarding` | Pass |
| Jobs RPC + apply rules | `test:jobs`, `test:sql:jobs-e2e` | Pass (local SQL) |
| Housing RLS + apply | `test:housing`, SQL housing | Pass (local SQL) |
| Resources search contract | `test:sql:resources`, availability | Pass (local/DEV probe) |
| Signal orchestration | `signal-orchestrator`, `signal-resource-relevance` | Pass |
| Credit stage machine + letters | `audit-credit.mjs` | Pass |
| Credit extraction boundary | `credit-extraction-regression.test.ts` | Pass (synthetic 48-account fixture) |
| Cross-member isolation | SQL tests | Pass (local) |

**Not automated:** End-to-end signed-in flows on physical iPhone with real DEV data for every tab.

---

## 4. P0 — Release blockers

### Product / UX

| Issue | Root cause (verified) | Fix status |
|-------|----------------------|------------|
| Signal keyboard overlaps composer on iPhone | Stacked `KeyboardAvoidingView` + `automaticallyAdjustKeyboardInsets` | Fixed in `FormScrollView` `footerScroll` (`b27d471`) — **device re-test required** |
| Signal job+transport → irrelevant financial resources | Gateway `p_include_national: true`, weak resource query | Fixed relevance module + DEV gateway deploy (`b27d471`) — **device re-test required** |
| Credit audit failure (regression) | Copy moved to `CreditStudioHome` without audit string | Fixed in `credit/index.tsx` (session, uncommitted) |

### Platform / ops

| Issue | Reference |
|-------|-----------|
| DEV migrations vs repo | P0-001 |
| Apple/Google OAuth | P0-002, P0-003 |
| Push notifications E2E | P0-005 |
| Payments sandbox | P0-006 |
| Password reset deep link | P0-007 |
| Android Maps | P0-008 |

### Security / privacy (no open P0 found in static review)

- Credit: RLS on `credit_*`, private bucket, no client inserts, last-4 only — **audit-credit PASS**.
- Signal gateway: auth before credit spend — prior fix `bf177c7`.
- Production isolation: **no production changes this session**.

---

## 5. P1 — Core completion (partially verified)

| Area | State | Notes |
|------|-------|-------|
| Jobs / Housing live DEV loops | Not run this session | Scripts exist; credentials gate |
| Community exchange draft DB | Migrations in `docs/proposed-migrations/` | Not applied without approval |
| Record Relief legal gate | Incomplete for all jurisdictions | By design — honest unsupported paths |
| Explore thin markets | Honest empty/thin copy | Per-market inventory varies |
| Credit extraction Edge | `extract-credit-report` + consent in UI | Paid AI off unless approved |
| Signal model smoke | Edge secrets | Deterministic fallbacks only |

---

## 6. P2 — Product quality

| Theme | Examples |
|-------|----------|
| Long / cluttered screens | Credit account list density; user feedback |
| Raw Markdown in Signal | Client `signalPlainText` added; Edge prompt updated (**deploy pending approval**) |
| Scroll / keyboard outside Signal | `test:keyboard`, `test:scroll` pass — spot-check other long forms on iPhone |
| DEV-only UI | Integration health under Profile (`__DEV__` only) — not production |
| Housing inquiry latency | Honest “not real-time” copy |

---

## 7. P3 — Future / deferred

- Three-tier entitlements migration (draft SQL, not applied).
- Array credit monitoring partner (`credit-score-provider` placeholder).
- ECC / open-source engine migration (docs only).
- Microsoft/Yahoo/phone auth (product undecided).

---

## 8. Backend inventory (DEV)

| Layer | Count / note |
|-------|----------------|
| Migrations | Full chain applied locally via `test:sql:all`; **DEV cloud reconcile open** |
| Edge Functions | 33 folders; Signal cluster + `fairpath-ai-gateway` + credit extraction |
| Storage | `credit-uploads` private; document buckets per documents audit |
| RPCs | Jobs, housing, resources, member summary, credit workspace, record relief, marketplace |
| Draft SQL | Community help, member referral, justice canonical — **not bulk-applied** |

**Mismatch risks:** App calling RPCs added in migrations not yet on DEV → integration health + `qa-dev-edge-inventory` (run when creds available).

---

## 9. Features falsely marked complete (historical)

| Claim | Reality |
|-------|---------|
| “Signal 2.0 device ready” | iPhone defects found on `e52815e1` |
| “Credit Studio complete” | Working on device but PDF comparison found interpretation + Markdown issues |
| “122/122 = ship ready” | Tests do not replace device + DEV live loops |
| “DEV QA all green” | Password-gated scripts often BLOCKED in CI/agent env |

---

## 10. Credit Studio audit (mission slice)

### Architecture (working)

- Upload → `register_credit_upload` → optional `readUploadedReport` (consent) → `extract-credit-report` / ingest → `credit_accounts` + `run_credit_review` → UI tabs Studio/Accounts/Review/Disputes/Learn.
- 48-account Experian scenario **matches count**; duplicate Capital One rows **not merged** if open dates differ (SQL R2 requires same last4 **and** open date).
- Disputes require **confirmed** issues only (`disputableItems`, SQL transitions).

### Defects addressed (session, local)

| Defect | Fix |
|--------|-----|
| Credit audit string missing | Accounts tab copy |
| Markdown in Signal text | `signalPlainText` on credit screens |
| 47 vs 48 counter unexplained | `explainAccountConfirmCounts` |
| Settled Verizon over-interpretation | Item evidence lines + Edge system prompt (deploy pending) |
| No synthetic 48-account test | `credit-extraction-regression.test.ts` |

### Remaining (genuine)

| Item | Action |
|------|--------|
| Edge `credit-report-explanation` prompt | Deploy to DEV when approved |
| Prior dispute fields in evidence JSON | Extraction/engine should populate `prior_dispute` when present on PDF |
| Account list filters (needs review / negative) | P1 UX — not yet implemented |
| Re-upload idempotency | `ingest_credit_report` creates new report row — document merge policy for user |

---

## 11. Test commands (exact)

```bash
npm run test:all
npm run test:credit
node --test --experimental-strip-types tests/credit-extraction-regression.test.ts
node --test --experimental-strip-types tests/signal-resource-relevance.test.ts
npx tsc --noEmit
```

---

## 12. Next recommended GO

**User (iPhone, ~15 min):** Reload Metro → Signal: verify keyboard + send “I need a job and transportation near me” with ZIP set → Credit Studio: open Verizon negative item, confirm no raw `**` in Signal text.

**Engineering (after approval):** Commit session fixes → deploy `credit-report-explanation` to DEV → run `node scripts/qa-dev-fairpath-ai-gateway.mjs --confirm-dev --use-documented-dev-accounts` with vault password → update Master Board device column.

---

**Do not mark physical-device QA complete until the user confirms the above.**
