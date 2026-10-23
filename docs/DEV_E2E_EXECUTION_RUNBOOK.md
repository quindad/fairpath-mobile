# DEV E2E execution runbook

**Branch:** `development/mobile-v1-completion`  
**Gate:** Every mutating step requires **`--confirm-dev`** and founder authorization.  
**Preflight (local, no DEV writes):** `npm run test:all` · `node scripts/qa-local-functional-matrix.mjs`

---

## Execution order (recommended)

| Step | Script | Mutates DEV? | Auth required? |
|------|--------|--------------|----------------|
| 0 | `node scripts/qa-dev-edge-inventory.mjs` | No | No |
| 1 | `node scripts/qa-dev-anon-probe.mjs` | No | No |
| 2 | `node scripts/qa-dev-member-capabilities-matrix.mjs --confirm-dev --use-documented-dev-accounts` | **Yes** (profile fields) | Yes |
| 3 | `node scripts/qa-dev-new-member-journey.mjs --confirm-dev` | **Yes** (disposable user) | Yes + service role |
| 4 | `node scripts/qa-dev-jobs-housing-smoke.mjs --confirm-dev --use-documented-dev-accounts` | No (RPC read) | Yes |
| 5 | `node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev --use-documented-dev-accounts` | **Yes** | Yes |
| 6 | Food Rescue manual (see §6) | **Yes** | Yes |
| 7 | Record Relief manual + optional `qa-dev-pass2.mjs` | **Yes** | Yes + migration apply |
| 8 | Academy manual signed-in backup check | **Yes** (`profile_answers`) | Yes |
| 9 | `node scripts/qa-dev-signal-smoke.mjs --confirm-dev --use-documented-dev-accounts` | No* | Yes |

\*Edge ping only; no open-ended paid chat.

---

## 1. Member capabilities matrix (P0-004)

**Command:**
```powershell
node scripts/qa-dev-member-capabilities-matrix.mjs --confirm-dev --use-documented-dev-accounts
```

**Env:** `.env.local` (Supabase URL + anon key); `QA_DEV_FREE_PASSWORD` or `QA_COMMUNITY_MEMBER_A_PASSWORD`.

**Accounts:** Documented dev-free / member A (emails via `scripts/lib/dev-qa-accounts.mjs`).

**Writes:** `profiles.justice_impacted`, `profile_answers` (veteran tool question).

**Pass:** All six scenarios match expected `justiceToolsEnabled` / `veteranToolsEnabled` logic after reload.

**Cleanup:** Restore baseline justice/veteran answers for member A; document values before run.

**Risks:** Wrong account password lockout; visible personalization drift on shared DEV account.

---

## 2. New member registration journey

**Command:**
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<DEV service role — never commit>"
node scripts/qa-dev-new-member-journey.mjs --confirm-dev
```

**Writes:** Creates `qa-journey-*@dev-seed.fairpath.test`, consent RPC, profile fields.

**Pass:** All scripted steps PASS; consent timestamps on profile.

**Cleanup:** Delete disposable user via admin API or note id for later cleanup.

**Risks:** Orphan test users on DEV.

---

## 3. Jobs and Housing smoke

**Command:**
```powershell
node scripts/qa-dev-jobs-housing-smoke.mjs --confirm-dev --use-documented-dev-accounts
```

**Writes:** None.

**Pass:** `search_jobs` / `search_housing` return rows for ZIP 43228; signed-in session succeeds.

**Fail criteria:** Auth failure; empty arrays when DEV seed expects listings (investigate seed, not app fake data).

---

## 4. Community Exchange two-account E2E

**Command:**
```powershell
node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev --use-documented-dev-accounts
```

**Env:** `QA_COMMUNITY_MEMBER_A_PASSWORD`, `QA_COMMUNITY_MEMBER_B_PASSWORD`; optional email overrides.

**Writes:** Community help requests, offers, notifications; cancellation path.

**Prerequisites:** Community help migration applied on DEV (see script header `20261021205913`).

**Pass:** All steps PASS; output `qa-dev-community-exchange-e2e-results.json`.

**Cleanup:** Script cancels test request; verify no stuck `open` requests in inbox.

**Risks:** Cross-member data visible if RLS broken (failure = stop release).

---

## 5. Food Rescue donor → recipient (FOOD-106)

**Type:** Manual DEV (no single automated script in repo).

**Procedure:**
1. Member A: post food rescue listing (`/food-rescue` donor flow).
2. Member B: browse → open item → claim.
3. Confirm pickup state on claim workspace / My Path.
4. Cancel or complete per product rules.

**Blockers:** `RESERVE_RPC_BLOCKED` if `request_marketplace_claim` not deployed.

**Pass:** Honest blocked UI when RPC missing; full flow when RPC live.

---

## 6. Record Relief save + Edge parity

**Prerequisites:** DEF-RR-001 migration applied on DEV (see `docs/DEV_MIGRATION_APPROVAL_PACKET.md`); `evaluate-record-relief` deployed.

**Manual:** Create Ohio case in app → save → verify single authoritative evaluation; scan upload optional.

**Automated helper:** `node scripts/qa-dev-pass2.mjs --confirm-dev` (mutating; review script before run).

**Pass:** No duplicate misleading legacy eval; Edge errors surfaced honestly.

---

## 7. Startup Academy cloud persistence

**Manual:** Sign in → complete lesson exercise → check entrepreneurship home banner for sync state.

**Writes:** `profile_answers` keys (`academy.enrollments.v1`, workspace, track, exercises) when backup succeeds.

**Pass:** Banner shows `cloud_synced` or honest `device_local`; no fake “backed up” without RPC success.

**Blockers:** `member_academy_progress` table not migrated (backup-only to profile_answers).

---

## 8. Signal gateway smoke

**Command:**
```powershell
node scripts/qa-dev-signal-smoke.mjs --confirm-dev --use-documented-dev-accounts
```

**Edge function:** `member-focus-guidance` (read-style invoke).

**Pass:** Local contract PASS; DEV invoke returns non-404 (401/400 acceptable without session body).

**Do not:** Run unbounded FairPath AI chat against paid providers without approval.

---

## Optional UI session (web preview)

```powershell
node scripts/qa-dev-ui-session.mjs --confirm-dev
```

Creates disposable user + sign-in URL. **Cleanup:** `--cleanup --confirm-dev`.

Not a substitute for iPhone Expo dev client testing (see `docs/IPHONE_NATIVE_QA_SETUP.md`).
