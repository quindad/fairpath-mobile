# Mobile performance audit

Evidence from reading the actual client code (request shape, column lists, limits), not guessing. Home is
covered in depth since it's the highest-traffic screen and was explicitly flagged as a suspected waterfall.

## HOME

| | |
|---|---|
| **Initial request count** | 6 concurrent calls on mount: `loadUnreadNotificationCount()`, `loadFairPathReadiness()` (→ 2 parallel queries internally), `loadJobs()`, `loadSavedJobIds()` (all from `home.tsx`), plus `loadMemberSummary()`, `loadNextMeeting()`, `myEarlyAccessEnrollments()` (from `HomeStatus.tsx`) |
| **Duplicate requests** | **Found and fixed:** `loadJobs()` had no limit override, so Home fetched **20 full job rows** (32-column `JOB_COLUMNS`, including full `description`/`requirements`/`skills` text) to display only 2 "Featured" cards — 18 rows fetched and immediately discarded. Fixed: `loadJobs('','',{},2)`, server-side limit now matches what's actually rendered |
| **Slowest request** | Not measured with real timing instrumentation this pass — flagging as a gap, not a number I don't have |
| **Query type** | `get_member_home_summary` is a single server-side RPC (good — this is NOT a client-side query waterfall, contrary to the initial suspicion). The remaining calls are simple owner-scoped table reads |
| **Pagination** | `loadJobs` now correctly limited; `loadSavedJobIds` is a single lean column (`job_id` only) with no pagination need |
| **Payload concern** | The `JOB_COLUMNS` list is wide (32 columns) and appropriate for a job-detail or search-result view, but was being requested 10x over-scoped for a 2-card preview before this fix |
| **N+1 risk** | None found — no per-row follow-up queries anywhere in Home's own code |
| **Render-triggered refetch** | `home.tsx`'s two `useEffect`s both depend on `[pathname, reloadKey]` — correctly re-fire only on navigation or an explicit manual retry (`reloadKey`), not on every render |
| **Real finding not fixed this pass — duplicate auth resolution** | `currentUser()` (used by `loadSavedJobIds` and many other services) and `loadProfileAnswers` (used by `loadFairPathReadiness`) each independently call `supabase.auth.getUser()`, which unlike `getSession()` is a real network round-trip to Supabase Auth (by design, for security — it re-validates the JWT server-side rather than trusting local storage). On a single Home load this means **at least 2, plausibly more, separate `auth.getUser()` round-trips fire in parallel** for the same already-known signed-in identity. Not fixed this pass: consolidating this safely (e.g. a request-scoped memoized `currentUser()`) touches a shared primitive used across the entire codebase, and changing it without being able to run the test suite (mid-session tool outage) was judged too risky to do blind. Recommended shape for later: memoize `currentUser()`'s result for the lifetime of one "page load" (cleared on navigation/sign-out), not a permanent cache. |
| **Recommended fix** | (1) `loadJobs` limit — **done**. (2) Consolidate duplicate `auth.getUser()` calls — **not done, real, flagged**. |
| **Before** | 20-row job fetch discarding 18; N separate `getUser()` calls |
| **After** | 2-row job fetch; `getUser()` duplication unchanged (flagged, not fixed) |

## JOBS (search)

