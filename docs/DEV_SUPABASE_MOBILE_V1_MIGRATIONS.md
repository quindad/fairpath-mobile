# DEV Supabase — mobile v1 migrations (accept-terms + profile)

**Project ref (DEV):** `znvhmuhojvwvjzmaqwff`  
**Branch:** `development/mobile-v1-completion`

These migrations unblock **Task 018** (accept-terms persistence) and related mobile v1 work. Apply them on DEV before QAing auth/onboarding on a real device or Expo web against cloud Supabase.

## Required migrations (Oct 17, 2026 batch)

| Version | File | Why |
| --- | --- | --- |
| `20261017193000` | `record_document_consent_sync_profiles.sql` | RPC updates `profiles.terms_*` / `privacy_*` so routing does not loop on `/accept-terms`. |
| `20261017201000` | `profiles_experience_summary.sql` | Optional onboarding field for Signal/home copy. |
| `20261017200000` | `member_record_statements_rls_initplan.sql` | RLS perf fix (initplan). |
| `20261017202000` | `rls_initplan_saved_searches_inquiries.sql` | RLS perf fix (initplan). |

Earlier dependency: `20261015130000_record_document_consent.sql` must already be on DEV (creates the RPC). If sign-up consent fails with “function does not exist”, push from an earlier baseline or apply that file first.

## Apply on DEV (operator)

Prerequisites: [Supabase CLI](https://supabase.com/docs/guides/cli) logged in, project linked to DEV (not production).

```powershell
cd fairpath-mobile
supabase link --project-ref znvhmuhojvwvjzmaqwff
supabase migration list
supabase db push
```

Review the pending list before confirming. **Do not** use `db reset` on shared DEV.

## Verify accept-terms sync (SQL editor on DEV)

Replace `<user_id>` with a test member who just tapped **Agree and continue**:

```sql
select terms_accepted_at, terms_accepted_version, privacy_accepted_at, privacy_accepted_version
from public.profiles
where id = '<user_id>';

select event_type, document_version, granted, created_at
from public.consent_events
where user_id = '<user_id>' and event_type in ('terms_accepted', 'privacy_accepted')
order by created_at desc
limit 4;
```

Both profile pointers and ledger rows should show version `v1` and non-null timestamps.

## Verify in the app (no loop)

1. Sign in as `dev-free@fairpath.test` (or a member missing consent in DEV only).
2. Complete `/accept-terms` once.
3. Force-quit and reopen → should land on `/home` or `/onboarding`, **not** `/accept-terms` again.
4. See also `docs/AUTH_E2E_BROWSER_CHECKLIST.md`.

## Local automated proof (no cloud)

```powershell
npm run test:sql:consent
npm run test:auth
```

`test:sql:consent` applies all migrations locally (PGlite) and asserts `record_document_consent` updates `profiles`.

## Client fallback (already shipped)

If DEV still has the old RPC but ledger rows exist, `src/core/profile/consent-status.ts` backfills profile pointers from `consent_events`. After `20261017193000` is applied, new acceptances stay in sync without relying on the client backfill.
