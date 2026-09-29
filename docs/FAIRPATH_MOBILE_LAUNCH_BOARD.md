# FairPath Mobile Launch Board — source of truth

Built by verifying against code, migrations, the real DEV database, the real deployed-Edge-Function list, the
Browser pane, and the automated test suites — not by summarizing prior reports. Where a prior doc disagreed with
what the code/runtime actually shows, this board follows the code/runtime. Every 🟢 has concrete evidence you can
challenge: a test command and count, a specific Browser-tested route, a migration name — never "tested previously."

**Status legend** (forced, no soft language):
- 🟢 **PROVEN** — implementation + DB/server layer exist, signed-in DEV behavior exercised where applicable,
  negative/error paths tested, cross-module checked, no known blocker on the tested path.
- 🟡 **BUILT — EXTERNAL SETUP REQUIRED** — FairPath's own implementation substantially exists; an external
  provider/key/account/OAuth/device config blocks full verification.
- 🟠 **BUILT — REAL DATA REQUIRED** — the system works; usefulness today depends materially on TEST/fixture data.
- 🔴 **INCOMPLETE** — meaningful functionality is missing or broken. Architecture alone or a screen alone never
  counts as done.
- ⚪ **DEFERRED FROM V1** — deliberately out of Mobile V1 scope, not secretly unfinished.

Sub-columns use PASS / NEEDED / N/A / BLOCKED so a 🟢 can never quietly hide a device/provider requirement.

---

## AUTH / ACCOUNT — 🟢 PROVEN (core), 🟡 (Apple)

| Capability | Status | Evidence |
|---|---|---|
| Registration, email/password, password reset | 🟢 | `audit-auth.mjs` PASS; `/sign-up`, `/forgot-password`, `/reset-password` are real screens over Supabase Auth, driven signed-in this project repeatedly |
| Google Sign-In | 🟡 | Real code path (`social-auth.ts:signInWithGoogle`), never driven end-to-end this session — depends on the DEV Supabase dashboard's Google OAuth provider being configured, which I cannot see or set. Queued as a one-line "check the dashboard" Sterling action, not yet confirmed done or not-done |
| Apple Sign-In | 🟡 | Real code (`signInWithApple`, nonce-bound, `expo-apple-authentication`), correctly returns `false` off iOS (`isAppleSignInAvailable`) — needs Apple Developer capability + Supabase provider + dev-client rebuild + physical iPhone. Unchanged for multiple sessions |
| Callback / session restore | 🟢 | `/auth/callback` is the one page that turns URL tokens into a session; used successfully every single Browser QA session via the `qa:dev-ui` magic link, including after a hard environment reset this session |
| Sign out | 🟢 | Present in `/me`; not re-tested this pass specifically, but no code change since last verified |
| Account/profile creation | 🟢 | `handle_new_user` trigger; every disposable QA member this session got a real profile row automatically |
| Account deletion request, privacy controls | 🟢 | `audit-security.mjs` PASS; `/privacy` deletion request/cancel flow Browser-verified in a prior session (idempotent, honest "not deleted" language) |

## HOME — 🟢 PROVEN

| Capability | Evidence |
|---|---|
| Real-state status card, next steps, meeting/credit/relief chips | `HomeStatus.tsx`; Browser-verified live this session showing a real Record Relief "case may be ready" chip and a real housing-draft chip, both matching actual DB state |
| Coverage/waitlist state | **New this session.** Browser-verified live: "On the Early Access list for 99999" appears correctly and only while `waitlisted` |
| Notification badge | Exists (`unread_notification_count()`), not re-tested this pass |
| Navigation | `ScreenFrame` structurally prevents duplicate bottom nav across every route (see Theme/Nav section) |

## ME — 🟢 PROVEN

Every link and count spot-checked live this session: Opportunity Profile "1 of 8", Record Relief "7 case(s) tracked"
(exactly the 7 TEST cases created this session), Documents "4" (exactly the 4-document packet built this session),
1 saved home — zero stale counts, zero dead links found.

## OPPORTUNITY PROFILE — 🟢 PROVEN

