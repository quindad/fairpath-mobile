# DEV migration history mismatch (2026-10-26)

Project: `znvhmuhojvwvjzmaqwff` (DEV only).

## Symptom

`supabase db push --linked` can fail with `DbPushMissingLocalError` when remote `supabase_migrations.schema_migrations` contains versions that do not exist under `supabase/migrations/` in this repo.

## What we verified

`npx supabase migration list --linked` shows:

- **Remote-only** rows (remote version set, local empty): many timestamps from `20261007233711` through `20261021205913`, plus gaps around `20261008460000`–`20261008510000`, `20261015032752`, etc. These were applied on DEV outside this git tree (dashboard SQL, one-off fixes, or another branch).
- **Local-only** rows (local set, remote empty): includes `20261008222300`, `20261008222400`, `20261008520000`–`20261008590000`, `20261009010000`–`20261009080000`, `20261014000000`–`20261014020000`, `20261017193000`–`20261017202000`, and draft-adjacent work not yet pushed.

## Safe reconciliation (not executed blindly)

1. **Do not** `migration repair --status reverted` on remote-only versions without comparing live schema to expected objects (RPCs, tables, RLS).
2. **Do not** reset DEV.
3. **Preferred path:** export remote migration names + `pg_dump --schema-only` diff against local PGlite apply of all local files; for each remote-only version, either add a matching local placeholder migration (no-op or idempotent `IF NOT EXISTS`) **or** mark as reverted only when schema already matches repo head.
4. **Local-only** migrations: apply individually via reviewed `supabase migration up` only after remote history is aligned, or use idempotent SQL in dashboard with a new canonical local file that matches what was applied.

## Blocked until reconciled

- `docs/proposed-migrations/20261026140000_community_contributions_DRAFT.sql` (and related) — **not** applied on DEV via push until history sync is resolved.
- Record Relief importer migrations that exist only locally (`20261017193000` chain) — remote may already contain equivalent objects under different version names.

## App delivery unaffected

Edge Functions (e.g. `fairpath-ai-gateway`) and mobile client releases do not require migration push for Signal 2.0 read-tool flows that use existing `search_jobs`, `search_resources`, and `search_housing` RPCs already on DEV.
