# Supabase schema — source of truth

Two completely separate Supabase projects exist:

| Project | Ref | Role |
|---|---|---|
| `fairpath-mobile` | `rqpczemdagoddhuwefxt` | **PRODUCTION** — existing live data. Never migrated, pushed to, or repaired from this repo. |
| `fairpath-mobile-dev` | `znvhmuhojvwvjzmaqwff` | **DEVELOPMENT** — the only project this repo is linked to (`supabase/.temp/project-ref`, gitignored). |

## What's here

- `config.toml` — Supabase CLI config (labels, Postgres major version).
- `migrations/` — SQL migrations applied in version order. Every file MUST have a unique 14-digit
  version prefix (the CLI keys `schema_migrations` on it); `npm run test:baseline` enforces this.
  - `20260901000000_baseline_tables.sql` — production's 36 tables / 440 columns, **generated** from
    read-only exports. Refuses to run if `public.profiles` exists (so it can never run on production).
  - `20260901000100_baseline_constraints_security_logic.sql` — production's constraints, RLS,
    RPCs, triggers, storage and cron, **generated** from a read-only definitions export.
    *Pending that export — see `baseline/README.md`.*
  - `20260924140001_feature_flags.sql` — Step 0 `feature_flags`.
  - `20260924150002` … `20260924150010` — Step 1 canonical profile (taxonomy, profile columns,
    addresses, convictions, supervision/registration records, consent ledger, engine flag, backfill).
- `baseline/` — generators, sources and the runbook for bootstrapping the empty DEV database.
- `SCHEMA_INVENTORY.md` — original client-side reconciliation checklist (superseded by the baseline
  exports, kept for history).

## Runbook

See **`baseline/README.md`** for the exact, ordered procedure (export -> generate -> verify ->
`supabase db push` to DEV -> point Expo at DEV).

## Safety rules

1. Before ANY schema-mutating CLI command: `cat supabase/.temp/project-ref` must print
   `znvhmuhojvwvjzmaqwff`.
2. Never run `supabase link` to production from this repo; never `db push` or `migration repair`
   against production. Production promotion of Step 0/1 is a separate, explicit, reviewed future step.
3. In a development build the app refuses to start without `.env.local` (no silent fallback to
   production) and logs a loud error if pointed at production (`src/lib/supabase.ts`).
4. Never commit `supabase/.temp/`, `.env.local`, or a raw production dump.

## Types

Once DEV is fully migrated and linked: `npm run db:types` writes `src/core/supabase/database.types.ts`
from the **dev** schema.
