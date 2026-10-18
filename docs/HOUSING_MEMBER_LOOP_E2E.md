# Housing member loop E2E

**Automated:** `npm run test:housing`, `npm run test:signal-deploy`.

**DEV account:** signed-in member with location ZIP saved (e.g. `dev-free@fairpath.test`).

## 1. Discover

1. `/find-housing` (guest OK) → `search_housing` RPC, infinite scroll + LIST/MAP.
2. Filters / radius / WHERE behave like jobs (saved ZIP prefill, manual override respected).
3. Failed search clears prior results (no stale homes under error).

## 2. Save

1. Sign in → listing detail → **SAVE** in header.
2. `/saved-homes` shows bookmark; remove surfaces errors on failure.
3. Signed out → save → `/sign-up?returnTo=/housing/{id}`.

## 3. Signal

1. **ASK SIGNAL** on listing → fit explanation or honest fallback (credits/rate limit).
2. Requires DEV Signal deploy: `docs/SIGNAL_DEV_DEPLOY.md`.

## 4. Apply (draft-first)

1. **START APPLICATION** opens `/housing-apply/new?listing={id}&mode=standard` — **no DB row yet**.
2. Complete step 2+ → **SAVE & CONTINUE** creates/updates draft via `save_housing_application_draft`.
3. Submit via `submit_housing_application` → `/housing-application/{id}?submitted=1`.
4. Returning to listing → **VIEW APPLICATION** (not a second draft).

**FastTrack:** member FastTrack is **retired** (`HOUSING_FASTTRACK_MEMBER_ENABLED = false`); checkout screen must say so.

## 5. Hub

1. `/housing-applications` splits **ACTIVE** vs **HISTORY**; tap → `/housing-application/{id}`.
2. Workspace: submitted fields, document manager, event timeline, **Withdraw** (submitted/reviewing/tour), link back to **All my applications**.
3. **Application prep (Signal)** on workspace when listing is loaded → tips or honest fallback.

## 6. Saved searches

1. `/find-housing` → **Save search** → `/saved-housing-searches`.
2. **Run search** restores query/location/filter params on find-housing (alert copy matches jobs: text + location only).

## 7. Local SQL boundary (CI)

`npm run test:sql:housing-documents` — submit blocked until required docs exist in storage; `test:local-cross-member-isolation` covers saved housing RLS.

## Preconditions

- DEV listings published; migrations for secure housing RPCs applied.
- Document upload uses real storage paths before submit (server enforces `REQUIRED_DOCUMENTS_MISSING`).
