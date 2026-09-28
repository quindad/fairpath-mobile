# External integration register

Built from a real codebase scan (env vars, imports, config files), not guessed. DEV project only
(`znvhmuhojvwvjzmaqwff`). Every "CURRENT STATE" line below is something I verified by reading the actual code, not
an assumption. This is the audit requested before any new provider gets wired in.

Status legend used throughout: **CONNECTED** / **DEV FIXTURE** / **MOCK** / **DISABLED** / **KEY REQUIRED** /
**EXTERNAL CONFIGURATION REQUIRED** / **REAL DATA REQUIRED** / **PHYSICAL DEVICE REQUIRED**.

---

## 1. Payments — Stripe
- **Feature:** FairPath+ subscription, any paid flow.
- **Why needed:** only realistic way to take a card on file for a subscription.
- **Current state: KEY REQUIRED.** `payments-service.ts`, `PaymentsProvider.native.tsx`, `payment-sheet.native.ts`
  all read `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_APPLE_MERCHANT_ID` / `EXPO_PUBLIC_GOOGLE_PAY_ENABLED`.
  No `.env` file exists in the repo right now, so all three are unset — Stripe is entirely uninitialized, the
  provider renders with no key, and `isPaymentsEnabled()` returns false. This is not mocked; it's off.
- **Provider options:** Stripe (already coded against) vs. RevenueCat (subscription-management layer on top of
  Stripe/Apple/Google). Given FairPath+ is a simple recurring subscription with no complex entitlement logic yet,
  Stripe directly is the right call — RevenueCat adds a second vendor and cost for no real benefit at this stage.
- **Recommended:** Stripe, test mode first.
- **Free tier / cost:** no monthly fee; 2.9% + $0.30 per US card transaction. Free to create a test account.
- **API key required:** yes (publishable key client-side, secret key stays a Supabase Edge Function secret for any
  server-side calls, e.g. webhook handling — not yet built).
- **OAuth:** no. **Webhook:** yes, eventually, for subscription lifecycle (renewal, failure, cancellation) — not
  built yet; today there is no server-side listener for what Stripe reports.
- **Domain verification:** no. **Native config:** yes — Apple Pay needs a Merchant ID from Apple Developer before
  `APPLE_MERCHANT_ID` can be set (see `app.config.js` comment; setting it before the merchant ID exists breaks the
  iOS build).
- **DEV setup:** Stripe test-mode publishable key (`pk_test_...`) in `.env` as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Production setup:** separate live key, separate Apple Merchant ID, real webhook endpoint.
- **Privacy:** card data never touches FairPath's servers (Stripe PaymentSheet handles PCI scope).
- **What breaks without it:** FairPath+ cannot be purchased at all; today the checkout UI is real but the SDK has
  nothing to initialize against.
- **Sterling action required:** yes — queued below, priority 1.

## 2. Maps — Housing & Jobs location display
- **Feature:** map pins for job/housing search results.
- **Why needed:** members expect to see listings on a map, not just a list.
- **Current state: partially CONNECTED, KEY REQUIRED for Android.** Native builds (`JobMap.native.tsx`,
  `HousingMap.native.tsx`) use `react-native-maps`, a real map SDK — this is NOT mocked. On iOS it renders Apple's
  native map with zero extra configuration. On **Android**, `react-native-maps` requires a Google Maps API key in
  `app.json`/native config — I confirmed none is set anywhere in this repo, so an Android build today would show a
  blank gray map. Web (`HousingMap.tsx`/`JobMap.web.tsx`) intentionally has no interactive map — it's a coordinate-
  backed list instead, by design, not a bug.
- **Checked against the actual SDK 57 docs (per AGENTS.md), not assumed:** Expo SDK 57 introduced a new native
  `expo-maps` module. It looked like a candidate to replace `react-native-maps`, but two things rule that out right
  now: it's **alpha** (breaking-change risk), and — decisively — **it has no web support at all**, while FairPath's
  web build already ships a real, working map-adjacent experience (the coordinate list fallback) that a member can
  use today. Moving to `expo-maps` would regress web to nothing. Staying on `react-native-maps` for native plus the
  existing web fallback is the correct call, not a compromise.
