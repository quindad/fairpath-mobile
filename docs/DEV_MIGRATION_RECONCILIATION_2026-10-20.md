# DEV migration drift reconciliation (read-only)

**Date:** 2026-10-20
**Branch:** `development/mobile-v1-completion` @ `231de92`
**Target:** `fairpath-mobile-dev` · `znvhmuhojvwvjzmaqwff` only
**Investigation:** Read-only (`npx supabase migration list --linked`). **No** `db push`, repair, or DDL executed.

## Executive decision

**NO-PUSH** — Do not run `supabase db push` until migration **history** and **schema semantics** are reconciled.

Blind push would attempt **26** local-only versions in one transaction. At least **12** Record Relief renames overlap DEV-applied **`202610080039xx`** / **`20261008004xxx`** / **`20261008025xxx`** entries (different version stamps, related names). That risks duplicate objects, failed applies, or a false sense that repo SQL ran when DEV actually has forked definitions.

The **four October 17 Mobile V1 migrations** are separable and mostly **Missing** on DEV (see §6). They should be applied via an **approved, scoped** plan after function/column verification—not as part of an unreviewed 26-version push.

---

## 1. Linked project (reconfirmed)

`npx supabase migration list --linked` on 2026-10-20 connected to remote history for **`znvhmuhojvwvjzmaqwff`**.

---

## 2. Inventory summary

| Category | Count | Meaning |
| --- | ---: | --- |
| Local + remote match | ~119 | History aligned |
| **Local only** (remote empty) | **26** | CLI would apply on push — **22 “unexpected” + 4 Oct 17** |
| **Remote only** (local empty) | **~35** | Applied on DEV from SQL **not** in this repo’s `supabase/migrations/` filenames |

Bidirectional drift: DEV has **remote-only** versions (e.g. `20261008003911`, `20261008460000`–`20261008510000`) while the repo has **canonical renumbered** files (`20261008520000`–`20261008590000`) never recorded on DEV.

---

## 3. Twenty-two row reconciliation matrix

**Legend:**
**Equivalent** = high confidence same intent already on DEV (still verify function/policy bodies).
**Partial** = objects exist; local file likely differs or history forked.
**Missing** = intended effect not on DEV.
**Unverified** = insufficient evidence without live `pg_catalog` / function body checks.

| # | Local version (repo file) | Likely remote counterpart on DEV | Live object hints (handoff) | Classification | Recommended action (after approval) |
| --- | --- | --- | --- | --- | --- |
| 1 | `20261008222300_notification_delivery_completion.sql` | Possibly `20261008175923` or overlap with synced `20261008220000` | `notification_preferences` exists | **Unverified** | Compare `record_document_consent`-adjacent delivery RPCs + `notification_preferences` / `claim_notification_deliveries` defs on DEV vs local file |
| 2 | `20261008222400_notification_push_receipts.sql` | None in list | `notification_push_receipts` exists | **Partial** | Diff table + `delivery_receipt_exists` (or equivalent) on DEV vs local |
| 3 | `20261009060000_notification_token_attempts.sql` | None | `notification_token_attempts` exists | **Partial** | Diff table/constraints vs local |
| 4 | `20261009080000_notification_token_retry_coordination.sql` | None | (coordination RPCs unknown) | **Unverified** | Inspect functions referencing token attempts on DEV |
| 5 | `20261008520000_record_relief_ai_uploads.sql` | `20261008003911` (ai_uploads_v2) | `record_relief_uploads` | **Partial** | Diff DDL + storage policies vs local; do **not** re-apply create table |
| 6 | `20261008530000_record_relief_case_packets.sql` | `20261008003916` (case_packets_v2) | `record_relief_case_packets` | **Partial** | Same |
| 7 | `20261008540000_record_relief_lifecycle.sql` | `20261008003948` (lifecycle_v2) | (lifecycle cols/RPCs) | **Partial** | Same |
| 8 | `20261008550000_record_relief_ai_security.sql` | `20261008003957` / `20261008004003` | (security RPCs) | **Unverified** | Compare function bodies |
| 9 | `20261008560000_record_relief_shared_engine_persistence.sql` | `20261008004014` (shared_engine_persistence_v2) | evaluations persistence | **Partial** | Compare `replace_record_relief_*` / evaluation RPCs |
| 10 | `20261008570000_record_relief_production_hardening.sql` | `20261008004024` (production_hardening_v2) | hardening triggers/grants | **Partial** | Compare grants + triggers |
| 11 | `20261008580000_record_relief_source_registry_seed.sql` | `20261008004455` | registry seed | **Partial** | Row counts + seed keys; seed may differ by environment |
| 12 | `20261008590000_record_relief_monitor_auth.sql` | `20261008004503` | `record_relief_monitor_auth` | **Partial** | Diff table |
| 13 | `20261009010000_record_relief_authenticated_minimum_grants.sql` | `20261008025335` | grants | **Unverified** | `\df+` / `information_schema.role_table_grants` |
| 14 | `20261009020000_record_relief_disable_metadata_only_expiry.sql` | `20261008031954` | expiry behavior | **Unverified** | Compare function definitions |
| 15 | `20261009030000_record_relief_restore_service_role_upload_access.sql` | `20261008035711` | storage/service_role | **Unverified** | Compare storage policies |
| 16 | `20261009040000_record_relief_fix_evaluation_missing_inputs_array.sql` | `20261008041437` | evaluation RPC | **Unverified** | Compare `replace_record_relief_evaluations` or successor |
| 17 | `20261009050000_optimize_rls_auth_initplans.sql` | `20261008192257` | broad RLS | **Partial** | Sample policies on DEV for `(select auth.uid())` vs bare `auth.uid()` |
| 18 | `20261009053401_job_application_update_integrity.sql` | None | (trigger on job applications) | **Unverified** | Check trigger `job_application_update_integrity` exists |
| 19 | `20261009070000_housing_payment_refund_accuracy.sql` | None | (payment RPCs) | **Unverified** | Compare housing payment/refund functions |
| 20 | `20261014000000_ai_credit_rate_limit.sql` | Possibly `20261015032752` (remote-only) | `ai_credit_*` tables | **Partial** | Diff tables + `spend_ai_credits` (or equivalent) body vs local |
| 21 | `20261014010000_staffing_architecture.sql` | None | `staffing_*` tables | **Partial** | Tables exist; column/index drift unknown |
| 22 | `20261014020000_staffing_audit_ratecards_provider_events.sql` | None | `staffing_audit_log` etc. | **Partial** | Diff vs local |

