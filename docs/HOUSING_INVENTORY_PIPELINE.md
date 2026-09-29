# Housing real-inventory pipeline — what exists today vs. what's needed

## Ownership — same working foundation as Jobs
`housing_listings.owner_id` is a real FK to `auth.users(id)`, with working owner-scoped RLS ("Owners create/
update/delete housing", confirmed this session). Same gap as Jobs: backend ready, no UI, no landlord identity
verification concept.

## Listing fields present: availability, rent/deposit, beds/baths, amenities, coordinates — all real
`available_date`, `rent_monthly` (implied from usage this session), `deposit_amount`, `bedrooms`/`bathrooms`,
`garage_spaces`/`parking_types`/`furnished`/`has_basement`/`has_yard`/`has_balcony_patio`/`laundry_type`/
`has_central_air`, `latitude`/`longitude`, and the neighborhood-intelligence columns (`walk_score`/
`transit_score`/`bike_score`/`neighborhood_data_provider`) all confirmed present in `housing_listings` directly
(baseline schema). `housing_schools`/`housing_nearby_places` are separate related tables with their own
provenance columns (`provider`, `distance_miles`, `sort_order`).

## REAL GAP FOUND THIS PASS: Housing has no expiration concept at all.
Jobs' `search_jobs()` filters `expires_at is null or expires_at > now()` — a time-based, automatic expiration.
**`housing_listings` has no `expires_at` column, and `search_housing()`'s WHERE clause only filters
`status = 'published'`** (confirmed by reading both the schema and the search function directly). This means a
real housing listing, once published, stays visible FOREVER until a human manually sets it to `paused`/`leased`
— there is no automatic staleness handling at all for Housing, unlike Jobs. For a real launch, this needs either
(a) an `expires_at` column + the same query-time filter Jobs already uses (the cheaper, proven-pattern fix), or
(b) a "last confirmed available" re-verification cadence enforced by a future landlord-facing reminder + Admin
staleness view. Recommendation: do (a) first (matches Jobs' existing pattern, minimal schema change), consider
(b) as a real-data-operations refinement once landlords are actually using the platform.

## Standard vs. FastTrack application types — real, already built and tested this project
`housing_listings.fasttrack_enabled` gates whether FastTrack is offered; `housing_applications.application_type`
distinguishes the two paths. Required-document enforcement (confirmed genuinely blocking submission in prior
session testing) applies to both.

## CRITICAL PRODUCT RULE, checked against the actual code: does a listing existing imply justice-friendliness?
**No inference exists anywhere in the housing search/display code** — `search_housing()` and the listing detail
screen (`housing/[id].tsx`, read this session for the walkability finding) never derive or display a "felony-
friendly" claim from the mere existence of a listing. There is currently no explicit justice-friendliness field on
`housing_listings` at all (unlike Jobs, which has `eligibility_rules jsonb` with a `second_chance_evidence`
concept referenced in `find-jobs.tsx`'s "VERIFIED SECOND-CHANCE" badge). **This is a real gap to close before
housing partners are onboarded**: Housing needs its own equivalent explicit field (e.g.
`second_chance_policy: 'unknown' | 'landlord_asserted' | 'fairpath_verified'`), because without one, a future
"felony-friendly" badge on a housing listing would have nothing honest to point to — it would have to either omit
the badge entirely (safe, but a missed product opportunity Sterling clearly wants) or, worse, someone could add it
based on listing existence alone (exactly the collapse Sterling explicitly warned against). **Recommendation:
add this field before any Housing partner or filter badge implies justice-friendliness in any way** — currently
nothing does, which is the safe state, but it's fragile: nothing in the schema stops a future screen from adding
a misleading badge, since there's no dedicated column making the distinction structurally explicit.

## Fraud/moderation concerns
`housing_reports` exists (member-reported issues against a listing), confirmed real. No automated fraud detection
exists — purely member-report-driven, same maturity level as Jobs (no automated content moderation for either).

## Should a listing ever automatically become public? Today: yes, immediately, the moment `status = 'published'`
is set — there is no draft-review-approve gate before a landlord's own listing goes live (matches the "Owners
create own housing" RLS: an insert can go straight to `published` status without any second-party check). Worth
an explicit product decision before opening self-service: should a NEW landlord's first listing require Admin
review before publishing, given housing scams are a known adjacent risk? Currently nothing in the schema forces
that gate — it's a pure business/product decision, flagged here rather than assumed either way.

## What a national Housing ingestion pipeline needs (same shape as Jobs)
1. Landlord self-service listing flow (backend ready, UI missing).
2. Geocoding at post-time (same `expo-location`, free, no key — not wired in).
3. The missing `expires_at`/staleness mechanism (see above — the single most concrete gap found this pass).
4. An explicit justice-friendliness field before any related UI badge ships.
5. A first-listing review gate — a decision to make, not yet built either way.

## What belongs in Mobile vs. Partner/Admin?
**Mobile:** search/apply (built, proven). **Partner:** listing creation/management, application review
(`partner_acknowledge_housing_inquiry`/`partner_reply_housing_inquiry` already exist server-side for inquiries —
the most partner-ready workflow in the whole Housing/Jobs pair). **Admin:** staleness monitoring (once built),
fraud/report review, first-listing approval (if that gate is adopted).
