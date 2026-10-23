# FairPath Mobile — DEV readiness & functional QA package

**Branch:** `development/mobile-v1-completion`  
**Prepared:** 2026-10-23  
**Rule:** Nothing in this document authorizes production changes, pushes, migration apply, or DEV writes. Each mutating script requires explicit `--confirm-dev` and owner approval.

---

## Local verification (authorized — run anytime)

| Command | Mutates DEV? | Purpose |
|---------|--------------|---------|
| `npm run test:all` | No | Full offline gate (TypeScript, audits, unit tests, local Postgres SQL) |
| `node scripts/qa-dev-member-capabilities-matrix.mjs` | No | Local `audit-member-capabilities` only |
| `node scripts/qa-dev-jobs-housing-smoke.mjs` | No | Static jobs/housing route + RPC contract |
| `node scripts/qa-dev-signal-smoke.mjs` | No | Static Signal wiring contract |
| `node scripts/test-local-community-help.mjs` | No | Community help draft RPCs on local Postgres |
| `node scripts/test-local-relief.mjs` | No | Record Relief local SQL (17 checks) |
| `node scripts/qa-local-functional-matrix.mjs` | No | Aggregates the above + writes `qa-local-functional-matrix-results.json` |

---

## DEV mutating tests (blocked until approved)

### 1. Member capabilities matrix (P0-004)

- **Command:** `node scripts/qa-dev-member-capabilities-matrix.mjs --confirm-dev --use-documented-dev-accounts`
- **Credentials:** `.env.local` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); `QA_DEV_FREE_PASSWORD` or `QA_COMMUNITY_MEMBER_A_PASSWORD` (never log).
- **Writes:** Updates `profiles.justice_impacted` and `profile_answers` for documented DEV member across six scenarios.
- **Risk:** Changes visible personalization on shared DEV account until reverted manually or re-run to baseline.
- **Cleanup:** Document baseline values before run; restore justice/veteran answers after matrix.
- **Prerequisites:** `assertDevTarget` passes; local audit PASS.

### 2. Community Exchange two-account E2E

- **Command:** `node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev --use-documented-dev-accounts`
- **Credentials:** Member A/B emails (default dev-free / dev-plus) + `QA_COMMUNITY_MEMBER_A_PASSWORD`, `QA_COMMUNITY_MEMBER_B_PASSWORD`.
- **Writes:** Creates/updates `community_help_requests`, offers, notifications; cancels test requests.
- **Risk:** Inbox noise on DEV accounts; open requests until cancelled in script.
- **Prerequisites:** Migration `20261021205913` (community help) applied on DEV (see script header).
- **Read-only alternative:** `node scripts/test-local-community-help.mjs` (local Postgres only).

### 3. Food Rescue donor → recipient pickup (FOOD-106)

- **Command:** No single script in repo yet; manual DEV flow documented in checklist FOOD-106.
- **Suggested procedure:** Donor lists food rescue item → recipient claims via `food-rescue/item/[id]` → pickup confirm on marketplace claim workspace.
- **Credentials:** Two DEV members with passwords in env (same as community E2E).
- **Writes:** Marketplace listing, claim row, food-rescue status columns.
- **Blockers:** `RESERVE_RPC_BLOCKED` when `request_marketplace_claim` missing on target project.
- **Local:** `tests/food-rescue-*.test.ts` + audits only.

### 4. Jobs / Housing smoke (JOB-101 / HOUSE-101)

- **Command:** `node scripts/qa-dev-jobs-housing-smoke.mjs --confirm-dev --use-documented-dev-accounts`
- **Credentials:** Member A password + `.env.local` Supabase URL/anon key.
- **Writes:** None (RPC read: `search_jobs`, `search_housing`).
- **Risk:** Low; read-only RPC probes.
- **Failure modes:** `RpcNotDeployedError` equivalent → honest empty states in app (verified in audits).

### 5. Record Relief save + Edge evaluation parity (P0-005–007, DEF-RR-001)

- **Migration (DRAFT, not applied):** `docs/proposed-migrations/20261023120000_record_relief_save_skip_legacy_eval_DRAFT.sql`
- **Approval package:** `docs/RECORD_RELIEF_SKIP_LEGACY_EVAL_MIGRATION_APPROVAL.md`
- **Post-apply DEV manual:** Create Ohio multi-charge case → save → confirm single authoritative Edge eval (no spurious `rule_unavailable` from legacy save path).
- **Local proof:** `node scripts/test-local-relief.mjs` → **17/17** (does not invoke live Edge).
- **Rollback:** Redeploy prior `save_record_relief_case` function or pass `skip_legacy_eval: false` on saves.

### 6. Startup Academy cloud persistence (START-104)

- **Command:** No dedicated DEV script; verify via signed-in `/entrepreneurship` after lesson save.
- **Current behavior:** Device-local primary; `attemptAcademyCloudBackup` tries `member_academy_progress` then `profile_answers` keys (`academy.enrollments.v1`, etc.).
- **Writes:** `profile_answers` upserts when signed in (backup-only; no cross-device restore yet).
- **Blockers:** `member_academy_progress` table not in applied migrations.
- **Local:** `tests/academy-cloud-sync.test.ts`, `tests/academy-signal-worksheet.test.ts`.

### 7. Signal Edge gateway (SIG-101)

- **Command:** `node scripts/qa-dev-signal-smoke.mjs --confirm-dev --use-documented-dev-accounts`
- **Edge function probed:** `member-focus-guidance` (read-only style ping when configured).
- **Paid AI:** Do **not** run open-ended FairPath AI chat against production Edge without approval; orchestrator uses local routing first.
- **Local:** Signal UI/orchestrator/eval contract tests in `test:all`.

---

## DEV UI session (optional visual QA on web preview)

- **Command:** `node scripts/qa-dev-ui-session.mjs --confirm-dev` (requires `SUPABASE_SERVICE_ROLE_KEY`)
- **Creates:** Disposable `@dev-seed.fairpath.test` user + magic sign-in URL (port **8090** in script comment; reuse **8083** Metro if already running for native).
- **Cleanup:** `node scripts/qa-dev-ui-session.mjs --cleanup --confirm-dev`
- **Device gap:** Does not replace iPhone Expo Go verification (P0-009).

---

## New member journey (DEV disposable user)

- **Command:** `node scripts/qa-dev-new-member-journey.mjs --confirm-dev`
- **Requires:** `SUPABASE_SERVICE_ROLE_KEY`, creates disposable user, tests consent RPC + onboarding fields.
- **Cleanup:** User remains on DEV unless manually deleted (document user id from output).

---

## Anon security probe (live DEV read-only)

- **Command:** `node scripts/qa-dev-anon-probe.mjs`
- **Mutates:** No (anonymous RPC/function calls only).
- **Note:** Some expectations fail when Edge functions are not deployed on target project (404) or when RPC returns `SIGNED_OUT` (400) instead of older status codes — triage per message, do not weaken RLS.

---

## Environment variables reference

| Variable | Used by |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | All DEV harnesses |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | All DEV harnesses |
| `SUPABASE_SERVICE_ROLE_KEY` | Disposable user provisioning, new-member journey, UI session |
| `QA_DEV_FREE_PASSWORD` | Documented dev-free member |
| `QA_COMMUNITY_MEMBER_A_PASSWORD` / `B` | Two-account E2E |
| `QA_COMMUNITY_MEMBER_A_EMAIL` / `B` | Optional overrides |

Never commit secrets or print passwords in logs.