**Additional remote-only gap (not in the 22):** DEV lists **`20261008460000`–`20261008510000`** with **no local file**. Repo jumps from `20261008450000` to `20261008520000`. Treat as **forked relief track on DEV** — reconcile before marking local `0852xx` applied.

---

## 4. Evidence notes (static repo)

- **`20261015130000_record_document_consent.sql`** (applied on DEV): inserts into `consent_events` only — **no** `profiles.terms_*` / `privacy_*` update.
- **`20261017193000_record_document_consent_sync_profiles.sql`** (local only): replaces `record_document_consent` to sync profile pointers — **required for accept-terms loop** (`test:sql:consent`, client fallback in `consent-status.ts`).
- **`20261017201000`**: adds `profiles.experience_summary` — column-only, low risk if applied alone.
- **`20261017200000`**: replaces RLS on `member_record_statements` with initplan-safe `(select auth.uid())`; table/policies already from applied **`20261016220000`** using bare `auth.uid()`.
- **`20261017202000`**: initplan fixes for `saved_job_searches` + `housing_inquiry_messages`; base policies from applied **`20261016140000`** / **`20261016130000`**.

Handoff read-only queries: **13 tables** present — supports **Partial**, not **Equivalent**, for relief/notifications/staffing/AI credit.

---

## 5. October 17 four — dependency analysis

| Migration | Depends on | Blocked by 22? | DEV status (inference) |
| --- | --- | --- | --- |
| `20261017193000` | `20261015130000`, `consent_events`, `profiles` | **No** — independent RPC replace | **Missing** (15130000 body lacks sync) |
| `20261017201000` | `profiles` | **No** | **Missing** (column absent unless manually added) |
| `20261017200000` | `member_record_statements` (16220000 applied) | **No** | **Partial** (policies exist, initplan fix not applied) |
| `20261017202000` | `saved_job_searches` (16140000), `housing_inquiry_messages` (16130000) | **No** | **Partial** (policies exist, initplan fix not applied) |

**Conclusion:** The four Oct 17 migrations do **not** require the 22 pending versions to run first. They **can** be deployed in isolation **once approved**, ideally **without** a full 26-version push.

---

## 6. Proposed DEV-only remediation sequence (requires explicit approval)

### Phase A — Verification SQL (operator, read-only)

Run in DEV SQL editor; paste results into this doc or PR.

```sql
-- A1: consent RPC sync (Oct 17 blocker)
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_document_consent';

-- A2: experience_summary
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'experience_summary';

-- A3: initplan sample (saved_job_searches)
select polname, pg_get_expr(polqual, polrelid) as qual
from pg_policy join pg_class on pg_class.oid = polrelid
where relname = 'saved_job_searches';

-- A4: record_document_consent live test user (optional)
-- (use handoff queries from DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md)
```

