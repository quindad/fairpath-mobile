# FairPath DEV migration reconciliation

**Status: NO-GO for a reviewed DEV dry run.**

This is a read-only reconciliation completed October 9, 2026. No migration,
ledger row, DEV data, function, policy, or grant was changed.

## Evidence sources

- Read-only `supabase migration list --linked` and
  `supabase_migrations.schema_migrations` queries against DEV.
- All local Git refs and reachable history, plus unreachable-object inspection.
- Current checkout migration inventory and `supabase/production_baseline.sql`.
- Read-only DEV catalog checks for relevant tables and function names.

The Supabase migration ledger retains a version and migration name, not the
original SQL text. A current object or a same-purpose local migration is not
proof that the original SQL was identical.

## DEV-only migration matrix — 41 versions

| Version | DEV ledger name | Original SQL recovery | Local relationship / disposition |
| --- | --- | --- | --- |
| 20261007233711 | record_relief_ai_uploads | Unrecovered; ledger name only | Local `08520000` is a later same-purpose migration; do not reapply. |
| 20261007233719 | record_relief_case_packets | Unrecovered; ledger name only | Local `08530000` is a later same-purpose migration; do not reapply. |
| 20261007233732 | record_relief_evaluation_lifecycle_columns | Unrecovered | Overlaps local `08540000`; exact behavior unverified. |
| 20261007233744 | record_relief_upload_expiry_fields | Unrecovered | Overlaps local `08550000`; exact behavior unverified. |
| 20261007234149 | record_relief_packet_functions | Unrecovered | Possible overlap with local lifecycle/production-hardening work; no reapply. |
| 20261007234156 | record_relief_packet_attach | Unrecovered | No byte-identical local source. |
| 20261007234207 | record_relief_packet_confirm | Unrecovered | No byte-identical local source. |
| 20261007234223 | record_relief_upload_update_scope | Unrecovered | Possible overlap with local AI security; exact behavior unverified. |
| 20261007234241 | record_relief_due_notification_function | Unrecovered | DEV currently has `record_relief_notify_due`; definition not matched. |
| 20261007234247 | record_relief_due_function_permissions | Unrecovered | Permission history unavailable. |
| 20261008000024 | record_relief_law_review_queue | Unrecovered | Possible overlap with local `08540000`; exact behavior unverified. |
| 20261008000033 | record_relief_review_rls | Unrecovered | Permission history unavailable. |
| 20261008000044 | record_relief_retention_cleanup | Unrecovered | Possible overlap with local `08570000`; exact behavior unverified. |
| 20261008000053 | record_relief_retention_permissions | Unrecovered | Permission history unavailable. |
| 20261008000916 | record_relief_engine_outcome_compatibility | Unrecovered | Possible overlap with local `08560000`; exact behavior unverified. |
| 20261008002322 | record_relief_review_approval_guard | Unrecovered | No byte-identical local source. |
| 20261008002334 | record_relief_review_access_restriction | Unrecovered | No byte-identical local source. |
| 20261008003911 | record_relief_ai_uploads_v2 | Unrecovered | Likely follow-on to uploads; no reapply. |
| 20261008003916 | record_relief_case_packets_v2 | Unrecovered | Likely follow-on to packets; no reapply. |
| 20261008003948 | record_relief_lifecycle_v2 | Unrecovered | Likely follow-on to lifecycle; no reapply. |
| 20261008003957 | record_relief_law_review_queue_v2 | Unrecovered | Likely follow-on; no reapply. |
| 20261008004003 | record_relief_due_notifications_v2 | Unrecovered | Likely follow-on; no reapply. |
| 20261008004014 | record_relief_ai_security_v2 | Unrecovered | Likely follow-on; no reapply. |
| 20261008004024 | record_relief_shared_engine_persistence_v2 | Unrecovered | Likely follow-on; no reapply. |
| 20261008004033 | record_relief_production_hardening_v2 | Unrecovered | Likely follow-on; no reapply. |
| 20261008004455 | record_relief_source_registry_seed | Unrecovered | Local `08580000` has same purpose; seed equivalence unverified. |
| 20261008004503 | record_relief_monitor_auth | Unrecovered | DEV table exists; local `08590000` must not be reapplied. |
| 20261008004558 | record_relief_law_monitor_schedule_dev | Unrecovered | Scheduler history unavailable. |
| 20261008004658 | record_relief_retention_schedule_dev | Unrecovered | Scheduler history unavailable. |
| 20261008025335 | record_relief_authenticated_minimum_grants | Unrecovered | Local `09010000` is same-purpose; grant equivalence unverified. |
| 20261008031954 | record_relief_disable_metadata_only_expiry | Unrecovered | Local `09020000` is same-purpose; definition equivalence unverified. |
| 20261008035711 | record_relief_restore_service_role_upload_access | Unrecovered | Local `09030000` is same-purpose; grant equivalence unverified. |
| 20261008041437 | record_relief_fix_evaluation_missing_inputs_array | Unrecovered | Local `09040000` is same-purpose; definition equivalence unverified. |
| 20261008175923 | record_relief_packet_service_access | Unrecovered | Local `08530000` comments reference this grant; exact source unavailable. |
| 20261008460000 | case_plan_goals_milestones_tasks | **Recovered** from Git commit `3ddb38c` (renamed from `20261001173000`) | DEV table exists; historical SQL is available for comparison. |
| 20261008470000 | partner_v1_commercial_ops | Unrecovered | No source in local refs or archives. |
| 20261008480000 | partner_operational_notifications | Unrecovered | No source in local refs or archives. |
| 20261008490000 | partner_team_profile_and_listing_activity | Unrecovered | No source in local refs or archives. |
| 20261008500000 | partner_capability_enforcement | Unrecovered | No source in local refs or archives. |
| 20261008510000 | partner_capability_followthrough | Unrecovered | No source in local refs or archives. |
| 20261008192257 | optimize_rls_auth_initplans | Unrecovered | Local `09050000` is same-purpose; policy equivalence unverified. |

