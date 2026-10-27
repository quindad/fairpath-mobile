# Post-migration RPC integration (Mobile, Partner, Admin)

Replace interim `jobs.eligibility_rules.justice_policy_v1` JSONB writes after canonical migration is on DEV.

## Partner (`quindad-fairpath-partner`)

| Today | After cutover |
|-------|----------------|
| `policy-actions.ts` writes JSONB via Supabase update + `employer-policy-guard.ts` | `supabase.rpc('partner_save_job_conviction_policy_draft', { p_job_id, p_policy_json })` |
| Submit via local status flip | `supabase.rpc('partner_submit_job_conviction_policy', { p_job_id })` |
| Read policy from `jobs.eligibility_rules` | Read header via `employer_job_conviction_policies` (SELECT allowed for org members) + summary RPC/view (future) |

**Server:** keep `employer-policy-guard.ts` as defense-in-depth until DEV trigger confirmed; remove JSONB write path.

## Admin (`fairpath-admin`)

| Today | After cutover |
|-------|----------------|
| `employer-policies/actions.ts` approves JSONB + audit log | Service role: `admin_approve_job_conviction_policy`, `admin_reject_job_conviction_policy`, `admin_request_job_conviction_policy_corrections` with `p_actor` = signed-in staff user id |
| Lists jobs with embedded JSONB | Join `employer_job_conviction_policies` + latest version metadata |

**Auth:** Admin app already uses service role on server; RPCs are **not** granted to `authenticated`.

## Mobile (`fairpath-mobile`)

| Today | After cutover |
|-------|----------------|
| `evaluateJobJusticeCompatibility` parses JSONB + in-app TS engine | Prefer `supabase.rpc('evaluate_member_job_justice_match', { p_job_id })`; map JSON to `JusticeMatchEvaluationRecord` |
| Unified charges from convictions + RR client assembly | Continue hub UX; persistence targets `justice_cases` / `justice_charges` when write APIs land |
| `JobJusticeCompatibilityPanel` | Show RPC explanation; no offense text in employer-facing surfaces (RPC already omits raw titles in persisted explanation) |

**Fallback:** Keep TS `evaluateJobConvictionMatch` when RPC returns `NO_PUBLISHED_POLICY` during mixed DEV state.

## Contract parity

- Shared SHA: `justice-match-contract.ts` (mobile ↔ partner ↔ admin).
- Matching semantics: TS `job-conviction-match.ts` is reference; SQL engine `justice-match-v1-sql` mirrors core criterion kinds for server-side evaluation.

## Testing after cutover

- Mobile: `npm run test:all`, record relief suite, `audit-justice-contract.mjs`
- Partner: policy guard tests + RPC integration test (add when DEV RPC live)
- Admin: employer policy action tests updated for RPC mocks