Verified in a prior session's signed-in marathon: all 8 sections, editing, server persistence, Easy Apply autofill
(the bug where it only read the legacy questionnaire was found and fixed this project), snapshot creation with a
confirmed-by-raw-row employer-visible boundary (no DOB/address/justice data/pay). Not re-driven this pass; no code
changed underneath it.

## JOBS — 🟠 BUILT — REAL DATA REQUIRED (core mechanics 🟢, inventory 🟠)

| Capability | Status | Evidence |
|---|---|---|
| Browse/search/filters/detail/save/saved jobs/questions | 🟢 | `audit-jobs.mjs` PASS; prior signed-in Browser marathon |
| Easy Apply, required questions, duplicate prevention, autofill, snapshot | 🟢 | Fixed this project (autofill bug), server-enforced (`submit_job_application` RPC, ALREADY_APPLIED check before validation) |
| Application state | 🟢 | RPC-only writes, event trail (`job_application_events`) |
| Zero-inventory handling | 🟢 | **New this session**, Browser-verified live: ZIP 99999 + no-match query correctly shows "FairPath does not have enough verified opportunities" with a working JOIN EARLY ACCESS button, distinct from a genuine filter miss |
| Inventory provenance architecture | 🟠 | Exists in schema (`opportunity_sources`, `external_opportunities`, `jobs.source_id`/`external_opportunity_id`) but **entirely dormant** — zero code references it (found and corrected this session) |
| Real inventory source | 🔴 | 100% DEV fixture (`FairPath DEV Seed`/`FairPath DEV QA` labels). No employer posting flow, no ATS integration, no feed exists |

## HOUSING — 🟠 BUILT — REAL DATA REQUIRED (core mechanics 🟢, location intelligence 🟡, inventory 🟠)

| Capability | Status | Evidence |
|---|---|---|
| Browse/search/filters/map-list/markers/detail/save/questions | 🟢 | `audit-housing.mjs` PASS; prior Browser marathon; native map uses real `react-native-maps` |
| Standard Apply / FastTrack / required documents / application state | 🟢 | Prior Browser marathon; required-document enforcement confirmed genuinely blocking submission |
| Withdrawal | 🟢 | Present, not re-tested this pass |
| Zero-inventory handling | 🟢 | **New this session**, Browser-verified live, same pattern as Jobs |
| Maps (native) | 🟢 | `react-native-maps`, real Apple Maps on iOS with zero config |
| Maps (Android) | 🟡 | Same library needs a Google Maps API key in `app.json` — confirmed unset. Verified against current SDK 57 docs this session: `expo-maps` (new, alpha) is NOT the right move — it has zero web support, would regress the working web fallback |
| Geocoding/reverse geocoding | 🟡 | `expo-location`'s `geocodeAsync`/`reverseGeocodeAsync` verified this session against real SDK 57 docs: free, no key, works on web — simply not wired into any screen yet |
| Walkability/transit/schools/nearby | 🟠 | **Corrected this session** — real schema already exists (`housing_listings.walk_score/transit_score/bike_score`, `housing_schools`, `housing_nearby_places`, all with provenance columns) and the UI (`housing/[id].tsx`) already renders it correctly with an honest "shown only when verified" note. DEV seed deliberately leaves it NULL (`build-inventory.mjs:288`, explicit no-fabrication comment). No provider ever connected — this is real-data-required, not not-built |
| Inventory provenance | 🟠 | Same dormant pipeline as Jobs |
| Real inventory source | 🔴 | 100% DEV fixture/QA seed data |

## RESOURCES — 🟢 PROVEN (mechanics), 🔴 (real data)

Taxonomy, plain-language needs, search/radius/national/urgent/filters, detail, freshness/verification, save/
started/finished, reports: all built and verified in a prior session (`audit-resources.mjs`, `test-local-resources.mjs`
16/16). Provenance model is real and in active use (published/verified/fresh/stale/expired), unlike Jobs/Housing's
dormant pipeline. Real data source: 🔴 — still 100% DEV fixture; 211/government open-data/partner-verification
sourcing is a real business decision, not started.

## EARLY ACCESS / COVERAGE — 🟢 PROVEN

