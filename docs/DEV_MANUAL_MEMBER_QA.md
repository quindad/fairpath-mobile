# DEV manual member QA (Jobs 053 · Housing 060 · Signal)

**When:** After DEV migrations applied (`DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md`) and `.env.local` points at `znvhmuhojvwvjzmaqwff`.  
**Accounts:** `docs/DEV_TEST_ACCOUNTS.md` (vault — not in git). Suggested: `dev-plus@fairpath.test` (Signal credits), `dev-free@fairpath.test` (baseline).

**Surfaces:** Expo web on PC (`npm run web`) and/or **development build on phone** — setup: `docs/DEVICE_DEV_QUICKSTART.md` (`npx expo start --tunnel`). Native-only flows (maps, Apple Sign-In) require dev client.

Record **PASS / FAIL / BLOCKED** and date. Do not mark PASS without running the step.

---

## A. Signal smoke (Edge + credits)

Preflight (PC): `npm run test:signal-deploy` pass; Edge secrets set per `SIGNAL_DEV_DEPLOY.md`.

| # | Step | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| S1 | Sign in as dev-plus | Session OK | | |
| S2 | Open a **published** job → **Why might this job fit me?** | Text or honest fallback (not crash) | | 402 = out of credits OK |
| S3 | Same job → **Draft cover letter** | Draft text or fallback | | |
| S4 | Open a **published** listing → **Ask Signal** (fit) | Text or fallback | | |
| S5 | `/letter-explainer` + clear photo | Vision text or fallback | | Needs OpenAI/Google key |
| S6 | Application detail → **Interview prep** (jobs) | Text or fallback | | |

---

## B. Jobs member loop (Task 053)

| # | Step | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| J1 | Signed out → `/find-jobs` | List loads | | |
| J2 | Change WHERE / radius / filters | Results refresh; error clears stale rows | | |
| J3 | LIST / MAP toggle | Same set; pin opens detail | | Android map may be gray without Maps key |
| J4 | Sign in → job detail → **Save** | Saved; `/saved-jobs` shows row | | |
| J5 | **Easy Apply** on easy-apply job | Submit → application detail; duplicate → Already applied | | |
| J6 | `/job-applications` | Lists apps; open detail | | |
| J7 | Save search → `/saved-job-searches` → **Run search** | Params restored on find-jobs | | |

Detail: `docs/JOBS_MEMBER_LOOP_E2E.md`.

---

## C. Housing member loop (Task 060 manual)

| # | Step | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| H1 | Signed out → `/find-housing` | List loads | | |
| H2 | Filters / radius / failed search | No stale homes under error | | |
| H3 | Sign in → listing → **Save** | `/saved-homes` | | |
| H4 | **Start application** | `/housing-apply/new?listing=…` — **no** row until Save & continue | | |
| H5 | Complete draft + required docs → **Submit** | Workspace with submitted=1 | | |
| H6 | `/housing-applications` → workspace | Timeline, withdraw, Signal prep | | |
| H7 | FastTrack checkout route | Honest “no longer offered” if retired | | |

Detail: `docs/HOUSING_MEMBER_LOOP_E2E.md`.

---

## Blockers (log here)

| Blocker | ID |
| --- | --- |
| No published jobs/listings in DEV | Seed / QA harness |
| Migrations not pushed | P0-001 |
| Signal secrets missing | P0-004 (fallback only) |
| Android map blank | P0-008 |

**Related:** `docs/P0_P1_DEFECT_REGISTER.md`, `docs/PHYSICAL_DEVICE_QA_PLAN.md`.
