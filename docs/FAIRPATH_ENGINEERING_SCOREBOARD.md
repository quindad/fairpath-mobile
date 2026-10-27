# FairPath Engineering Scoreboard

**Updated:** 2026-10-27 · **Branch:** `development/mobile-v1-completion` · **HEAD:** Sprint 2 commit (Signal nudge, Credit Studio, resource matrix, docs)

## Harness status

| Harness | Role | ECC / tooling | Status |
|---------|------|---------------|--------|
| **Cursor Ultra** | Primary IDE | `.cursor/rules/fairpath-engineering.mdc`; plugins: Supabase, Amazon Location; **no ECC hooks** | Active |
| **Claude Code 2.1.292** | Optional CLI | ECC **core** v2.2.3 → `~/.claude/ecc/install-state.json`, **`hookConsent: declined`** | Installed |
| **Integration owner** | Single merge path | Cursor agent + scoped commits; Claude for parallel consult/review | This session |

## Regression gates

| Gate | Last run | Result |
|------|----------|--------|
| `npm run test:all` | 2026-10-27 Sprint 2 | **125/125 PASS** |
| `npm run test:credit` | 2026-10-26 | **PASS** |
| `npx tsc --noEmit` | 2026-10-26 | **PASS** |
| `audit-security.mjs` | 2026-10-26 | **PASS** |
| DEV authenticated QA | — | **BLOCKED** (vault passwords) |
| iPhone acceptance | — | **OPEN** |

## P0 execution queue (integration owner)

| Rank | Item | Owner | Evidence needed |
|------|------|-------|-----------------|
| 1 | Signal iPhone keyboard/composer | User + FE | [IPHONE_METRO_RECOVERY_SPRINT2.md](./IPHONE_METRO_RECOVERY_SPRINT2.md) |
| 2 | Signal job+transport relevance | User + BE | Automated tests green; device + gateway |
| 3 | Credit Studio Signal Markdown + settled copy | FE (+ Edge deploy) | Local `signalPlainText`; deploy `credit-report-explanation` when approved |
| 4 | DEV migration ledger reconcile | Operator | [DEV_MIGRATION_RECONCILIATION_SPRINT1.md](./DEV_MIGRATION_RECONCILIATION_SPRINT1.md) |
| 5 | Ohio resource ingestion | Eng | [RESOURCE_COVERAGE_MATRIX_SPRINT2.md](./RESOURCE_COVERAGE_MATRIX_SPRINT2.md) |

## Workstream rollup

See feature-level rows: [FAIRPATH_MOBILE_MASTER_COMPLETION_BOARD.md](./FAIRPATH_MOBILE_MASTER_COMPLETION_BOARD.md)  
See audit narrative: [FAIRPATH_MOBILE_FULL_APP_AUDIT.md](./FAIRPATH_MOBILE_FULL_APP_AUDIT.md)  
See ECC: [FAIRPATH_ECC_ENGINEERING_EVALUATION.md](./FAIRPATH_ECC_ENGINEERING_EVALUATION.md)

## Agent routing (no duplicate stacks)

| Task type | Cursor | Claude + ECC |
|-----------|--------|----------------|
| Expo UI / keyboard | Primary | Consult UX skills |
| Supabase RPC/migrations | Primary + SQL tests | `doctor` / architecture agents |
| Security pass | `audit-security.mjs`, review-security skill | `consult security`, optional AgentShield later |
| TDD | `test:all` + targeted node tests | ECC workflow-quality skills (manual invoke) |
| iPhone QA | User device | N/A |

**Rejected:** `ecc install --target cursor` while Claude core is active; `ecc@ecc` plugin + manual full install; enabling ECC hooks until iPhone Signal acceptance completes.
