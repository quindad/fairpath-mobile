# Justice legacy backfill plan (pre-apply checklist)

Apply only after **`20261021150000_canonical_justice_reconciliation_DRAFT.sql`** is reviewed and tested on **local Postgres** (`scripts/test-proposed-justice-schema.mjs`).

## Phase A — Schema (empty DB)

1. Apply reconciliation migration in order after latest `supabase/migrations/*`.
2. Verify RLS: member sees only own `justice_*`; no authenticated SELECT on `employer_job_conviction_policy_versions` except org read of policy header; writes only via RPCs.
3. Rollback script: reverse order in migration footer.

## Phase B — Backfill `justice_cases` / `justice_charges`

### B1. From `record_relief_cases` (one legacy row → one case + one charge)

For each `record_relief_cases` row:

1. Insert `justice_cases` with `docket_label = label`, jurisdiction/court/case_number from RR row, `verification_state = user_confirmed` (or `needs_review` if `out_of_state_conviction`).
2. Set `record_relief_cases.justice_case_id = justice_cases.id`.
3. Insert one `justice_charges` with offense/disposition/dates mapped from legacy RR columns; `count_number = 1`.
4. Re-link existing `record_relief_evaluations` to `justice_charge_id` on that charge (case_id unchanged).

### B2. From `convictions` where `origin = manual'` and no linked charge

For each conviction without `justice_charge_id`:

1. If a `justice_case` exists for same `(user_id, state → jurisdiction_code, case_number)`, attach charge only.
2. Else create case + charge from conviction fields; set `convictions.justice_charge_id`.

### B3. Questionnaire row (`origin = questionnaire'`)

1. Ensure exactly one questionnaire charge per user (merge duplicates to oldest).
2. Do **not** delete `convictions` until Profile RPC reads `justice_charges`.

### B4. Dedup

- Unique partial index on `(user_id, jurisdiction_code, lower(case_number))` prevents duplicate dockets.
- Manual review queue for conflicting dispositions on same count_number.

## Phase C — Employer policies

1. For each `jobs.eligibility_rules->justice_policy_v1`:
   - Insert `employer_job_conviction_policies` + version 1 row.
   - If `publicationStatus = approved`, set `published_version_id` and policy `status = approved`.
2. Strip `justice_policy_v1` from JSONB after verification (optional cutover step).

## Phase D — Validation queries

- Count RR cases = count justice_cases with RR link (± intentional orphans).
- Every non-superseded evaluation has `justice_charge_id` or documented exception.
- Zero authenticated updates to `jobs.eligibility_rules` containing `justice_policy_v1` (trigger test).

## Phase E — App cutover

1. Mobile: read canonical tables in `justice-service.ts` (future); keep unified-assembly fallback until flag on.
2. Partner: call RPCs only; remove direct JSONB updates.
3. Admin: review queue reads `employer_job_conviction_policies`.

**No destructive drops** of `convictions` or `record_relief_cases` in Wave 1.
