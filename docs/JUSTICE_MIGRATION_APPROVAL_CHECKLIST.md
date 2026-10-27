# Shared DEV migration approval checklist — canonical justice

Stop at this gate until each item is checked by founder + backend (+ counsel for employer/matching).

## Pre-apply (local only)

- [ ] `npm run test:all` passes (includes justice contract parity + proposed schema static validation)
- [ ] `node scripts/test-proposed-justice-schema.mjs` passes
- [ ] `node scripts/audit-justice-contract.mjs` passes (Mobile / Partner / Admin contract identical)
- [ ] Apply `20261021150000_canonical_justice_reconciliation_DRAFT.sql` on **local Postgres** clone; run backfill dry-run queries from `JUSTICE_LEGACY_BACKFILL_PLAN.md`
- [ ] Record Relief nationwide smoke: `node scripts/test-record-relief-nationwide-smoke.mjs`
- [ ] Full `tests/record-relief*.test.ts` corpus (Node `--test`) — schedule CI time budget

## Apply order (shared DEV — requires explicit GO)

1. [ ] Confirm DEV migration ledger head vs `fairpath-mobile/supabase/migrations`
2. [ ] Move reconciliation SQL into `supabase/migrations/` with new timestamp (never reuse applied version)
3. [ ] `supabase db push` or approved pipeline **to DEV project only**
4. [ ] Run backfill Phase B–C (service role script or SQL transaction)
5. [ ] Verify trigger: authenticated `jobs` update with `justice_policy_v1` **fails**
6. [ ] Deploy Partner/Admin server actions calling RPCs (replace JSONB interim)

## Post-apply verification

- [ ] Member A cannot read Member B `justice_charges`
- [ ] Partner cannot `UPDATE jobs.eligibility_rules` to approved policy
- [ ] Admin approve creates `published_version_id`; Mobile matching reads approved version only
- [ ] Multi-charge case: each charge gets evaluation row with `justice_charge_id`
- [ ] Sealed/expunged charges excluded from `evaluate_member_job_justice_match` (when RPC live)

## Explicitly not in scope without separate approval

- Production Supabase
- Git commit / push
- External background-check providers
- Stripping legacy `convictions` / `record_relief_cases` columns
