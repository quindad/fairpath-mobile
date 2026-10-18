# P0 / P1 defect register (Task 009)

Living register for **release-blocking (P0)** and **high (P1)** gaps on `development/mobile-v1-completion`. Automated suite can be green while rows here stay open — that is expected until operator/device proof lands.

Status: **OPEN** | **MITIGATED** (honest UI / blocked path) | **CLOSED** (evidence linked)

## P0 — must resolve before member launch

| ID | Summary | Status | Evidence / mitigation | Owner |
| --- | --- | --- | --- | --- |
| P0-001 | DEV cloud migrations not applied / not reconciled with repo | OPEN | Runbook `DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md`; `test:sql` local only | Operator |
| P0-002 | Sign in with Apple not proven on physical iOS dev build | OPEN | Task **013**; capability + Supabase provider | Sterling |
| P0-003 | Google native OAuth not proven on device | OPEN | Task **014**; OAuth client + Supabase | Sterling |
| P0-004 | Signal Edge provider secrets unset → no live model text proof | MITIGATED | Fallbacks in `signal.ts`; deploy OK — `SIGNAL_DEV_DEPLOY.md` | Operator |
| P0-005 | Push: no end-to-end device proof (register, receive, tap deep link) | OPEN | Audit notes missing client token registration; **114–118** | Device QA |
| P0-006 | FairPath+ / IAP or Stripe sandbox not proven on store builds | OPEN | App honest when store off; **092–100** | Billing + device |
| P0-007 | Password reset email + `fairpathmobile://` deep link not proven on DEV mail/devices | OPEN | Auth checklist; PKCE tests pass offline | Device QA |
| P0-008 | Android Maps API key missing → gray map on Android native | OPEN | `EXTERNAL_INTEGRATION_REGISTER.md` § Maps; iOS OK | Config |

## P1 — high priority, not always launch-blocking

| ID | Summary | Status | Evidence / mitigation | Owner |
| --- | --- | --- | --- | --- |
| P1-001 | Jobs member loop not run on live DEV data | OPEN | **053**; `JOBS_MEMBER_LOOP_E2E.md` | QA |
| P1-002 | Housing member loop not run on live DEV data | OPEN | **060 (manual)**; `HOUSING_MEMBER_LOOP_E2E.md` | QA |
| P1-003 | Resource detail accuracy / responsive browse | OPEN | **042**, **038** | QA |
| P1-004 | Record Relief legal review gate incomplete for production jurisdictions | OPEN | **071**; `RECORD_RELIEF_LEGAL_REVIEW_GATE.md` | Legal |
| P1-005 | Microsoft / Yahoo / phone auth scope undecided | OPEN | Tasks **015–016** | Product |
| P1-006 | Housing saved-search alerts do not evaluate all filter dimensions | MITIGATED | Honest copy in saved-search screens | By design v1 |
| P1-007 | Feature-backend matrix drift when new routes ship | MITIGATED | This file + `FEATURE_BACKEND_MATRIX.md` — update on new surfaces | Engineering |

## Closed / verified this branch (reference)

| ID | Summary | Closed evidence |
| --- | --- | --- |
| — | Post-auth routing (`returnTo`, onboarding gate) | `test:auth-post-auth`, **017** |
| — | Onboarding finish-later loop | **028**, `test:onboarding` |
| — | Housing applicant cannot self-approve or forge events | `test:housing`, secure migration |
| — | Jobs applications RPC-only, no DOB/address to employers | `test:jobs`, `test:sql:jobs-e2e` |
| — | Offline regression suite | `npm run test:all` **63/63** @ `0b44abd` |

**Related:** `docs/LAUNCH_BLOCKERS_BACKEND_2026-10-09.md`, `docs/MOBILE_BUILD_EXIT_CRITERIA.md`, `docs/FAIRPATH_MOBILE_MASTER_COMPLETION_TRACKER.md`.