- **Provider options:** Google Maps Platform (what `react-native-maps` already expects on Android) vs. Apple Maps
  (iOS only, already free/working) vs. Mapbox (would mean replacing `react-native-maps` entirely — not worth it,
  the current library already works on iOS).
- **Recommended:** Google Maps Platform, Android-only key. Keep `react-native-maps` as-is. Revisit `expo-maps` once
  it leaves alpha and adds web support, not before.
- **Free tier / cost:** Google Maps Platform gives $200/month free credit; map loads are billed per load beyond
  that. For DEV/testing volume this stays free.
- **API key required:** yes, Android only. **OAuth:** no. **Webhook:** no. **Domain verification:** no.
- **Native config:** yes — key goes in `app.json` under `android.config.googleMaps.apiKey`, requires a native
  rebuild.
- **DEV setup:** restrict the key to the DEV Android package name.
- **Production setup:** separate key restricted to the production package name/SHA-1 fingerprint.
- **Privacy:** no member PII sent to Google beyond map tile requests for a lat/lng already public in the listing.
- **What breaks without it:** Android map mode for jobs/housing (iOS and web are unaffected).
- **Sterling action required:** yes, but low priority — only blocks Android device QA, not iOS or web.

## 2a. Geocoding / reverse geocoding — no new vendor needed
Checked against SDK 57 docs directly: `expo-location`'s `Location.geocodeAsync()` / `reverseGeocodeAsync()` are real,
supported on iOS, Android, **and web**, and require no API key or account — they use the OS's own geocoder (Apple/
Google on native, a browser-appropriate provider on web via Expo's implementation). **Current state: NOT WIRED IN**
(no import of `expo-location` anywhere in `src/`), but this is a zero-cost, zero-signup unlock whenever an address→
lat/lng step is needed (e.g., a future direct-listing submission flow for jobs/housing). Note Expo's own caution:
geocoding is rate-limited per-device and should not be called in a tight loop or in the background. No Sterling
action needed — this is implementation work, not a credential.

## 3. Walkability / neighborhood data (Housing)
- **Feature:** Sterling explicitly wants real walkability/transit/school-proximity context on housing listings.
- **Correction to an earlier version of this register:** I initially wrote this as "NOT STARTED, zero matches
  anywhere in the codebase" — that was wrong. I had grepped for provider API call names and missed the schema/UI,
  which already exist and are further along than I first reported.
- **Current state: SCHEMA + UI BUILT, PROVIDER NOT CONNECTED.** `housing_listings` already has `walk_score`,
  `transit_score`, `bike_score`, and `neighborhood_data_provider` columns (baseline schema,
  `20260901000000_baseline_tables.sql`), plus dedicated `housing_schools` and `housing_nearby_places` tables with
  per-row `provider` / `provider_school_id` / `distance_miles` / `sort_order` provenance columns. The Home Details
  screen (`src/app/housing/[id].tsx:137-159`) already renders all of this correctly: an "AROUND THIS HOME" section
  with WALK/TRANSIT/BIKE score tiles and a "Mobility scores are shown only when verified provider data is
  available. Source: X." note, plus "SCHOOLS NEARBY" and "NEARBY" sections that only render when data exists —
  exactly the graceful-empty-state discipline requested, already built. The DEV seed (`supabase/seed/build-
  inventory.mjs:288`) deliberately leaves these columns NULL with an explicit comment: "no fabricated provider
  data." So every listing today correctly shows nothing in that section — not broken, not fake, just unconnected.
- **What this changes about the work ahead:** no schema or UI work is needed to add a provider. Connecting one is
  an ingestion task — a job that, per listing address, calls the provider and writes `walk_score` /
  `transit_score` / `bike_score` / `neighborhood_data_provider` and rows into `housing_schools` /
  `housing_nearby_places` — not a product-design task.
