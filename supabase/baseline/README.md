# Baseline bootstrap for `fairpath-mobile-dev`

`fairpath-mobile-dev` (ref `znvhmuhojvwvjzmaqwff`) starts EMPTY. Production
(`fairpath-mobile`, ref `rqpczemdagoddhuwefxt`) has 36 public tables that the app and the
Step 0/1 migrations depend on. This directory rebuilds that pre-existing schema in DEV
**without ever connecting this repo to production**, and without Docker.

## What exists

| File | What it is |
|---|---|
| `source/production_columns.csv` | Read-only export: 36 tables / 440 columns (types, nullability, defaults). |
| `source/production_constraints.csv` | Read-only export: PK/FK/UNIQUE names and columns (no CHECK expressions, no ON DELETE rules). |
| `generate-baseline-tables.mjs` | Deterministically writes `migrations/20260901000000_baseline_tables.sql` from the column export. **Done, committed.** |
| `export_prod_definitions.sql` | **One strictly read-only SELECT** for production: exact constraint definitions, RLS policies, RPC/function bodies, triggers, indexes, grants, storage buckets/policies, cron jobs. Returns one JSON cell. |
| `generate-baseline-logic.mjs` | Turns that export into `migrations/20260901000100_baseline_constraints_security_logic.sql`. |
| `fixtures/sample_definitions.json` | Synthetic (NOT production) fixture that regression-tests the generator in `npm run test:baseline`. |

## Why a second, definitions-based migration is required

The column/constraint exports are enough to create the tables, but NOT to reproduce production's
behavior: they omit CHECK expressions, `ON DELETE` rules, RLS policies, RPC bodies
(`submit_housing_application`, `quote_housing_fasttrack`, `marketplace_*`), triggers (e.g. the
auth.users profile trigger), grants, storage buckets and the pg_cron job. Guessing those would give
DEV a *different, probably weaker* security model than production and make QA meaningless. They
must be copied from production itself — read-only.

Step 1's own migrations also require primary keys on `public.profiles` and
`public.offense_catalog` (their foreign keys reference them), so the logic migration is a hard
prerequisite, not an optional extra.

## Migration order (Supabase CLI keys on the leading 14-digit version — all unique)

```
20260901000000_baseline_tables.sql                        tables + columns          (generated)
20260901000100_baseline_constraints_security_logic.sql    constraints/RLS/RPCs/...  (generated from export)
20260924140001_feature_flags.sql                          Step 0
20260924150002 … 20260924150010                           Step 1 (taxonomy … backfill)
```

## Runbook

### A. Export production definitions (READ-ONLY — the only manual data step)

1. Supabase dashboard → **fairpath-mobile** (production) → SQL Editor.
2. Paste the entire contents of `export_prod_definitions.sql` and Run. It is one `SELECT`; it
   creates and changes nothing and returns no user data.
3. Download the result as CSV and save it as
   `supabase/baseline/source/production_definitions.csv`.
   (If Postgres complains `relation "cron.job" does not exist`, delete the `'cron_jobs'` block and re-run.)

### B. Generate the logic migration (file-side, no database)

```bash
node supabase/baseline/generate-baseline-logic.mjs
npm run test:baseline        # verifies counts, guards, ordering, no drift
npm run typecheck
```

### C. Apply to DEV only (Sterling's terminal — the CLI is not available in the agent sandbox)

```bash
cat supabase/.temp/project-ref          # MUST print exactly: znvhmuhojvwvjzmaqwff   (STOP if not)
supabase migration list                 # DEV should show 0 remote; 13 local pending
supabase db push --dry-run              # lists what WOULD run; still nothing applied
supabase db push                        # applies baseline -> Step 0 -> Step 1 to DEV
supabase migration list                 # all 13 applied
```

Both baseline migrations **abort with an explicit error if `public.profiles` / `profiles_pkey`
already exist**, so they cannot run against production even by mistake. Never use
`supabase migration repair` against production.

### D. Point the app at DEV

Paste the `fairpath-mobile-dev` **anon/publishable** key into `.env.local`
(Project Settings → API; never the `service_role` key), then `npx expo start -c`.
In a dev build the app refuses to start without these variables and prints a loud console
error if it is ever pointed at production.

### E. Expected results on the empty DEV database

`20260924150010_backfill_canonical_profile.sql` prints all-zero counts (no rows yet) — that is
correct. To exercise the flows, create a test user through the app's sign-up screen against DEV.

## Known limits

* Seed/reference DATA (`offense_catalog` rows, `opportunity_sources`, jobs, listings) is not copied
  — only structure. Only non-secret boolean/number `app_config` values are exported.
* Column-level grants, database roles, publications and Realtime settings are not reproduced.
