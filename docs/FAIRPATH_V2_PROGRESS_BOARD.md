# FairPath V2 — Progress Board

Updated: 2026-10-06 · Repo: fairpath-mobile (DEV) · Branch: feat/v1-canonical-profile
Scope: DEV repository only. No production Supabase, no unapplied migrations, no Edge Function deploys, no billing activation, no remote pushes.

Status key: **BUILT** = code exists in repo · **TESTED** = an automated check passed in this repo · **BLOCKED** = cannot be verified here, with reason · **PLANNED** = not started.

## Baseline (offline, `npm run test:all`, run 2026-10-06 before this pass)

- Typecheck: pass.
- Audits: 25 of 26 passed. Failure: keyboard audit (retention check-in screen used a plain ScrollView with text inputs). **Fixed this pass**, now passing 24 screens.
- Node suites: pass.
- SQL suites: **21 failed, all with the same error chain** from local Postgres:
  - `pg_net` extension not available in the local Postgres used by `local-sql-check`.
  - `cron.job` relation missing.
  - Program Scout change-detection verification found no persisted change event for its fixture.
  - Classification: **BLOCKED (environment)** until the local Postgres image provides `pg_net` and `pg_cron`. Not yet proven to be an application bug. Needs a local Postgres setup step, not a code change.
- Start of pass: 28 of 49 checks passing. After keyboard fix and full re-run: **29 of 49 confirmed**. The 20 failures are all the SQL local-Postgres group (BLOCKED, environment).

## Foundation and shell

| Area | Status | Evidence |
|---|---|---|
| Auth, sign-up/in, password reset, callback | BUILT, audited | `audit-auth` passes |
| Canonical profile, readiness | BUILT, audited | `audit-canonical-profile`, `audit-profile` pass |
| Notifications inbox | BUILT, audited | `audit-notifications` passes |
| Keyboard-aware form screens | BUILT, **TESTED this pass** | `audit-keyboard`: 24 screens pass |
| Theme (dark/light, lime accent) | BUILT, audited | `audit-theme` passes |

## Pathways (V2 foundation)

| Item | Status | Evidence |
|---|---|---|
| Pathway registry: 6 pathways, launch status, consent scopes, audience floor | BUILT, **TESTED this pass** | `src/core/pathways/pathway-registry.ts`, `tests/pathway-registry.test.ts` (12 pass) |
| Opt-in activation: planned pathways cannot be activated | TESTED (registry) | registry tests |
| Safety & Recovery and Giving never shared with external audiences | TESTED (registry) | registry tests |
| No default location sharing on any pathway | TESTED (registry) | registry tests |
| Database RLS mirroring the registry rules | PLANNED | No migration written. Requires review before apply. |
| Pathway dashboards and UI switching | PLANNED | — |

## Reentry / Fair Chance

| Item | Status | Evidence |
|---|---|---|
| Jobs browse, detail, apply, tracking | BUILT, audited (`audit-jobs`) | prior work |
| Housing browse, filters, saved searches | BUILT, audited (`audit-housing`) | prior work |
| Fair-chance attribute model (employer and housing policy attributes) | PLANNED | Founder approved; not started |
| Record Relief | BUILT, audited (`audit-relief`); SQL suite BLOCKED (environment) | — |

## Marketplace

| Item | Status | Evidence |
|---|---|---|
| Server-side claim and pickup model | BUILT (per prior docs) | `audit-marketplace` passes (static) |
| Two-account end-to-end verification | **BLOCKED** | Needs two signed-in DEV test accounts. Not run. |
| Real-device QA | **BLOCKED** | Needs a physical device. Not run. |
| Claim quotas, QR confirmation, cross-user privacy | **BLOCKED** until two-account run | Not verified |

## Veterans

| Item | Status | Evidence |
|---|---|---|
| Pathway registry entry (in development, not live) | BUILT, TESTED | registry tests |
| Dashboard, transition planning, MOS/AFSC translation, resources, resume integration | PLANNED | Not started. No insignia or VA claims permitted. |

## Credit Studio (mobile only)

| Item | Status | Evidence |
|---|---|---|
| Existing credit tools, report extraction Edge Function | BUILT, audited (`audit-credit`, `test:extraction`) | prior work |
| Three-bureau comparison, dispute tracking, 30/60/90 plans, secure deletion | PLANNED | Foundation not started this pass |
| Paid dispute services | **Not permitted** until legal approval | Founder decision |

## Food, Giving, Safety & Recovery

| Item | Status | Evidence |
|---|---|---|
| Food: registry entry (planned) | BUILT, TESTED | registry tests |
| Food: shared merchant contracts (Partner Hub) | PLANNED | — |
| Giving: registry entry, sharing floor, no charitable collection | BUILT, TESTED | registry tests |
| Safety & Recovery: registry entry, never-shared floor, no location default | BUILT, TESTED | registry tests |
| Safety & Recovery security and safety review | **BLOCKED** | Mandatory before launch; needs review |

## Employer pricing (billing disabled)

- Mobile pricing doc (LOCKED): Starter $79, Growth $179, Pro $349, Enterprise $799+.
- Public website: Growth $79, Scale $199, Enterprise custom, Free starter.
- Founder decision: **pending. Do not choose.** Employer billing stays disabled.
- No live Stripe product changed.

## Employer incentives

- WOTC: do not advertise for new 2026 hires until renewed authorization is verified (founder rule).
- Other incentive programs: PLANNED, verification status required per program.

## Blockers requiring the founder

1. Employer pricing decision (two conflicting structures).
2. Two DEV test accounts for Marketplace two-account QA.
3. Physical device for Marketplace and mobile QA.
4. Local Postgres image with `pg_net` and `pg_cron` for the SQL suite.
5. Counsel scope for Credit Studio, fair-chance policy attributes, and giving money flow.

## Next passes

1. Re-run `npm run test:all` and record the new baseline.
2. Fair-chance attribute model (types and tests only; no migration applied).
3. Veterans dashboard shell and MOS translation contract, reviewed before any branding.
4. Credit Studio mobile foundation: document wallet contract and report-comparison types, no paid features.
5. Shared contracts for Food and Giving, documented, no activation.
