# DEV integration recovery report (2026-10-26)

Project: `znvhmuhojvwvjzmaqwff` · Branch: `development/mobile-v1-completion`

## Mission 1 — Database reconciliation (partial)

### Schema vs migration file (objects probed, not filenames)

| Object | Before | After isolated apply |
| --- | --- | --- |
| `member_opportunity_plan_items` | **Missing** | **Present** (RLS member-owned) |
| `resource_reactions` | Missing | **Present** |
| `community_contributions` | Missing | **Present** |
| `community_contribution_events` | Missing | **Present** |
| `community_contributions_backend_ready()` | n/a | **true** |
| `profiles.experience_summary` | **Already on DEV** | unchanged (Record Relief local-only migration not re-applied) |

### Method (safe, no reset)

1. `supabase db query --linked -f` applied idempotent SQL for:
   - `20261026210000_member_opportunity_plan_items.sql`
   - `20261026220000_community_contributions.sql` (promoted from draft)
2. `supabase migration repair --status applied` recorded **26210000** and **26220000** on linked DEV.

### Still blocked for full `db push`

- **43 remote-only** migration version strings remain in history (dashboard/ad-hoc applies without local files).
- **25 other local-only** versions (e.g. Oct 17 RR chain) are **not** automatically pushed — schema may already match via remote-only applies; needs per-version diff before repair/revert.
- **`supabase db push --linked` still fails** with `DbPushMissingLocalError` until remote-only entries are reconciled (typically `migration repair --status reverted` **after** confirming objects exist — **not run in this sprint** to avoid blind history edits).

Verify anytime: `node scripts/probe-dev-integration-schema.mjs`

## Mission 2 — Authenticated DEV QA

| Check | Result |
| --- | --- |
| `QA_DEV_FREE_PASSWORD` / `QA_COMMUNITY_MEMBER_A_PASSWORD` in process env | **Missing** |
| `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` | **Missing** (only URL + anon key present) |
| `probe-dev-auth-personas.mjs` | **BLOCKED** without service role |

**Your setup step (secrets stay in your shell, never committed):**

```powershell
. .\scripts\Start-DevQaSession.ps1
node scripts/probe-dev-auth-personas.mjs
node scripts/qa-dev-fairpath-ai-gateway.mjs --confirm-dev --use-documented-dev-accounts
node scripts/qa-dev-my-path-sync.mjs --confirm-dev --use-documented-dev-accounts
node scripts/qa-dev-signal-smoke.mjs --confirm-dev --use-documented-dev-accounts
```

Accounts: `dev-free@fairpath.test` / `dev-plus@fairpath.test` (`docs/DEV_TEST_ACCOUNTS.md`).

## Mission 3 — My Path cloud sync

- **DEV table:** live after this sprint.
- **Automated DEV test:** `scripts/qa-dev-my-path-sync.mjs` (insert/read/anon-deny/cleanup) — **not run** (no member password).
- **App behavior:** sync success toast only when `syncOpportunityPlanItems` returns `synced: true`; otherwise explicit device-only or error reason (no false cloud success).

## Mission 4 — Signal E2E

- **Anon gateway:** 401 verified (`qa-dev-fairpath-ai-gateway.mjs`).
- **Authenticated journey:** **BLOCKED** without QA password (same as Mission 2).
- **iPhone:** not performed in agent environment — requires dev client rebuild for `expo-location` if not already installed.

## Mission 5 — Tests

- **122/122** `npm run test:all` (community migration promoted; RLS initplan + security audit allowlist for guest reaction RPCs).
- **`npx tsc --noEmit`** clean.

### Post-sprint DEV schema probe (linked query)

```json
{
  "tables": ["community_contributions", "member_opportunity_plan_items", "resource_reactions"],
  "community_backend_ready": true
}
```

RLS initplan patch applied on DEV via `scripts/dev-patch-rls-initplan-integration.sql` (idempotent).

## Remaining blockers (your participation)

1. **QA session:** dot-source `scripts/Start-DevQaSession.ps1` (prompts for passwords + service role; nothing stored on disk).
2. **Authenticated scripts:** gateway signed-in path, My Path sync, Signal smoke with `--confirm-dev --use-documented-dev-accounts`.
3. **iPhone dev build:** rebuild dev client if `expo-location` native module changed since last install.
4. **Migration history:** 43 remote-only versions still block blind `db push`; reconcile with object-level diffs before bulk `migration repair --status reverted`.