### Phase B — History reconciliation (approved write to `supabase_migrations` only)

For each row classified **Equivalent** or **Partial** with confirmed matching semantics:

1. Document diff outcome (attach `pg_get_functiondef` / policy text).
2. If DEV already matches local intent: `supabase migration repair --status applied <local_version>` **one version at a time**, with snapshot/backup policy per org rules.
3. **Never** repair as applied if local SQL would still change security (grants/RLS) when run.

For **remote-only** `20261008460000`–`20261008510000`: export SQL from Supabase dashboard (migration history) into repo or an internal archive so repo matches reality.

### Phase C — Apply true **Missing** schema (approved DDL)

**Preferred:** Scoped apply of **only**:

1. `20261017193000_record_document_consent_sync_profiles.sql`
2. `20261017201000_profiles_experience_summary.sql`
3. `20261017200000_member_record_statements_rls_initplan.sql`
4. `20261017202000_rls_initplan_saved_searches_inquiries.sql`

Options (pick one after approval):

- **C1:** Manual run of the four files in SQL editor (deterministic, no history update) **then** `migration repair` for those four versions **or** a single follow-up “history sync” migration.
- **C2:** After Phase B clears the 22 from “pending”, `db push` applies only what remains (must be exactly these four if repair done correctly).

### Phase D — Functional gaps from **Partial** / **Missing** rows

Track separately (may need forward-fix migrations, not re-run of 0852xx):

- Job application integrity (`09053401`)
- Housing payment refund (`09070000`)
- Notification token retry (`09080000`)
- AI credit function bodies vs `140000`
- Staffing RPCs vs `140100`/`140200`

---

## 7. Verification plan (post-remediation)

| Check | Command / action |
| --- | --- |
| Local suite | `npm run test:sql:consent`, `npm run test:all` (65) |
| Accept-terms | `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md` app smoke |
| Onboarding | `docs/NEW_USER_JOURNEY_E2E.md` with `experience_summary` optional field |
| Relief | Existing DEV QA / evaluate-record-relief smoke |
| Migration list | `npx supabase migration list --linked` → no unexpected local-only pending |

---

## 8. Rollback plan

| Change type | Rollback |
| --- | --- |
| `17193000` RPC | Redeploy prior `record_document_consent` body from `20261015130000` (keeps ledger, drops profile sync) |
| `17201000` column | `alter table profiles drop column if exists experience_summary` (only if unused) |
| `17200000` / `17202000` RLS | Re-run policy definitions from `16140000` / `16130000` / `16220000` (bare `auth.uid()`) |
| `migration repair` | `supabase migration repair --status reverted <version>` (does not drop schema — document separately) |

Take a DEV backup/snapshot per Supabase org policy before any Phase B/C write.

---

## 9. Remaining functional / security differences (known)

- Accept-terms may loop until **`17193000`** is applied (client backfill is mitigation only).
- Signal/onboarding **`experience_summary`** absent until **`17201000`**.
- RLS initplan optimizations (**`17200000`**, **`17202000`**, and possibly **`09050000` / remote `08192257`**) may be performance-only unless audit flagged bare `auth.uid()` as failing checks.
- **22 pending** versions must not be assumed **Missing**; most overlap DEV-applied **v2** timestamps.
- **Repo missing** remote-only migrations **`08460000`–`08510000`** — history on DEV is not fully reproducible from git alone.

---

## 10. Acceptance checklist (handoff §7)

| Criterion | Status |
| --- | --- |
| DEV-only target | ✅ Verified via linked list |
| Each unexpected pending classified | ✅ Matrix §3 (with Unverified where needed) |
| Security/grants/functions reviewed | ⚠️ Requires Phase A SQL output |
| Corrective SQL documented | ✅ Phases B–D |
| History repair won’t hide missing functionality | ⚠️ Conditional on Phase A diffs |
| Deterministic DEV-scoped plan | ✅ §6 |
| Oct 17 four without unintended earlier pending | ✅ §5 — isolate four files |

**Decision for deployment authorization:** **NO-PUSH** for the **full 26-version chain** until Phase B repair strategy is approved for the 22 (+ remote-only export).

**Phase A completed (2026-10-20):** All four Oct 17 effects confirmed **Missing** on DEV. Isolated apply proposal (manual four-file only, no history repair): **`docs/DEV_MIGRATION_OCT17_ISOLATED_APPLY.md`** — **separate approval required before execution**.

---

*Generated from read-only investigation; Phase A SQL confirmed by operator; no database mutations performed by this doc.*