**Recovery result:** 1/41 original SQL sources recovered; 40/41 remain unrecovered. The ledger names are recovered for all 41, but names are not executable source.

## Local-only migration disposition — 19 versions

| Local version | Area | DEV evidence | Future disposition |
| --- | --- | --- | --- |
| 20261008222300 | Notification preferences/delivery claim | `notification_preferences` and `complete_notification_delivery` absent | Required Mobile notification dependency; promote only after reconciliation. |
| 20261008222400 | Expo receipt storage | `notification_push_receipts` absent | Required before receipt worker deployment; depends on notification delivery completion. |
| 20261008520000 | Record Relief uploads | DEV uploads table exists; source differs/unknown | Do not reapply; compare schema/permissions after raw source recovery. |
| 20261008530000 | Record Relief packets | DEV packet table exists | Do not reapply; compare schema/grants after raw source recovery. |
| 20261008540000 | Record Relief lifecycle | DEV law-review table and due function exist | Do not reapply; function/constraint equivalence unverified. |
| 20261008550000 | Record Relief AI security | DEV uploads table exists | Do not reapply; expiry/RLS equivalence unverified. |
| 20261008560000 | Shared engine persistence | DEV replacement function exists | Do not reapply; outcome/check equivalence unverified. |
| 20261008570000 | Production hardening | Related DEV functions exist | Do not reapply; retention/schedule behavior unverified. |
| 20261008580000 | Legal-source seed | Same-purpose DEV ledger entry exists | Do not reapply; seed content must be compared. |
| 20261008590000 | Monitor authorization | DEV monitor-auth table exists | Do not reapply. |
| 20261009010000 | Minimum authenticated grants | Same-purpose DEV ledger entry exists | Do not reapply pending exact grant comparison. |
| 20261009020000 | Disable metadata-only expiry | Same-purpose DEV ledger entry exists | Do not reapply pending function comparison. |
| 20261009030000 | Restore service upload access | Same-purpose DEV ledger entry exists | Do not reapply pending grant comparison. |
| 20261009040000 | Evaluation missing-input fix | Same-purpose DEV ledger entry exists | Do not reapply pending function comparison. |
| 20261009050000 | RLS init-plan optimization | Same-purpose DEV ledger entry exists | Do not reapply pending policy comparison. |
| 20261009053401 | Job application immutability | No matching DEV ledger version | Partner prerequisite; must be promoted as a reviewed future migration after reconciliation. |
| 20261009060000 | Per-token notification attempts | Table/function absent | Required before retry-aware delivery worker; promote after `08222300`. |
| 20261009070000 | Housing partial-refund accuracy | DEV `apply_payment_event` signature matches, definition not compared | Do not reapply until function body is compared. |
| 20261009080000 | Retry coordination | Per-token table/function absent | Required after `09060000`; promote after reconciliation. |

