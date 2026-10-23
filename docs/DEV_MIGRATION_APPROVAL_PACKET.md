# DEV migration approval packet — DEF-RR-001

**Status:** Awaiting explicit owner + backend sign-off. **Do not apply** on shared DEV or production without this checklist complete.

---

## Migration identity

| Field | Value |
|-------|--------|
| **Filename (DRAFT)** | `docs/proposed-migrations/20261023120000_record_relief_save_skip_legacy_eval_DRAFT.sql` |
| **Promotion target** | New numbered file under `supabase/migrations/` after approval (do not rename DRAFT in place on shared branches without review) |
| **Schema DDL** | **None** — `CREATE OR REPLACE FUNCTION` only |
| **Object replaced** | `public.save_record_relief_case(uuid, jsonb)` |

---

## Problem statement

Today, every save runs `perform public.evaluate_record_relief_case(result.id)` (see `supabase/migrations/20261001170000_record_relief.sql` lines 518–519). That path uses **published DB rules**, which are sparse for real jurisdictions. Mobile then calls Edge `evaluate-record-relief` (57-authority engine). Members can see a transient **misleading `rule_unavailable`** row (DEF-RR-001).

---

## Proposed behavior

1. Read `skip_legacy_eval` from JSON payload `p`, default **`true`** when absent.
2. When `skip_legacy_eval` is true, **skip** `evaluate_record_relief_case` on save.
3. When `false`, preserve legacy save-time eval (rollback lever).

**Client (already merged):** `saveCase()` sends `skip_legacy_eval: true` by default (`relief-service.ts`). Pre-migration, extra JSON keys are ignored by the **current** function body; post-migration, behavior aligns without another app release.

---

## Prerequisites

- [ ] DEV project ref matches `.env.local` / `supabase/.temp/project-ref` (`znvhmuhojvwvjzmaqwff`).
- [ ] Edge function **`evaluate-record-relief`** deployed and reachable (see `docs/DEV_EDGE_FUNCTION_DEPLOYMENT_MANIFEST.md`).
- [ ] Local SQL green: `node scripts/test-local-relief.mjs` → **17/17** (apply DRAFT to **local test DB only** inside that harness if validating function swap).
- [ ] Command Center / any non-mobile consumer of save-time legacy eval identified (owner attestation).

---

## Expected database changes

- **Functions:** One function body swap; grants unchanged (`authenticated`, `service_role`; not `anon`).
- **RLS:** Unchanged — cases remain owner-scoped.
- **Data:** No automatic backfill; existing evaluation rows remain; new saves may have **zero** rows until Edge runs.

---

## Compatibility

| Area | Impact |
|------|--------|
| Deterministic Edge engine | **Unchanged** — still invoked by mobile `saveCaseAndAutoEvaluate` |
| Multi-charge / bundle | **Unchanged** — save payload and Edge bundle unchanged |
| `get_record_relief_case_detail` | **Unchanged** |
| Idempotency | Save remains idempotent on case id; eval is separate |
| Permissions | Still `SIGNED_OUT` if unauthenticated; `CASE_LIMIT`, `INVALID_JURISDICTION` preserved |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Downstream expected save-time eval row | Client Edge call immediately after save; optional `skip_legacy_eval: false` |
| Empty eval until Edge fails | UI uses `partitionEvaluationsForDisplay`; honest error if Edge down |
| Wrong jurisdiction legacy row attached | Removed by default skip |
| Rollback needed | Redeploy prior function from `20261001170000_record_relief.sql` or force `skip_legacy_eval: false` |

---

## Rollback procedure

1. **Fast (no DB):** Ship client with `skip_legacy_eval: false` on all saves.
2. **DB:** Redeploy previous `save_record_relief_case` definition from migration `20261001170000_record_relief.sql` (lines 478–521).
3. **Verify:** Save case on DEV → legacy eval row appears; mobile Edge still optional.

**Stop / do not proceed if:** Edge eval unavailable on DEV after apply and no rollback window; or counsel rejects eligibility display change.

---

## DEV verification checklist (post-apply only)

1. `node scripts/test-local-relief.mjs` with migration applied in test harness.
2. Signed-in DEV: create **US-OH** multi-field case → save → **one** authoritative Edge outcome in UI; no spurious `rule_unavailable` from save path.
3. Scan path: upload → extract → evaluate (Edge) unchanged.
4. Anon: `save_record_relief_case` still denied (`node scripts/qa-dev-anon-probe.mjs`).
5. Optional: save with `skip_legacy_eval: false` → legacy row present (rollback proof).

---

## Owner approval request

We request approval to:

1. Promote DRAFT SQL to an approved migration file and apply **on DEV only**.
2. Run the DEV verification checklist above.
3. Schedule mobile iPhone QA for Record Relief (P0-005–007) after DEV parity confirmed.

**Sign-off roles:** Backend owner · Legal/counsel (eligibility messaging) · Mobile lead

**Not requested in this packet:** Production apply · Community help migrations · Justice canonical migrations