- **Provider options:**
  - **Walk Score API** — the de facto standard (walkscore.com/professional/api). Requires an API key application
    (they review commercial use); pricing is quote-based for apps at scale, but a low-volume/dev key is often
    free or cheap on request.
    - **Transit Score** and **Bike Score** are bundled with the same Walk Score API key.
  - **Google Places API (Nearby Search)** — could approximate "schools nearby" / "transit nearby" without needing
    Walk Score's licensing, using the same Google Maps Platform account from item 2. Does not give a single
    "walkability score" the way Walk Score does.
  - **GreatSchools API** — real school-proximity/rating data, separate from Walk Score, has its own licensing terms.
- **Recommended:** apply for a Walk Score API key first, since it directly gives the number Sterling described
  (walk/transit/bike score in one call). Layer in Google Places "nearby" for schools/transit only if Walk Score's
  transit data proves too sparse for FairPath's markets.
- **Free tier / cost:** Walk Score's public rate-limited key is free for low volume; commercial/app use needs their
  paid tier once FairPath has real traffic — cost is quote-based, ask when applying.
- **API key required:** yes. **OAuth:** no. **Webhook:** no. **Domain verification:** sometimes required as part
  of their application review.
- **DEV setup:** dev key, cached per-address to stay under rate limits.
- **Production setup:** separate production key once volume is real.
- **Privacy:** only a listing's public address/lat-lng is sent, no member data.
- **What breaks without it:** nothing breaks — the housing UI currently has no walkability section to break. This
  is new work, not a broken feature.
- **Sterling action required:** yes — apply for a Walk Score API key. Queued below.

## 4. Authentication — Google Sign-In
- **Feature:** social sign-in.
- **Current state: CONNECTED, EXTERNAL CONFIGURATION REQUIRED to confirm.** `social-auth.ts` calls
  `supabase.auth.signInWithOAuth({ provider: 'google', ... })` through Supabase Auth — this is real code, not a
  stub, and it was never actually exercised signed-in this session (no Google test account was driven through it
  in the Browser pane). Whether it fully works depends on whether a Google OAuth client is configured in the
  Supabase Auth dashboard for the DEV project, which I cannot see or change from here.
- **Provider options:** none — Supabase Auth's Google provider is already the integration; no code change needed,
  only dashboard configuration.
- **Cost:** free (Google Cloud OAuth consent screen + client ID, no billing required for sign-in).
- **API key required:** OAuth client ID/secret, not an API key. **OAuth:** yes. **Domain verification:** yes, for
  the OAuth consent screen once it needs to go beyond "Testing" publish status.
- **DEV setup:** OAuth client configured in Supabase's Auth → Providers → Google, redirect URI matching
  `expo-linking`'s `auth/callback` scheme.
- **Production setup:** separate OAuth client (or the same one moved to "Production" publish status) + real domain
  on the consent screen.
- **What breaks without it:** the Google sign-in button is tappable and reaches Supabase, but Supabase will reject
  it with "provider is not enabled" (a message the code already handles gracefully — `friendlyProviderError`).
- **Sterling action required:** yes if not already configured in the DEV Supabase project — I cannot check the
  dashboard from here. Queued below as a verification step, not a full setup (may already be done).

## 5. Authentication — Apple Sign-In
- **Current state: CODED, PHYSICAL DEVICE REQUIRED, EXTERNAL CONFIGURATION REQUIRED.** Unchanged from prior
  sessions — see `EXTERNAL_SETUP_CHECKLIST.md` section 2. Needs an Apple Developer "Sign In with Apple" capability,
  the Supabase Apple provider configured, and a dev-client rebuild (native module `expo-apple-authentication`).
  Cannot be tested in the Browser pane at all (`isAppleSignInAvailable()` returns false off iOS).
- **What breaks without it:** nothing on Android/web/Browser QA; iOS members simply won't see a working Apple
  button until this is done.
- **Sterling action required:** yes — unchanged, already queued in `STERLING_ACTION_QUEUE.md`.

