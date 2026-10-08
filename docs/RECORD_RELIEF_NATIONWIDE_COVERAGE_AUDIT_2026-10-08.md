# Record Relief — nationwide executable coverage audit (2026-10-08)

DEV only: `znvhmuhojvwvjzmaqwff`. No production changes.

## Live inventory

- `legal_source_registry`: **57** source records; registry entry is not verified legal logic.
- `record_relief_jurisdictions`: **61** rows, including non-launch/test entries; do not conflate with the 57 launch authorities.
- `record_relief_rules`: **5** rows, all synthetic `TEST-A` (3), `TEST-B` (1), `TEST-C` (1). **ZERO executable rules for real US jurisdictions in this table**.
- `record_relief_forms`: **4** rows.
- `record_relief_federal_pathways`: **3** rows; not equivalent to comprehensive federal relief validation.
- Independently qualified legal approvals: **0 of 57**.

## Important interpretation

The live Ohio synthetic case demonstrated the Ohio eligibility response in the app, but it does **not** prove the nationwide `record_relief_rules` table is populated. Determine whether the app evaluates a separate static rule engine and reconcile that engine with the database before declaring any jurisdiction covered. The five `verified` rule rows are synthetic test jurisdictions, not three actual states.

## Engineering acceptance gate (repeat for each of 57 jurisdictions)

1. Identify and inventory all relief pathways and official authority with current effective date.
2. Map pathway to actual executable code/data and distinguish implemented from directory-only.
3. Add synthetic eligible, excluded, ambiguous, timing-boundary and stale-source fixtures.
4. Run deterministic automated evaluations; verify outcomes, citations, missing facts, and persisted version.
5. Validate official forms and court venue links; mark missing entries explicitly.
6. Record evidence and independent legal reviewer identity/date/signature. No self-approval.

## Immediate blockers

- Determine authoritative engine and full executable coverage; existing `record_relief_rules` table has no real-jurisdiction rows.
- Physical Storage object deletion still unverified live.
- Local SQL fixture suite has `pg_net` / `cron.job` dependency and change-event fixture failures.
- Independent legal sign-off pending for all 57.

**Nationwide release: NOT APPROVED.**
