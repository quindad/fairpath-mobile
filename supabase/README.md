# Supabase schema — source of truth

This directory is the start of bringing the database under source control
(Step 0 Foundation, item 1). It is **not yet linked to the live project**.

## What's here

- `config.toml` — Supabase CLI project config (unlinked scaffolding).
- `migrations/` — SQL migrations, applied in filename order.
  - `20260924_0001_feature_flags.sql` — new `feature_flags` table (Step 0 item 4). This is real, owned DDL, not a reconstruction.
- `SCHEMA_INVENTORY.md` — every table/RPC/bucket the mobile client currently assumes exists, gathered by reading `src/`. This is **not** a schema dump — it has no constraints, RLS, defaults, or triggers, because those aren't visible from client code. Treat it as a reconciliation checklist, not a source of truth.

## Blocked: pulling the real baseline schema

This environment only has the client's public anon/publishable key
(hardcoded today in `src/lib/supabase.ts`, being moved to env vars in this
same pass — see item 5). That key can query data through RLS; it cannot
read schema, RLS policy bodies, RPC/trigger definitions, or dump the
database. Producing the real baseline migration needs someone with actual
project credentials to run, from a machine with the Supabase CLI installed:

```bash
supabase login
supabase link --project-ref <the live project ref>
supabase db pull
```

`db pull` writes the live schema as a new migration file in this directory.
From that point on, every future schema change should be a new migration
here, reviewed like any other code change, instead of made ad hoc against
the dashboard.

## Generating TypeScript types

Once linked:

```bash
supabase gen types typescript --linked > src/core/supabase/database.types.ts
```

No generated types file was fabricated as part of this change — a
hand-written "generated" file with unverified column types/nullability
would be actively misleading. `npm run db:types` (added to `package.json`)
runs the command above once the project is linked.

## Ongoing workflow

- New schema changes: `supabase migration new <name>`, edit the generated
  file, `supabase db push` (or apply via the SQL editor and then run
  `supabase db pull` to reconcile the migration history).
- Regenerate types after any schema change: `npm run db:types`.
