# Record Relief — skip legacy eval on save (approval package)

**DRAFT file:** `docs/proposed-migrations/20261023120000_record_relief_save_skip_legacy_eval_DRAFT.sql`  
**Status:** NOT APPLIED — requires counsel + backend owner sign-off  
**Client mitigation (live without migration):** `9d40728` — Edge eval after save; UI hides legacy `rule_unavailable` via `partitionEvaluationsForDisplay`

## Problem (DEF-RR-001)

`save_record_relief_case` always runs `perform public.evaluate_record_relief_case(result.id)` after insert/update. That path reads **published DB rules** (`record_relief_rules`), which are sparse for real jurisdictions. It often writes a **misleading `rule_unavailable` evaluation** before the mobile client calls `evaluate-record-relief` Edge (57-authority shared engine). Members briefly see contradictory rows; filing steps may attach to the wrong eval.

## Proposed change

Replace `save_record_relief_case` body so legacy eval runs **only** when payload sets `skip_legacy_eval: false` (default **true** = skip).

| Behavior | Before | After (DRAFT) |
|----------|--------|----------------|
| Save case | Always legacy eval | Skip legacy by default |
| Rollback lever | N/A | Pass `skip_legacy_eval: false` in save payload to restore old behavior |
| Edge / mobile | Client re-evaluates | Unchanged — still authoritative in app |

## Affected RPCs

- **`public.save_record_relief_case(uuid, jsonb)`** — only function replaced in DRAFT  
- **Unchanged:** `evaluate_record_relief_case`, `get_record_relief_case_detail`, Edge `evaluate-record-relief`, RLS on cases/evaluations

## Rollback

1. Redeploy prior function definition from `supabase/migrations/20261001170000_record_relief.sql` (lines 478–521), **or**
2. Set `skip_legacy_eval: false` on all mobile saves temporarily without DB change.

No schema DDL; rollback is function-only.

## Risks

| Risk | Mitigation |
|------|------------|
| Consumers relied on save-time legacy eval | Mobile/web already call Edge or re-check; Command Center must confirm |
| Empty eval history until first Edge call | Client `saveCaseAndAutoEvaluate` invokes Edge immediately after save |
| Stale eval rows in DB | Existing superseded flag logic; optional one-time cleanup script (separate approval) |

## Test plan (post-apply on DEV only)

1. `node scripts/test-local-relief.mjs` — 17/17 (local Postgres with migration applied in test DB only).
2. Manual DEV: create Ohio case → save → detail shows **one** authoritative outcome (Edge), no duplicate `rule_unavailable`.
3. Regression: anon cannot save; case limit; jurisdiction validation unchanged.
4. Optional: set `skip_legacy_eval: false` → legacy row appears (rollback path proof).

## Evidence before apply

- [ ] Backend owner review  
- [ ] Legal/counsel review (eligibility display)  
- [ ] DEV apply in isolated project  
- [ ] Mobile QA on DEV iPhone (not simulator-only)
