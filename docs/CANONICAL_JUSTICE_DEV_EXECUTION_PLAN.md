# Canonical Justice — DEV execution plan (read-only inventory)

**Status:** Ready for local validation. **Do not apply to shared DEV** until explicit approval (see `JUSTICE_MIGRATION_APPROVAL_CHECKLIST.md`).

## Authoritative artifact

- **Final migration SQL (draft path):** `docs/proposed-migrations/20261021150000_canonical_justice_reconciliation_DRAFT.sql`
- **Promotion target filename (when approved):** `supabase/migrations/20261021180000_canonical_justice_reconciliation.sql`  
  (timestamp slot after latest committed migration `20261017202000_rls_initplan_saved_searches_inquiries.sql`)

## DEV migration history (repo read-only)

| Check | Result |
|-------|--------|
| Latest committed migration in mobile repo | `20261017202000_rls_initplan_saved_searches_inquiries.sql` |
| Canonical justice reconciliation in `supabase/migrations/` | **Not present** (still proposed draft only) |
| Superseded drafts | `20261021140000_*`, `20261023100000_*` marked SUPERSEDED in headers |
| Shared DEV apply | **Not performed** (no `db push`, no migration repair) |

Before apply, re-verify remote DEV `supabase_migrations.schema_migrations` matches repo HEAD (manual read via Supabase dashboard or read-only SQL).

## Exact application sequence (after approval)

1. **Freeze** Partner/Admin interim JSONB policy writes (deploy app flags or maintenance window).
2. **Copy** draft → `supabase/migrations/20261021180000_canonical_justice_reconciliation.sql` (no content change without new review).
3. **Apply** only through approved pipeline (e.g. CI migration job or `supabase migration up` against DEV — **not** blind re-run of backfill on partial state).
4. **Run** `select public.service_backfill_justice_from_legacy(null);` once as **service_role** (idempotent for unmigrated rows).
5. **Smoke:** partner draft → submit → admin approve → member `evaluate_member_job_justice_match(job_id)`.
6. **Deploy** Partner/Admin/Mobile RPC cutover (see `JUSTICE_RPC_INTEGRATION_PLAN.md`).
7. **Optional cleanup:** strip `jobs.eligibility_rules.justice_policy_v1` after RPC parity confirmed (separate migration).

## Rollback and recovery

### Pre-apply snapshot

- Take Supabase **logical backup** or point-in-time recovery note before migration.
- Export counts: `convictions`, `record_relief_cases`, `record_relief_evaluations`, `jobs` with non-null `eligibility_rules->justice_policy_v1`.

### If migration fails mid-apply

- Do **not** re-run non-idempotent data steps blindly.
- Fix forward in a new migration file; use transaction-wrapped apply where platform allows.

### If migration applied but apps not cut over

- Interim JSONB on `jobs` remains blocked for authenticated clients (trigger `guard_jobs_justice_policy`).
- Service role can still bridge JSONB during cutover.

### Full rollback (manual, destructive)

Order (from migration footer):

1. Drop triggers: `guard_jobs_justice_policy`, `guard_employer_policy_version_immutable`, `guard_employer_policy_header_locked`.
2. Drop functions §6–9 (partner/admin/match/backfill helpers).
3. Drop tables: `justice_match_evaluations`, `employer_job_conviction_policy_versions`, `employer_job_conviction_policies`, `justice_charge_corrections`, `justice_charges`, `justice_cases`, `record_relief_local_filing_profiles`, `record_relief_courts` (only if no other feature depends on courts).
4. Drop columns: `convictions.justice_charge_id`, `record_relief_cases.justice_case_id` (+ venue columns if added solely for this effort), `record_relief_evaluations.justice_charge_id`.
5. Restore app builds that use JSONB interim path only.

**Data preservation:** Rollback drops canonical rows; legacy `convictions` / `record_relief_cases` remain unless explicitly deleted. Re-link after re-apply via `service_backfill_justice_from_legacy`.

## Local validation evidence

Run:

```bash
node scripts/test-proposed-justice-schema.mjs
node scripts/test-local-justice-canonical.mjs
npm run test:all   # includes both above
```

Latest local harness: **7/7** on `test-local-justice-canonical.mjs` (apply, idempotent re-apply, partner/admin workflow, JSONB guard, multi-charge match, backfill, direct version insert blocked).

## Remaining blockers

| Blocker | Owner | Notes |
|---------|-------|-------|
| Explicit DEV migration approval | Product / Sterling | Gate per checklist |
| Admin/Partner/Mobile RPC cutover deploy | Eng | Interim JSONB still live on DEV |
| `justice-match-v1-sql` vs TS engine version string parity | Eng | Align client display or document dual engines during transition |
| Courts/filing seed data on DEV | Ops | Tables empty until seed migration or import |
| Charge-level RR evaluation backfill | Eng | Column exists; populate `justice_charge_id` on evaluations in follow-up job |