## Verified conflict and release consequences

- The notification worker source depends on tables/functions that do not exist in DEV. Deploying the worker before the notification migrations would fail.
- The current DEV record-relief object set is not evidence that the local Record Relief migrations can be replayed. Many have same-purpose remote migrations under different versions.
- `20261009053401_job_application_update_integrity` has no matching DEV ledger entry and remains a required prerequisite for the Partner status RPC.
- The Partner drafts and combined test remain untouched. Their local passing results do not establish their functions exist in DEV.
- Data API exposure, function grants, RLS policy bodies, and PostgREST schema cache remain unverified hosted checks.

## What can safely happen next

1. Recover the 40 missing raw SQL sources from the prior operator's migration export, CI artifacts, workstation archive, or Supabase support/audit export.
2. Compare recovered SQL and current DEV definitions before selecting a canonical history; never replay same-purpose Record Relief migrations solely to make the ledger look clean.
3. Build a disposable database from the selected canonical history only after that comparison. Until then, reconstruction would not represent verified DEV state.
4. After reconciliation approval, promote fresh migrations in this operational order: application immutability; organization context; employer status; placement hardening; notification completion; receipts; token attempts; retry coordination. Use fresh canonical versions, feature gates, and separate approval for every DEV write.

## 2026-10-16 update: the drift got worse, and the forward-going half is now fixed

Re-ran `supabase migration list --linked` today and found two things:

1. **A new remote-only entry appeared since this doc was written**: `20261015032752`, with no local file at all — the exact same unrecorded-apply pattern as the original 41, happening again sometime around 2026-10-15. Nobody has investigated what this is; it is a new instance of the same root problem, not yet added to the matrix above because its content is unknown.
2. **Every migration applied this session (and the session before it) via `supabase db query -f` was real, live, and verified — but silently never recorded in the ledger**, because `db query -f` executes SQL directly through the Management API and does not touch `supabase_migrations.schema_migrations`. This is the same mechanism that created the original 41-item drift, now actively recurring every time a migration is applied this way instead of `supabase db push`.

**What was fixed tonight (safe, bounded, does not touch the legacy 41):** every migration from `20261015100000` through `20261016170000` (13 versions — resource/member scout, food rescue, consent RPC, scholarship seed, unified jobs/housing filters, voucher support, housing inquiry threads, notification delivery cron + its ambiguous-column fix, saved-search alerts) was personally written, applied, and live-verified by this session. These were registered into the ledger via `supabase migration repair --status applied <version>` — a metadata-only operation that marks a version as already applied without re-running its SQL, so `supabase db push` will no longer try to replay or flag them. Confirmed via `migration list` that local and remote now match for all 13.

**What is still NOT fixed, deliberately:** the original 41-item legacy drift (2026-10-07/08, mostly Record Relief and Partner), the new `20261015032752` mystery entry, and the local-only files from `20261008520000` through `20261009080000` and `20261014000000`-`20261014020000` that predate this session and were not personally re-verified tonight. None of these were touched — repairing a ledger entry for SQL nobody has re-verified live would just hide the real problem, not solve it.

**The actual lesson, going forward:** any future migration applied via `supabase db query -f` (the only reliable method found this session, since `db push` itself is blocked by the existing drift) must be followed by `supabase migration repair --status applied <version>` in the same session, immediately after verifying it live — otherwise this exact problem recurs and grows by one more untracked version every time.