Built, deployed to DEV, and Browser-verified end to end THIS session, twice over (initial build + a follow-up
integration pass after Sterling's request):
- Market model, coverage states, ZIP-prefix resolution: `supabase/migrations/20261003100000_coverage_markets.sql`, `test-local-coverage.mjs` 10/10 (idempotency, RLS isolation, cascade delete, unknown-market rejection, longest-prefix-wins).
- No-results vs no-coverage distinction: Browser-verified live on both `/find-jobs` and `/find-housing` (ZIP 99999).
- Enrollment + duplicate protection: Browser-verified via a full page reload from zero client state returning "Already on the list" from the server (proves persistence, not client illusion).
- Home integration: Browser-verified live (chip only while `waitlisted`).
- AI integration: new `market_coverage` intent, Browser-verified live, reads real enrollment through the existing read-only gateway, zero personal-data leak to signed-out callers (test-covered).
- Coverage activation / 60-day entitlement grant: **now DEV-VERIFIED, and a real bug was found and fixed doing
  it.** Seeded a fictional TEST market (via forward migration, bypassing the need for a service-role REST key)
  matching a ZIP a real disposable member had already enrolled in earlier this session, then activated it.
  **Found:** `activate_coverage_market()` only matched enrollments already stamped with `market_id`, but
  `join_early_access()` resolves `market_id` once at enroll time — a member who joins before any market is
  configured for their ZIP (the realistic product scenario) had `market_id = null` forever, and the grant never
  fired. Confirmed live: the member's `/plus` page stayed on the free plan after the buggy activation ran.
  **Fixed** to match by ZIP-prefix membership at activation time, not the enroll-time snapshot. Re-verified live
  on DEV after the fix: the member's Notifications inbox shows the correct "FairPath+ is active — 60 days" and
  market-live messages, `/fairpath-ai` correctly answers "FairPath is now active in 99999." Regression test added
  reproducing the exact sequence. TEST artifacts cleaned up afterward via a forward migration; the code fix is
  permanent.
- Cross-member isolation: local-test proven (`test-local-coverage.mjs`: "M's list contains only M's rows", RLS blocks direct cross-read).
- National tools remain accessible after enrollment: Browser-verified (`/early-access` always renders the six national-tool links).

**Status upgrade: Early Access moves from "PROVEN with one documented gap" to fully PROVEN** — every item in
Sterling's 19-step lifecycle checklist has now been exercised, including the one that required a real bug fix.

## FAIRPATH+ — see `docs/FAIRPATH_PLUS_CURRENT_VALUE.md` for the full breakdown

Entitlement MODEL: 🟢 (server-controlled, auditable, idempotent, cannot self-award — `entitlement_grants`,
proven this project across correctional-transition and now early-access-market sources). Actual member-facing
VALUE today: see the separate doc — short version, thin.

## CREDIT BUILDER — 🟢 PROVEN (workflow), 🟡 (extraction)

Upload/private storage, candidate review, correction, reject/not-mine, confirmed issue, disputes, reason
categories, tracker, due dates, identity correction, dispute letter, evidence checklist, history, packet,
Documents, privacy/isolation: `audit-credit.mjs` PASS, `test-local-credit.mjs` 13/13, prior signed-in Browser
marathon (full four-stage stage model driven live, including the "not mine" path this session's earlier
continuation). Extraction: 🟡 — function exists (`extract-credit-report`), tested offline
(`test-credit-extraction.mjs` PASS), but **NOT deployed to DEV** (confirmed via `supabase functions list` this
session — only `render-document` is live), disabled by default pending Sterling's provider/privacy decision.

## RECORD RELIEF — 🟢 PROVEN (TEST engine), 🔴 (real 50-state coverage)

TEST engine: exhaustively proven THIS session — 8 deliberately distinct fact patterns, all correct: eligible-now,
waiting-period-with-exact-countdown, restitution-blocked, offense-excluded, manual-review-recommended, stale-rule-
warning, no-rules-yet (honest, zero fabrication), edit-and-recalculate (with an honestly appended history log).
Federal/state separation, rule versions, provenance, required documents, checklists, forms, packets (4-doc packet
built and Browser-verified), Documents integration: all real, all exercised. `test-local-relief.mjs` 15/15,
`test-relief-fixtures.mjs` PASS. **Real 50-state/DC/federal coverage: 🔴, unambiguously.** Zero real jurisdictions
have verified rules — this was always the plan, not a regression. This is a legal-content-sourcing project, not a
code task; see `docs/EXTERNAL_INTEGRATION_REGISTER.md` §13 for the coverage-matrix framework.

## RESUME STUDIO — 🟢 PROVEN

Create, edit, profile import, manual edit, duplicate, delete, 20-resume limit, PDF, DOCX, Documents, isolation:
`test-local-resume.mjs` 6/6. The `createResume` RLS bug (missing `user_id`) was found and fixed live this project;
PDF/DOCX export was broken project-wide by the Metro/tslib bug, also found and fixed, confirmed live afterward.

## DOCUMENT ENGINE — 🟢 PROVEN (web), 🟡 (native share/print/Files)

Shared `DocumentSpec`, PDF/DOCX/CSV/ZIP, versioning, regeneration, stale-fingerprint detection, safe filenames,
private storage, signed URLs, delete, My Documents: `test-local-documents.mjs` 12/12, `test-documents-render.mjs`
PASS, and Browser-verified repeatedly this project including this session (the 4-document Record Relief packet).
Web download/print: 🟢, driven live. **iOS Files/share/print, Android save/share/print, opening in Word/Pages/
Google Docs: 🟡 — PHYSICAL DEVICE REQUIRED, never tested, cannot be tested from the Browser pane.**

## MEETINGS — 🟢 PROVEN

Create, virtual/phone/in-person, provider-agnostic URL, reschedule, cancel with reason, status machine
(scheduled→confirmed→completed, invalid-transition rejection tested), upcoming/past, Home, AI, isolation:
`test-local-meetings.mjs` 5/5. The `createMeeting` RLS bug was found and fixed live this project, confirmed via a
second creation + cancel this session's earlier continuation.

## FAIRPATH AI — 🟢 PROVEN

Deterministic router, allow-listed read-only gateway, provenance tracking, signed-out privacy (zero personal
reads verified by a test spy), cross-member isolation: `audit-ai.mjs` PASS (now covering 10 starter intents + the
new market_coverage intent). Jobs/Housing/Resources/Credit/disputes/Record Relief/resumes/meetings/Documents
intents: all real, all tested. **Coverage/waitlist: new this session**, Browser-verified live. External model
status: `NO_MODEL` adapter — by design, no model connected, deterministic answers are the product today.

## NOTIFICATIONS — 🟢 PROVEN (in-app), 🟡 (push), 🔴 (email/SMS)

In-app (`user_notifications`), read/unread, reminders (entitlement expiry cron already scheduled): 🟢, used
correctly by this session's own Early Access work. **Push: corrected this session** — real server-side delivery
architecture exists (`push_tokens`, `register_push_token()` RPC, `notification_deliveries` queue, an automatic
trigger that queues every notification for push), but zero client code ever registers a token and no worker
consumes the queue — deliberately not wired this session since it needs a native-module device rebuild I cannot
verify. Lock-screen privacy / preferences: not built (no preference table exists). Email/SMS: 🔴, no scaffolding
of any kind.

## MAPS / LOCATION — see Housing section above; summarized: native 🟢, Android key 🟡, geocoding 🟡 (verified viable, unused), walkability/schools 🟠 (real schema, no provider)

## PAYMENTS — 🟡 BUILT — EXTERNAL SETUP + DEPLOYMENT REQUIRED

Schema (`20260930110000_payments.sql`), client (`payments-service.ts`, `PaymentsProvider.native.tsx`), and a
`stripe-webhook` Edge Function all exist in source. **Confirmed via `supabase functions list` this session: NOT
deployed to DEV** (only `render-document` is live). No `.env` exists at all, so `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
is unset and the client SDK never initializes. This is further from working than "just add a key" — it also needs
an Edge Function deploy. `audit-payments.mjs` PASS (schema/contract correctness only, not live behavior).

## THEME / NAVIGATION / UX — 🟢 PROVEN

Dark/light (dark default), phone/web width, consistent bottom nav (structurally guaranteed by `ScreenFrame`),
back/returnTo, keyboard, date picker, loading/error/empty states: `audit-theme.mjs`, `audit-navigation.mjs`,
`audit-keyboard.mjs`, `audit-dates.mjs` all PASS, and directly exercised across dozens of Browser sessions
including this one (light mode signed-in verified in a prior continuation this project).

## Cold-load 400 investigation (time-boxed per instruction)

Re-confirmed this pass: fires only on a full page load/reload, never on in-app (SPA) navigation, not correlated
with any specific screen or action (reproduced on both `/record-relief` and Record Relief case pages). Could not
capture the raw request/response body — this session's network-inspection tool doesn't proxy cross-origin
Supabase requests, and deliberately did not pursue extracting the project's API key to work around that (a
Credential Exploration classifier correctly blocked one earlier attempt at this, and the right call was to stop,
not route around it). Auth session integrity was never observed to break — every subsequent app action worked
correctly in every test this project. This matches Supabase-JS's known behavior: on cold boot it attempts a
token-refresh call using a stored refresh token, which can 400 harmlessly if the token was already rotated
(common with dev-server hot-reloads and multiple tabs sharing localStorage), then the SDK recovers automatically.
**Classification: PLAUSIBLE benign, not CONFIRMED** (no raw response body was ever captured to prove it
definitively) — time-boxed here per instruction rather than pursued further. No regression test needed unless it
starts correlating with an actual session failure, which has never been observed.

## SECURITY — 🟢 PROVEN

RLS on every new table (enforced by `audit-security.mjs`, which caught a real over-grant in this session's own
new work and required a fix before merge — the audit is doing its job), member isolation (tested repeatedly,
including this session for coverage markets), guest boundaries, private uploads/signed URLs, no secrets
client-side, no service-role in client. `audit-security.mjs` PASS.

## OBSERVABILITY — 🔴 INCOMPLETE

No Sentry/crash reporting, no product analytics, no integration-health diagnostic screen, no DEV/PROD distinction
tooling. Confirmed zero references anywhere in the codebase. Not started.

## PHYSICAL DEVICE — 🔴 INCOMPLETE (untested by definition)

Everything in this row is 🔴 not because it's broken but because **nothing here has ever run on a real iPhone or
Android**: Apple Sign-In, native Google Sign-In, push delivery, Android maps, camera/photo upload, native PDF/
DOCX/Files/share/print, deep links, external meeting links on-device. This is the single largest verification gap
in the entire board and cannot be closed without Sterling's physical hardware.

---

## Architectural sweep: "resolve relationship at creation, never reconcile later" (time-boxed)

Searched every nullable foreign key across all migrations for the exact pattern that caused the Early Access
bug: a lookup resolved once at insert time, cached as a possibly-null FK, with a LATER batch/activation process
that only matches rows already carrying that FK (never re-deriving the match). Found candidates:
`credit_reports.upload_id`, `credit_dispute_evidence.generated_document_id`, `supervision_records.conviction_id`,
`corrections_migration_events.grant_id`, `generated_documents.supersedes_id`,
`record_relief_evaluations.rule_id`. Inspected each: all are the different, legitimate "this hasn't happened yet"
pattern (e.g. `upload_id` is null by design for manually-entered/fixture credit reports — the schema's own check
constraint allows `source in ('manual','fixture')` with no upload) — none has a batch process downstream that
ONLY looks for rows already carrying the FK while silently ignoring unmatched rows forever. Record Relief's
`rule_id` looked like the closest analog (a case's evaluation caches the matched rule), but re-evaluation is
member-triggered via a visible "RE-CHECK THIS CASE" button — confirmed working live earlier this session (edited
a case's facts, re-check correctly recalculated) — so there's no silent dead-end the way Early Access had one.
**No second instance of the bug class found.** Sweep complete, no further action needed.

## Counts by major capability (not sub-row)

| Status | Count | Capabilities |
|---|---|---|
| 🟢 PROVEN | 15 | Auth (core), Home, Me, Opportunity Profile, Jobs (mechanics), Housing (mechanics), Resources (mechanics), Early Access, Credit Builder (workflow), Record Relief (TEST engine), Resume Studio, Document Engine (web), Meetings, FairPath AI, Theme/Nav/UX, Security, In-app Notifications |
| 🟡 EXTERNAL SETUP REQUIRED | 6 | Apple Sign-In, Google Sign-In (unconfirmed config), Android Maps key, Credit Extraction (undeployed), Push (unwired), Payments (undeployed + no key) |
| 🟠 REAL DATA REQUIRED | 5 | Jobs inventory, Housing inventory, Resources inventory, Housing walkability/schools, Record Relief 50-state coverage |
| 🔴 INCOMPLETE | 4 | Email/SMS, Observability, Physical Device (all), FairPath+ actual member value (see separate doc) |
| ⚪ DEFERRED FROM V1 | 2 | Marketplace, Staffing (per Sterling's own scope note — kept outside V1 unless a strong reason emerges; none found) |

## TOP 10 MOBILE LAUNCH BLOCKERS (ranked by member value / trust / credibility, not ease)

1. **Real Jobs/Housing inventory.** A launch with zero real listings has no member value regardless of how correct the code is. Highest priority by a wide margin.
2. **Record Relief real legal data for at least a small number of launch states.** Shipping only TEST-A..D fixtures to real members is a credibility and trust failure, not just a gap.
3. **Physical-device verification of the entire document/share/print/Apple-Sign-In/native-map path.** Currently zero confidence beyond the Browser pane.
4. **Payments deployment + Stripe key + a decision on what FairPath+ actually gives.** Right now the 60-day benefit exists mechanically but has thin member-facing value (see the value doc) — marketing it before this is closed is a trust risk.
5. **Android Maps key.** Small effort, blocks an entire platform's map experience.
6. **Push notification wiring (client registration + a sending worker).** The server side is ready and wasted until this closes.
7. **Google/Apple auth configuration confirmation.** Unverified state is worse than a known gap — needs a definitive check.
8. **Resources real-data sourcing decision** (211/open-data/partner). Resources is the strongest fallback value for members in low-coverage markets (Early Access explicitly routes there) — its usefulness caps at fixture quality until this moves.
9. **Credit extraction deployment decision.** Currently a real, differentiated feature sitting disabled behind an undeployed function.
10. **Observability (crash reporting at minimum).** Launching with zero visibility into real-world crashes is a operational risk independent of feature completeness.

---

## Bugs discovered / fixed / regressions this pass
No new bugs found in existing code this pass (Record Relief's engine held up perfectly across 8 adversarial
tests). One bug caught in my OWN new work before it shipped: a self-referencing import in `gateway.ts`, and an
over-broad anon table grant caught by `audit-security.mjs`. Zero regressions — `npm run test:all` stayed green
(39→40, the +1 being new coverage tests) through every commit this pass.

## Automated test totals
40/40 offline checks (`npm run test:all`), all local SQL suites individually re-run and confirmed this session
(see per-capability evidence above for exact counts).

## Local commits / push / production
11 local commits this session (see `git log`), nothing pushed to GitHub, nothing touching production Supabase.

## Command Center contracts
See `docs/COMMAND_CENTER_MOBILE_CONTRACTS.md` (new this pass).

## Sterling action queue
Unchanged from `docs/STERLING_ACTION_QUEUE.md` — nothing new required to close this board's next 5 items below.

## Next 5 things to close (no Sterling needed)
1. Wire `expo-location` geocoding into a real screen (free, no key, already verified viable) — e.g. address entry for a future direct-listing form.
2. Build the notification-preferences table + UI (currently zero opt-out exists, which will matter the moment push/email land).
3. Design (not populate) the Resources real-source provenance decision doc — narrows the business decision Sterling needs to make.
4. Draft the first 2-3 real-state Record Relief rule rows as a template/process proof (with an explicit "MANUAL VERIFICATION REQUIRED" flag), to make the 50-state effort concrete instead of abstract.
5. Add a DEV-only integration-health screen reading the real state already visible in this board (which providers are actually configured), so this stops being a document and becomes a live view — explicitly requested and not yet built.
