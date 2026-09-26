# DEV inventory seed (fairpath-mobile-dev only)

Makes the DEV database feel like a real nationwide product so the existing app can be tested on
physical devices: **109 jobs, 70 housing listings (318 photos), 236 test offense-catalog entries,
35 test employer/property-manager accounts**, across 28 markets in 18 states.

**Production is unreachable from this tooling.** The runner refuses any URL, linked project or key that is not
the DEV project (`znvhmuhojvwvjzmaqwff`).

## What gets created

| Data | Count | Notes |
|---|---|---|
| Auth accounts | 35 | 25 employers + 10 property managers via the **Auth Admin API**. No passwords — nobody can sign in as them. `handle_new_user` creates their profiles. Emails: `seed-…@dev-seed.fairpath.test` (reserved TLD). |
| `jobs` | 109 | 12 industries, 18 states, onsite/hybrid/remote, hourly + salary, full/part-time/contract/gig, mixed second-chance policies, Easy Apply + external apply, employer questions. |
| `housing_listings` | 70 | Apartments, studios, houses, duplexes, townhomes, condos, rooms; 0–5 BR; garages, yards, pets, varied deposits/fees/documents; 32 FastTrack. |
| `housing_media` | 318 | 3–6 photos per listing. |
| `offense_catalog` | 236 | Generic TEST entries with `DEV-` codes across all 9 taxonomy categories. Never marked verified. |
| `feature_flags` | 5 | Insert-if-missing only. `justice_eligibility_engine_enabled` stays `false`. |

**Focus markets:** Cleveland (14 jobs / 8 listings), Columbus (14 / 8), Washington DC + Maryland + Northern Virginia (22 / 15).
**Other markets** (radius/location testing): Pittsburgh, Philadelphia, Cincinnati, Detroit, Chicago, Indianapolis, Atlanta, Charlotte,
Houston, Dallas, Nashville, Louisville, Phoenix, Denver, Seattle, Los Angeles, Oakland, Miami, Orlando, Memphis, Milwaukee.

## It is clearly test data

Company/owner names contain "Demo"; job and listing descriptions end with a "DEV test" line; listing addresses start with `[TEST]`;
`source_label` is `FairPath DEV Seed`; external links point at `example.com`. Nothing impersonates a real employer, landlord or property.

**Deliberately NOT seeded:** walk/transit/bike scores, schools and nearby places — FairPath does not fabricate provider data, so those
sections keep showing their honest empty states. Coordinates are approximate (city center + a stable per-ZIP offset): fine for pins and
10–100 mile radius tests, not for geocoding accuracy.

## Why an Auth step is needed

`jobs.employer_id` and `housing_listings.owner_id` are **NOT NULL foreign keys to `auth.users`** (`ON DELETE CASCADE`). The FK is neither
weakened nor faked: real accounts are created through Supabase's Auth Admin API, which requires the DEV **service-role (secret) key**.
That key is read **only from the shell environment variable** `SUPABASE_SERVICE_ROLE_KEY` — never from a file, never printed, never committed.

## Run it (the one manual step)

```powershell
cat supabase/.temp/project-ref                     # must print znvhmuhojvwvjzmaqwff
npm run seed:dev:dry                               # optional: offline preview, validates against the production schema

# Supabase dashboard -> fairpath-mobile-dev -> Project Settings -> API -> service_role / secret key
$env:SUPABASE_SERVICE_ROLE_KEY = "<paste the DEV service_role key>"
npm run seed:dev                                   # creates accounts + upserts inventory (idempotent)
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY          # then close the shell
```

Then pull-to-refresh / reopen the app on the phones.

* **Refresh dates:** posting/expiry dates are relative to *now*; re-run `npm run seed:dev` to refresh them. Jobs expire via the hourly pg_cron job.
* **Reset inventory:** `npm run seed:dev:reset` deletes only rows whose `source_label` is `FairPath DEV Seed` (jobs, listings + media) and the test offenses.
  Applications that testers submitted to seed jobs are removed with them if the FK cascades.
* **Reset accounts too:** `node scripts/seed-dev.mjs --reset --reset-users --confirm-dev` (only `seed-employer-*` / `seed-owner-*` test accounts; cascades their inventory).

## Safety guarantees (enforced by `npm run test:seed`)

* Refuses production URL/ref, a CLI link that isn't DEV, a missing `--confirm-dev`, a missing key, publishable/anon keys, and a `service_role` key issued for another project.
* Dry run is the default and makes no network calls.
* Every row is validated offline against the real production schema (columns, NOT NULL, types, CHECK enumerations) before anything is written.
* Deterministic (fixed seed, UUIDv5 ids): same input, same rows; re-running never duplicates.
* Reset can only delete rows labelled as seed data.

## Files

`supabase/seed/build-inventory.mjs` (generator) · `data/` (markets, accounts, job templates, housing pools, offenses) ·
`lib/` (rng, uuid, guards) · `validate.mjs` · `scripts/seed-dev.mjs` (runner) · `scripts/audit-seed.mjs` (tests).