## 6. Documents — PDF / DOCX / CSV / ZIP / Share / Print
- **Current state: CONNECTED.** Real, no external provider needed — `pdf-lib`, `docx`, and native `expo-print`/
  `expo-sharing`/`expo-file-system` are all real libraries, already fixed this session (the Metro/tslib bug) and
  verified live end to end on web. Native share/print/Save-to-Files is real code but PHYSICAL DEVICE REQUIRED to
  prove (Browser pane can't exercise the OS share sheet).
- **What breaks without it:** nothing — this is done. Listed here only because it was in Sterling's audit list.
- **Sterling action required:** physical-device pass only (already queued).

## 7. Credit Builder — report upload & automatic reading
- **Feature:** OCR/extraction of a member's uploaded credit report PDF/image into structured line items.
- **Current state: DISABLED, KEY REQUIRED.** Fully built (`extract-credit-report` Edge Function,
  `src/core/credit/extraction.ts` validator: last-4-only, no invention, gaps flagged, consent-gated client flow) but
  gated behind `CREDIT_EXTRACTION_ENABLED=true` + an `ANTHROPIC_API_KEY` function secret, neither of which is set.
  Calling it today returns `extraction_not_enabled` and the UI explains that honestly in place — this is not a
  mock, it's a real feature with its power switch off pending Sterling's provider decision.
- **Provider options:** Anthropic (already coded against, has native PDF/image understanding) vs. a dedicated
  document-OCR vendor (AWS Textract, Google Document AI) tuned for structured financial-document extraction.
- **Recommended:** keep Anthropic for now — the extraction code is already written and tested offline against it;
  a dedicated OCR vendor would mean rewriting the extraction/validation layer for marginal accuracy gain at this
  stage.
- **Free tier / cost:** no free tier; pay-per-token. A credit report is a few pages of text/image — cost per
  extraction is small (low cents), but scales with volume.
- **API key required:** yes (`ANTHROPIC_API_KEY` as a Supabase function secret — never in client code).
- **OAuth/webhook/domain verification:** none needed.
- **DEV setup:** set both secrets, `npx supabase functions deploy extract-credit-report --project-ref znvhmuhojvwvjzmaqwff`.
- **Production setup:** separate key recommended for spend isolation/rate limiting, same deploy step.
- **Privacy/consent:** member must explicitly tap "READ AUTOMATICALLY" per upload (already built); this sends a
  government-adjacent financial document to a third-party model provider — Sterling should treat this as a real
  privacy decision, not a technical checkbox. This is item 2 in the existing action queue, unchanged.
- **What breaks without it:** nothing breaks — uploads still work and store privately; only the "read it for me"
  convenience is off.
- **Sterling action required:** yes — decision + secrets, already queued.

## 8. Record Relief — statutes, court forms, government sources
- **Current state: DEV FIXTURE (TEST-A..D + 2 federal TEST pathways), REAL DATA REQUIRED for all 50 states + DC +
  federal.** The rules ENGINE (waiting periods, exclusions, countdowns, document generation, packet building) is
  real and was proven correct against TEST-A..D this session. Zero real jurisdictions have verified rules loaded —
  this was always the plan, not a gap introduced now. This is the single largest content/data undertaking in the
  whole platform and is addressed in its own section below (§13, coverage matrix).
- **Sterling action required:** none yet — this is a content-sourcing project, not an API key. See §13.

## 9. Meetings — video
- **Current state: CONNECTED as a link model, DISABLED as native video.** `meetings-service.ts` stores an
  external `meeting_link` (Zoom/Meet/Teams URL the caseworker provides) and opens it via the device's browser/app —
  this is real and complete for what it claims to be. There is no native in-app video (no Zoom SDK, no Daily.co, no
  Twilio Video import anywhere in the codebase). Building native video would be a major SDK integration
  (Zoom Video SDK or Daily.co are the realistic options) — not recommended until there's a concrete reason the
  link model is insufficient, since it works today with zero vendor cost.
- **Sterling action required:** none — flagging as NOT STARTED by design, not a bug.

## 10. Push notifications / Email / SMS
- **Current state: NOT STARTED, all three.** Confirmed zero references to `expo-notifications`, any push token
  registration, any transactional-email vendor (Resend, SendGrid, Postmark), or any SMS vendor (Twilio) anywhere in
  `src/` or `supabase/`. FairPath's current "reminders" feature (`member_reminders`) is in-app only — it has no
  delivery channel outside the app itself.
- **Provider recommendations:**
  - **Push:** Expo push notifications (`expo-notifications` + Expo's push service) — zero extra vendor, works with
    the existing Expo/EAS setup, free.
  - **Email:** Resend — simplest transactional-email API, generous free tier (3,000 emails/month), good for
    password-reset/status-change emails. (Supabase Auth already sends its own password-reset emails through its
    built-in SMTP by default; a dedicated provider matters once FairPath sends its own transactional emails beyond
    auth, e.g. "your application status changed.")
  - **SMS:** Twilio — only justified for the PO/parole-compliance reminder fallback Sterling and I discussed
    conversationally; not needed for anything built today. Real per-message cost (~$0.0079/SMS in the US), no free
    tier beyond a small trial credit.
- **What breaks without them:** nothing today — no feature currently promises a push/email/SMS delivery it isn't
  giving. This is future work, correctly not yet started rather than mocked.
- **Sterling action required:** none yet — queued for when a specific feature (e.g. application-status push) is
  actually being built.

## 11. Jobs / Housing / Resources inventory
- **Current state: DEV FIXTURE for listings; a real, unused provenance/ingestion SCHEMA already exists.** This is
  a correction to an earlier version of this register, which said the provenance architecture was "not yet built" —
  it already is, at the schema level, and I missed it on the first pass. `20260901000000_baseline_tables.sql`
  already defines a complete ingestion pipeline: `opportunity_sources` (provider_key, status
  `planned`/presumably `active` etc., `ingestion_mode`, `terms_url`, `attribution_required`,
  `ai_processing_allowed`, `configuration` jsonb, `last_sync_at`), `external_opportunities` (per-source external
  ID, canonical URL, raw + normalized payload, content hash for change detection, `first_seen_at`/`last_seen_at`,
  `expires_at`, `active`), `opportunity_evidence` (why a listing was tagged a certain way — `evidence_type`,
  `evidence_source`, `confidence`, `machine_extracted`, `reviewed_at`), and `opportunity_ingestion_runs` (per-run
  fetched/created/updated/error counts). Both `jobs` and `housing_listings` already have `source_id` and
  `external_opportunity_id` foreign keys wired to this pipeline.
  **But it is completely dormant**: confirmed by searching the entire codebase — zero TypeScript/JS files
  reference `external_opportunities`, `opportunity_sources`, `opportunity_evidence`, or
  `opportunity_ingestion_runs` anywhere. `external_opportunities` is even locked down with
  `revoke all ... from anon, authenticated, service_role` at the RLS layer beyond a narrow read policy, meaning
  nothing can write to it today without a new migration reopening it for a specific ingestion job. DEV seed data
  bypasses this pipeline entirely, inserting directly into `jobs`/`housing_listings` with only a free-text
  `source_label` (e.g. "FairPath DEV Seed") — not linked via `source_id`.
- **What this means for real-data work:** the hard schema-design problem Sterling asked me to solve in this pass
  is already solved by whoever built the baseline. The actual remaining work is: (1) insert real `opportunity_sources`
  rows for each real source once one is chosen (direct employer postings, a permitted feed, etc.), (2) write an
  ingestion job/Edge Function that fetches from that source, upserts into `external_opportunities`, and
  projects into `jobs`/`housing_listings` with `source_id`/`external_opportunity_id` set, and (3) reopen
  `external_opportunities`' RLS for that job's service-role writes. This is meaningfully less work than designing
  provenance from scratch, and should be corrected in planning accordingly.
- **Resources has no equivalent dormant schema** — its provenance model (published/verified/fresh/stale/expired,
  verification history) is real and already in active use (built and verified in a prior session), which is
  different from Jobs/Housing's unused pipeline.
- **Real-data path for each (architecture, not yet built):**
  - **Jobs:** direct FairPath employer postings (an employer-facing submission flow, not built) is the right first
    source — no licensing risk, no scraping. ATS integrations (Greenhouse, Lever) are a plausible phase 2 once
    there are enough direct employer partners to justify it.
  - **Housing:** direct landlord/property-manager listings (same reasoning as jobs) is the only source that avoids
    MLS/IDX licensing complexity entirely, and matches FairPath's actual value prop (second-chance-friendly
    landlords opting in), not general rental inventory.
  - **Resources:** a blend of FairPath-verified entries (manual, high-trust) plus 211/government open-data feeds
    where a jurisdiction publishes one under permissive terms — verified before publishing, never auto-published
    from a scrape.
  - All three need a provenance model (source, source id, last sync, last verified, expiry, who verified, can
    FairPath republish) — this does not exist in the schema today and is real infrastructure work, addressed in
    §14 below alongside the Early Access/waitlist build.
- **Sterling action required:** none yet — this is a data-partnership/business decision (who FairPath's first
  direct employer/landlord partners are), not a technical unblock.

## 12. Analytics / monitoring
- **Current state: NOT STARTED.** No Sentry, no PostHog/Amplitude/Mixpanel, no uptime monitor anywhere in the repo.
- **Recommended:** Sentry for crash/error monitoring (free tier covers DEV-scale volume, has a first-class Expo
  SDK) before any product analytics vendor — knowing when the app crashes matters more pre-launch than usage
  funnels.
- **Sterling action required:** none yet, low priority until closer to a real release.

---

## 13. Record Relief real-data coverage matrix (starting point)

Every jurisdiction will land in one of these states. Right now, all 50 states + DC + territories are **NOT STARTED**
except the 4 fictional TEST fixtures. This matrix is the tracking mechanism going forward, not a claim that any
real jurisdiction is ready — none are.

| Status | Meaning |
|---|---|
| READY | rule data verified against a primary source, reviewed, in production schema |
| SOURCE IDENTIFIED | know which statute/court/agency publishes this, not yet ingested |
| MANUAL VERIFICATION REQUIRED | drafted from a source, needs a second human check before READY |
| FORM SOURCE FOUND | know where the official court form lives, not yet linked |
| NEEDS REVIEW | flagged as possibly stale/ambiguous, needs a fresh look |
| NOT STARTED | nothing done |

This matrix will be tracked as data (a table or a generated doc from the `record_relief_jurisdictions` /
`record_relief_rule_versions` schema), not maintained by hand in markdown once it has more than a handful of rows —
flagging that now so it isn't rebuilt twice.

## 14. Early Access / waitlist / market-coverage — status

**NOT STARTED.** No `coverage_market`, no waitlist table, no entitlement-grant schema, no Early Access screens
exist in the codebase today. This is real, scoped product work (data model + screens + server-side entitlement
grant), not a config/API-key item, so it's tracked as its own workstream rather than folded into this register.
It will be built and driven live in the Browser pane per Sterling's instruction, with an honest
BUILT / PARTIALLY BUILT / PLANNED / NOT BUILT matrix for FairPath+ before any "60 days free" copy ships anywhere.

---

## Summary: what actually needs a key/account from Sterling right now

1. Stripe test-mode account (§1) — unblocks FairPath+ checkout testing.
2. Confirm Google OAuth provider status in DEV Supabase dashboard (§4) — may already be done, needs checking.
3. Walk Score API application (§3) — unblocks real walkability data (net-new feature, nothing broken today).
4. Google Maps Platform key, Android only (§2) — unblocks Android map QA (iOS/web unaffected either way).
5. Apple Developer + Supabase Apple provider (§5) — unchanged, already queued, physical-device gated.

Everything else in this register is either already working, correctly not-yet-started, or blocked on a business/
content decision rather than a credential. Full step-by-step setup instructions for the above, one at a time, are
in `docs/STERLING_INTEGRATION_SETUP.md`.
