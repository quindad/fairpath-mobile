# Jobs member loop E2E

**Automated:** `npm run test:jobs`, `npm run test:signal-deploy`, `npm run test:sql:jobs-e2e` (local Postgres).

**DEV account:** `dev-free@fairpath.test` or `dev-plus@fairpath.test` (password in vault).

## 1. Discover (guest or signed in)

1. Open `/find-jobs` while signed out → published jobs load via `search_jobs` RPC.
2. Change WHERE / radius / filters → results refresh; a failed search clears stale rows (no ghost listings).
3. Toggle **LIST / MAP** → same result set; tap a pin → job details.

## 2. Save

1. Sign in → open a job → **SAVE** in the header.
2. `/saved-jobs` lists the bookmark; `/home` **SAVED** count increments when summary RPC returns data.
3. Sign out → tap **SAVE** on a job → `/sign-up?returnTo=/job/{id}`.

## 3. Signal on job

1. Signed in → **ASK SIGNAL** → text or honest fallback (402 credits, 503 rate limit).
2. **DRAFT COVER LETTER** → draft text; edit before any external send (2 credits server-side).

Requires DEV Edge deploy + secrets: `docs/SIGNAL_DEV_DEPLOY.md`.

## 4. Easy Apply

1. Job with **EASY APPLY** → **EASY APPLY WITH FAIRPATH** → `/job-apply/{id}`.
2. Autofill from Opportunity Profile (skills/credentials/education) when present.
3. Submit → `/job-application/{id}`; duplicate submit → **Already applied** toast.
4. Job detail primary CTA becomes **VIEW APPLICATION**.

## 5. Applications hub

1. `/job-applications` lists submitted apps (pull to refresh); tap a row → `/job-application/{id}`.
2. Detail shows status copy, submitted profile fields (whitelist only — no DOB/address), and event timeline.
3. **Withdraw** when status is submitted/viewed/interview/offer → status **WITHDRAWN** via `withdraw_job_application` RPC.
4. **Interview prep (Signal)** on detail → text or honest fallback (credits/rate limit).

## 6. Saved searches

1. On `/find-jobs`, run filters/query → **Save search** (bookmark control).
2. `/saved-job-searches` lists saved rows; **Run search** reopens find-jobs with the same query/location/filter params.
3. Delete removes the row server-side. Alert copy is honest: notifications match **search text + location**, not every filter yet.

## 7. Local SQL boundary (CI)

`npm run test:sql:jobs-e2e` — submit/duplicate/withdraw, RLS, and employer-safe fields (no network).

## Preconditions

- DEV migrations applied; published jobs exist in DEV (seed/QA harness).
- Signal functions deployed for AI steps (optional — fallbacks must not crash).
