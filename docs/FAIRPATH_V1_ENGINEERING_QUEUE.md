# FairPath Mobile — Engineering queue (Nov 1 target)

**Authority:** `docs/FAIRPATH_V1_PRODUCT_TRUTH_AND_COMPLETION_CHECKLIST.md` supersedes narrative status in `docs/FAIRPATH_V1_SIX_DAY_EXECUTION_BOARD.md`.  
**Branch:** `development/mobile-v1-completion` · **Integration lead:** Director agent (this session)  
**Deadline:** Mobile development phase substantially complete **2026-11-01** (not App Store unless separately scoped).

## Parallel execution capabilities (this environment)

| Capability | Available | Notes |
|------------|-----------|--------|
| Cursor **Task** subagents | Yes | Agents C,D,G,H + F,J,K,L launched 2026-10-23 (Task IDs in session checkpoint) |
| **best-of-n-runner** worktrees | Yes | Isolated branches merged via cherry-pick/FF onto integration |
| Background agents | Session-limited | No separate “8 agents” unless Task/worktree spawned |
| Push / deploy / migrations apply | **No** (release boundary) | Local commits only |

## Agent ownership (file boundaries)

| Agent | Owns (primary) | Do not edit without lead |
|-------|----------------|---------------------------|
| A — Integration | `docs/FAIRPATH_V1_*`, audits, merge commits | — |
| B — Auth & profile | `src/app/onboarding*`, `src/core/auth/*`, `member-capabilities*`, `member-tool-preferences` | Other agents’ auth WIP |
| C — Record Relief | `src/app/record-relief/**`, `src/core/record-relief/**`, `evaluate-record-relief` | `relief-service` shared — coordinate |
| D — Explore & pathways | `src/app/explore.tsx`, `src/app/grow/**`, `src/core/explore/*`, `v1-pathways.ts`, jobs/housing/resources routes | `member-capabilities` (Agent B) |
| E — Signal | `src/app/fairpath-ai.tsx`, `src/core/signal/**`, `supabase/functions/_shared/core/ai-gateway/**` | — |
| F — Startup Academy | `src/app/entrepreneurship.tsx`, future `src/core/academy/**` | — |
| G — Community / MKT / Food | `src/app/community/**`, `marketplace/**`, `food-rescue.tsx` | — |
| H — QA / release | `scripts/audit-*`, `scripts/qa-*`, `tests/*`, `run-all-tests.mjs` | — |

## Active queue (sample — full list = checklist IDs)

| ID | Feature | Owner | P | Status | Evidence / SHA |
|----|---------|-------|---|--------|----------------|
| P0-002 | Onboarding justice/veteran Yes/No | B | P0 | COMMITTED | `01b6755` — Neither→No; vet in profile_answers |
| P0-003 | Canonical visibility | B | P0 | IN PROGRESS | Gates on Explore/Me/Home/Signal/RR/Veterans; **notifications TBD** |
| P0-004 | DEV account matrix | H | P0 | HARNESS | `df9c3c5` scripts + matrix tests; DEV run **BLOCKED** without `--confirm-dev` |
| P0-001 | Explore honest readiness | D | P0 | PARTIAL | `e194679` + `324d645` |
| PATH-101 | Ten pathway primaries | D/K | P1 | PARTIAL | `6e22f7c` + audit script |
| P0-005–007 | Record Relief E2E | C | P0 | PARTIAL | `671cd68` client parity tests; DEF-RR-001 RPC still open |
| START-101 | Academy F-1 routes | F | P1 | PARTIAL | `4502213` |
| GIVE-101 | Can-help hub | G | P1 | PARTIAL | `9307f78` + `2167d81` open-requests |
| JOB-101 / HOUSE-101 | DEV smoke | J | P1 | HARNESS | `6053593` local PASS, DEV BLOCKED |
| SIG-101 | Signal DEV smoke | L | P1 | HARNESS | `dc40090` |

## P0 defects register (living)

| ID | Severity | Summary | Owner |
|----|----------|---------|-------|
| DEF-RR-001 | P0 | `save_record_relief_case` runs legacy DB eval before Edge | C |
| DEF-RR-002 | P0 | Coverage UI = DB rules; engine = 57 registry — conflated | C |
| DEF-EXP-001 | P0 | Explore implied all destinations “Available” | D → fix in progress |
| DEF-GROW-001 | P1 | Grow hub ignored `primaryRoute` | D → fixed this session |
| DEF-PREF-001 | P1 | Deep links to justice-records without gate | B → fixed this session |

## Next integration lead actions

1. Commit Explore readiness + grow routing + justice gates (this batch).  
2. Agent C: `caseRowToEngineFacts` + client-only Edge-first reevaluate (no migration until approved).  
3. Agent H: `scripts/qa-dev-member-capabilities-matrix.mjs` + document env vars.  
4. Reconcile execution board RB rows with checklist — no conflicting “COMMITTED” without SHA proof.
