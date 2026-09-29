# Jobs real-inventory pipeline — what exists today vs. what's needed

Built from reading `jobs`, `search_jobs()`, the RLS policies, and the dormant `opportunity_sources`/
`external_opportunities` pipeline directly. No provider invented.

## Can we ingest CSV today? No — no CSV import path exists anywhere in the codebase.

## Can we ingest partner API data today? No, but the schema is ready for it.
`opportunity_sources` (provider_key, `ingestion_mode` check constraint already allows `'api'|'feed'|'webhook'|
'partner_direct'|'manual'`, `configuration` jsonb, `last_sync_at`) and `external_opportunities`
(`(source_id, external_id)` UNIQUE, `raw_payload`/`normalized_payload`, `first_seen_at`/`last_seen_at`/
`expires_at`/`active`) already model exactly this — confirmed dormant (zero code references either table) and
fully locked down (`revoke all ... from anon, authenticated, service_role` plus an explicit `using (false)` RLS
policy, so even service_role needs an explicit future grant to write to it). Building a real feed importer means:
writing a new Edge Function or script that (1) fetches from the source, (2) upserts into `external_opportunities`
on `(source_id, external_id)`, (3) projects into `jobs` with `source_id`/`external_opportunity_id` set. No schema
changes needed — this is implementation work against an existing, unused design.

## Can employers create jobs directly? Yes, today, for real.
`jobs.employer_id` is a real FK to `auth.users(id)`, and RLS policies "Employers create/update/delete own jobs"
already let any authenticated user insert/edit rows where `employer_id = auth.uid()`. **The gap is entirely UI +
identity/verification** — no screen exists for a member to become an "employer" and post a job, and there's no
concept of a verified business identity distinct from a bare signed-in account. The backend permission model is
already correct and tested (RLS enforced, not app-code enforced).

## How is ownership assigned? `employer_id = auth.uid()` at insert time, enforced by RLS `with check`, not
application code — a member cannot insert a job claiming a different employer_id even if the client tried.

## How are duplicates prevented?
- **Direct postings:** not applicable — one employer, one posting, no duplicate concept needed.
- **Feed-sourced (once built):** `external_opportunities(source_id, external_id)` UNIQUE constraint already
  exists — a reimport of the same external listing upserts the same row rather than creating a duplicate.

## What happens when jobs expire? **Already fully automatic, no batch job needed.**
`search_jobs()` filters `j.status = 'published' and (j.expires_at is null or j.expires_at > now())` at query
time (confirmed by reading the function directly) — an expired job simply stops appearing in results the instant
`expires_at` passes, with zero cron/scheduled job required. `jobs.status` already supports `'expired'`/`'closed'`/
`'filled'` as explicit terminal states for cases where a job should be marked done rather than just time-expiring.

## How do we deactivate stale listings? Set `status` to `'paused'` (temporary) or `'closed'`/`'expired'`/
`'filled'` (terminal) — the enum already distinguishes reversible-pause from permanent-end states. No tooling
exists yet to DO this (no employer UI, no admin bulk action), but the data model already supports it correctly.

## What fields are required? `employer_id`, `title`, `company_name` are `not null` at the schema level with no
default worth relying on; everything else (pay, benefits, skills, description) is optional at the DB layer —
worth an application-level minimum-quality bar (e.g. require a description length) before a real launch, since the
schema alone would accept a nearly-empty posting.

## What validation exists? Schema-level: `status`/`workplace_type`/`employment_type` are constrained enums (real
CHECK constraints, confirmed). No range validation on `pay_min < pay_max`, no URL format validation on
`external_apply_url`/`company_website_url` — worth adding at either the DB or an insert-time RPC layer before
real employer self-service opens up, since RLS alone doesn't validate data QUALITY, only data OWNERSHIP.

## What location/geocoding assumptions exist?
`jobs.latitude`/`longitude`/`location_precision` exist as real columns, populated by DEV seed data directly (not
computed at read time). `search_jobs()`'s distance calculation assumes these are already correct at write time —
there is no on-read geocoding fallback. This means a real employer-posting flow MUST geocode the entered address
before insert (using the already-verified-viable `expo-location` `geocodeAsync`, free, no key — see the earlier
integration register finding) rather than leaving lat/lng null and hoping distance search still works (it
wouldn't — a null-coordinate job simply can't be distance-sorted, though it can still be found by keyword/ZIP
text match per `search_jobs`'s WHERE clause).

## What would a national ingestion pipeline need?
1. A real employer self-service posting flow (UI + a minimal identity/verification step) — the highest-leverage
   first step given the backend is ready.
2. Geocoding at post-time (free, already verified viable, not wired in).
3. A quality-gate (minimum description length, valid pay range) before a posting can reach `status = 'published'`
   — currently nothing stops a nearly-empty posting from publishing.
4. Only once direct postings prove insufficient volume: an ATS/feed integration using the existing dormant
   pipeline, with an explicit licensing check per source before any code is written against it.

## What belongs in Mobile vs. Partner/Admin?
**Mobile:** searching/applying (already built, already proven this session). **Partner:** the employer-posting
flow itself, application review (background functions already exist: "Employers read/update applications for own
jobs" RLS, confirmed working). **Admin:** feed health monitoring (`opportunity_ingestion_runs`, schema-ready),
quality-gate override, employer identity verification.