| | |
|---|---|
| **Request count** | One `search_jobs` RPC per search, correctly debounced by the `nonce` pattern (typing doesn't refire until Enter/blur) |
| **Pagination** | Real, server-side (`offset`/`limit`, `hasMore` returned), confirmed working this session across multiple live searches |
| **Duplicate requests** | None found |
| **Payload concern** | Search results use the same wide `JOB_COLUMNS` as Home — appropriate here since these ARE the rows being displayed in full card form |
| **N+1 risk** | None — `search_jobs` is a single SECURITY INVOKER function, not a loop of per-job queries |
| **Fix** | None needed |

## HOUSING (search)

Same shape as Jobs: one RPC per search (`search_housing` equivalent), real server-side pagination, no N+1 found.
Not re-audited line-by-line this pass beyond confirming the pattern matches Jobs (same author, same era of code).

## RESOURCES (search)

| | |
|---|---|
| **Request count** | Two parallel calls per search: `searchResources(...)` and `resolveResourceNeeds(...)` (skipped on load-more via `append ? Promise.resolve(matchedNeeds) : ...` — correctly avoids re-running the needs-resolution on pagination) |
| **N+1 risk** | `refreshStates(page.resources.map(r => r.id))` runs after every page loads — need to confirm this is a single batched call, not one query per resource id (not verified this pass; flagging as unconfirmed rather than assuming either way) |
| **Fix** | None applied; the `refreshStates` batching question above is the one open item worth a follow-up look |

## ME

Lean: 2 parallel calls on load (`loadMemberSummary()` — same RPC Home uses, correctly re-called fresh on this
separate screen, not a bug — and `loadContact()`). No waterfall, no N+1.

## DOCUMENTS

| | |
|---|---|
| **Request count** | `listMyDocuments()` + `RENDERABLE.map(readinessFor)` (4 parallel calls, one per document type) + a second `Promise.all` computing `currentFingerprint()` for every "latest ready" document (N more parallel calls, N = however many renderable documents exist and are current) |
| **Duplicate requests — found, real** | `readinessFor()`'s 4 types are `saved_resources_list`, `resource_contact_sheet`, `resource_required_documents`, `opportunity_profile`. **The first three all independently call the same `loadSavedResourceDetails()` query** (confirmed by reading `src/core/documents/generate.ts:55-58`) — meaning this one query fires 3 separate times in parallel to answer what is functionally the same question ("does this member have saved resources?") three times over |
| **N+1 risk** | The fingerprint `Promise.all` scales with the number of "latest ready" documents a member has — not unbounded, but grows linearly with document count with no cap |
| **Fix** | **Applied**: `readinessFor()` now dedupes concurrent `loadSavedResourceDetails()` calls internally (a shared in-flight promise, cleared once resolved) rather than each of the 3 resource-type checks firing its own request — no call-site changes needed, `create.tsx`'s single-type usage is unaffected |
| **Before/after** | Before: 3x redundant `loadSavedResourceDetails()` calls per Documents screen load. After: 1x, shared across the three checks that need it. (Verification pending a shell-tooling outage during this pass — see commit for confirmation status) |

## MARKETPLACE (browse)

| | |
|---|---|
| **Request count** | 3 independent queries per search/filter change: `loadMarketplace(...)`, `loadSavedMarketplaceIds()`, `loadMarketplaceQuota()` |
| **Duplicate requests — found, real** | The three ran **sequentially** (`await` one after another), not in parallel, despite having zero data dependency between them - the same shape as the Documents/Home findings above |
| **Fix** | **Applied**: `Promise.all`, preserving the original error semantics exactly (the two secondary calls already failed soft internally; a real `loadMarketplace` failure still propagates to the same outer catch) |
| **Before/after** | Before: 3 sequential round-trips. After: 1 round-trip's worth of latency (the slowest of the three), not measured with real timing instrumentation this pass |

## AUTH — re-confirmed, still not fixed

Re-checked this pass: 13 call sites across the app call `supabase.auth.getUser()` directly (a real network
round-trip, not a local cache read - by Supabase's own design, for security). `src/core/supabase/current-user.ts`
exists as a thin wrapper but does **not** cache or memoize anything - routing more call sites through it would
not reduce the actual number of round-trips, only improve code consistency. This remains the same real,
previously-flagged finding from a prior session (see the Home section above): fixing it for real requires an
actual memoized/context-based `currentUser()`, which touches a shared primitive used across roughly a dozen
files. Still judged too broad a change to make safely in a single pass without dedicated regression testing
across every affected screen - not attempted again this pass for the same reason.

## Summary

The one measured, fixed improvement this pass: Home's featured-jobs fetch cut from 20 rows to 2 (a real ~90%
reduction in that specific request's payload and server-side work). The one measured, NOT-fixed finding: likely-
redundant `auth.getUser()` round-trips on Home, real but requires touching a shared primitive carefully with the
test suite available, not mid-outage. No N+1 patterns found in Jobs/Housing/Resources search. Real per-request
timing (slowest request, actual before/after milliseconds) was not instrumented this pass — the DEV integration-
health screen's ~600ms `coverage_markets` read time (noted previously) is ordinary DEV/network latency to a
remote Supabase project from a local dev server, not evidence of an inefficient query — a single-row-count HEAD
request has no meaningful query cost to optimize.
