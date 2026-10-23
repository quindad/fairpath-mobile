# FairPath Mobile V1 — Six-Day Execution Board

**Branch:** `development/mobile-v1-completion`  
**Metro:** reuse `npx expo start --lan --port 8083` (do not duplicate)  
**Native iPhone QA:** **NOT TESTED** unless explicitly marked on a task  
**Last checkpoint:** Day 1 — Signal gateway hardening + tool orchestration + local chat persistence

---

## Release blocker matrix (living)

| ID | Area | Classification | Notes |
|----|------|----------------|-------|
| RB-001 | Global scroll (122 routes) | IMPLEMENTED BUT UNVERIFIED | Static `audit-scroll` PASS; Expo Go **NOT TESTED** |
| RB-002 | Signal conversation UX | IMPLEMENTED BUT UNVERIFIED | Tool enrichment + cancel + phased loading; device QA **NOT TESTED** |
| RB-003 | Signal tool orchestration | IMPLEMENTED BUT UNVERIFIED | Read tools via RPC/summary; writes confirm-only |
| RB-004 | Signal conversation persistence | PARTIAL | AsyncStorage threads; server migration **DRAFT only** |
| RB-005 | Record Relief E2E member | IMPLEMENTED BUT UNVERIFIED | Deterministic engine; device QA **NOT TESTED** |
| RB-006 | Marketplace claims E2E | IMPLEMENTED BUT UNVERIFIED | RPC-backed; device QA **NOT TESTED** |
| RB-007 | Ten pathways primary actions | PARTIALLY IMPLEMENTED | Routes exist; per-pathway device QA **NOT TESTED** |
| RB-008 | Auth / registration (other agents) | IMPLEMENTED BUT UNVERIFIED | Uncommitted deltas in working tree — do not overwrite |
| RB-009 | Community two-member UI E2E | NOT TESTED | Backend 13/13; mobile UI harness incomplete |
| RB-010 | Expo web smoke `:8083` | BROKEN/PARTIAL | HTTP 200 reported; agent browser blank/timeout — **NOT TESTED** |

---

## Task queue

Statuses: `TODO` · `IN PROGRESS` · `TESTING` · `VERIFIED` · `COMMITTED` · `BLOCKED` · `NOT TESTED`

### Signal (highest priority)

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| SIG-001 | P0 | Conversation-first Signal tab (header, chat, fixed composer) | COMMITTED | `audit-ai`, `signal-ui-contract`, `audit-scroll` | `d08d1d2` |
| SIG-002 | P0 | Contextual suggestion chips (goals + next step) | COMMITTED | `loadSignalSuggestions` | `d08d1d2` |
| SIG-003 | P0 | Typed read/write tool registry | COMMITTED | `signal-ui-contract` | `d08d1d2` |
| SIG-004 | P1 | Move specialized catalog to modal (not main scroll) | COMMITTED | `signal-ui-contract` | `d08d1d2` |
| SIG-005 | P1 | Server gateway timeouts, failover health, token caps | COMMITTED | static gateway tests | `c7a0b54` |
| SIG-006 | P1 | Typed read-tool orchestration (writes confirm-only) | COMMITTED | `signal-orchestrator`, eval | `c7a0b54` |
| SIG-007 | P1 | Conversation history + titles (member-owned) | PARTIAL | AsyncStorage + SQL DRAFT | `c7a0b54` |
| SIG-008 | P1 | Cancel + phased loading (streaming N/A on Edge JSON) | COMMITTED | UI contract | `c7a0b54` |
| SIG-009 | P2 | Jobs/Housing/My Path/Resources/Pathways data tools | COMMITTED | RPC search + summary | `c7a0b54` |
| SIG-010 | P2 | Signal eval suite (grounding, injection, gateway) | COMMITTED | `signal-eval.test.ts` | `c7a0b54` |

### Workstream A — Jobs & Housing

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| JOB-001 | P1 | List/detail UI declutter | COMMITTED | `audit-jobs`, `audit-housing` | `e4fac5a` |
| JOB-002 | P1 | Application + status E2E on device | NOT TESTED | manual checklist | — |

### Workstream B — Record Relief & Marketplace

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| RR-001 | P1 | Hub UI simplification | COMMITTED | manual | `6678c15` |
| RR-002 | P1 | Case detail / scan / add flows QA | NOT TESTED | `audit-relief` | — |
| MKT-001 | P1 | Browse UI simplification | COMMITTED | `audit-marketplace` | `6678c15` |
| MKT-002 | P1 | Claim / pickup member loop on device | NOT TESTED | `audit-marketplace` | — |

### Workstream C — Ten pathways

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| PATH-001 | P1 | Coverage audit all 10 | TODO | `audit-v1-pathway-coverage.mjs` | — |
| PATH-002 | P1 | Primary action per pathway (no dead ends) | TODO | device | — |

### Workstream D — Auth & membership

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| AUTH-001 | P1 | Preserve uncommitted auth work | IN PROGRESS | git status only | — |
| AUTH-002 | P1 | Registration / onboarding device journey | NOT TESTED | `audit-onboarding` | — |

### Workstream E — Community & opportunity

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| COM-001 | P1 | Two-member Exchange UI E2E | NOT TESTED | RPC 13/13 | — |
| OPP-001 | P2 | Orchestrator + alerts foundation | PARTIALLY IMPLEMENTED | unit tests | — |

### Cross-app QA (Day 5–6)

| ID | P | Task | Status | Verification | SHA |
|----|---|------|--------|--------------|-----|
| QA-001 | P0 | Full `npm run test:all` after Signal commit | TODO | CI-equivalent local | — |
| QA-002 | P0 | iPhone scroll + keyboard matrix | NOT TESTED | owner device | — |

---

## Checkpoint — resume here if session ends

1. **HEAD:** `d08d1d2` — Signal conversation IA
2. **Active task:** SIG-005 (server model routing) or finish RR/MKT device QA (NOT TESTED)
3. **Commands:** `node scripts/audit-ai.mjs`; `node --test --experimental-strip-types tests/signal-ui-contract.test.ts`
4. **Do not touch:** unstaged files in `src/core/auth/*`, `package.json`, proposed migrations (other agents)
5. **Next implementation:** `supabase/functions/_shared/core/ai-gateway/signal-chains.ts` routing doc + client hook for enriched answers without cluttering UI

---

## Day plan alignment

| Day | Focus | Board IDs |
|-----|-------|-----------|
| 1 | Signal foundation + blocker inventory | SIG-001–004, RB matrix, JOB/MKT partial |
| 2 | Signal capabilities + pathways | SIG-005–008, PATH-* |
| 3 | Auth + member context | AUTH-*, SIG-007 |
| 4 | DEV E2E + RLS | QA-001, COM-001 |
| 5 | Device QA | QA-002, JOB-002, MKT-002 |
| 6 | Release candidate | QA-001 full, open RB closure |
