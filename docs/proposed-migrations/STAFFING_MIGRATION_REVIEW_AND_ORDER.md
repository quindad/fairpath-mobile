# Staffing migration dependency and review — all drafts as one system

Covers both draft files together: `20261021100000_staffing_architecture_DRAFT.sql` and
`20261022100000_staffing_audit_ratecards_provider_events_DRAFT.sql`. **Neither is applied.** This document is what
gets read before approval, so the application order and reasoning are settled in advance.

## Application order, if and when approved

1. `jobs.listing_kind` column (part of file 1) — additive, default-valued, zero dependents yet.
2. `staffing_requisitions` — depends only on `jobs` and `resource_organizations`.
3. `staffing_assignments` — depends on `job_placements` (already live) and `staffing_requisitions` (step 2).
4. `staffing_assignment_status_history`, `staffing_provider_state`, `staffing_screening_state`,
   `staffing_rate_cards`, `staffing_economics` — all depend only on `staffing_assignments` (step 3); order among
   these five does not matter.
5. `staffing_audit_log` — references `staffing_assignments` and `staffing_requisitions` (nullable FKs), so it must
   come after steps 2–3 but has no dependents itself.
6. `staffing_rate_card_templates` — depends only on `resource_organizations`; could apply any time after step 1,
   listed here for file-order clarity since it ships in the second draft file.
7. `staffing_provider_events` — depends on `staffing_assignments` (step 3).

File 1 must be fully applied before file 2. Within file 1, the order above (1 → 2 → 3 → 4) is required; within
file 2, order does not matter beyond both depending on file 1 being applied first.

## Checklist, reviewed across every table in both drafts

| Check | Finding |
|---|---|
| **Foreign keys** | Every table's FKs trace back to either an existing table (`jobs`, `job_placements`, `resource_organizations`, `auth.users`) or another staffing table created earlier in the order above. No orphaned references. |
| **Unique constraints** | `staffing_assignments.placement_id` is unique (enforces the 1:1 extension of `job_placements`). `staffing_provider_events.event_id` is the primary key (enforces idempotency at the database level, not just in application code). |
| **Indexes** | Every table has at least one index supporting its primary RLS lookup path (by `assignment_id`, `requisition_id`, or `client_organization_id`) to keep policy evaluation from scanning. |
| **Tenant boundaries** | Client/employer isolation goes through `organization_members` the same way `job_placements`' existing employer policy does — never a bare `employer_id` comparison without the organization-membership check. |
| **Service-role boundaries** | `staffing_rate_cards`, `staffing_economics`, `staffing_rate_card_templates`, and `staffing_audit_log` have **no authenticated policy at all** — confirmed by re-reading both files; only `grant ... to service_role` appears for these four. |
| **Timestamps** | Every table has `created_at`; mutable tables (`staffing_requisitions`, `staffing_assignments`, `staffing_provider_state`, `staffing_screening_state`) also have `updated_at`. |
| **History/event retention** | `staffing_assignment_status_history` and `staffing_audit_log` are both append-only (the latter enforced by a trigger, matching `entitlement_audit_log`'s pattern exactly). `staffing_economics` keeps a row per computation rather than overwriting, so a rate change's history is preserved. |
| **Idempotency** | `staffing_provider_events.event_id` as primary key is the server-side backstop for the idempotency `provider-events.ts` already implements in memory. A duplicate insert fails at the database level even if application logic had a bug. |
| **Provider references** | `staffing_provider_state.provider_ref` and `staffing_screening_state.provider_ref` are opaque text, never exposed through any authenticated policy — a member's own-assignment read policy on these two tables should be revisited before application: as drafted it exposes the whole row including `provider_ref`. **Flagged below as needing a narrower member view before approval.** |
| **Deletion behavior** | All staffing FKs to `staffing_assignments` cascade on delete, matching `job_placements`' existing cascade behavior, so deleting a placement cleanly removes its staffing extension. `staffing_requisitions` cascades from `jobs`. Nothing silently orphans. |
| **Member access** | Exactly one SELECT policy on `staffing_assignments` keyed to `job_placements.person_id = auth.uid()`; same pattern extended to `staffing_assignment_status_history`. No member policy exists on any financial table. |
| **Employer access** | Exactly one SELECT policy on `staffing_requisitions` and `staffing_assignments` keyed through `organization_members`, mirroring `job_placements_read_own_as_employer`. No employer policy exists on any financial or provider table. |
| **Ops access** | No dedicated "ops" authenticated role exists yet in this schema (the Command Center foundation's `staff_users` table is service-role-checked, not a Postgres role). Financial and audit tables being service-role-only is correct for now; a future ops read path should go through a `security definer` function that checks `staff_users`, the same pattern `fairpath_plus_status()` uses, not a direct authenticated grant. |
| **Financial isolation** | Confirmed: `staffing_rate_cards`, `staffing_economics`, `staffing_rate_card_templates` carry zero authenticated-role grants in either draft file. |

## One finding that needs resolution before this is approved

**`staffing_provider_state` and `staffing_screening_state`'s member-read policy exposes `provider_ref`.** The member
should see only the small `state` enum (what `ui-contract.ts`'s `ScreeningStatus`/`OnboardingStatus` components
render), never the opaque provider reference string. Before approval, split these into the full table (service-role
only) plus a narrow view or column-level grant exposing `assignment_id` and `state` only to the member's own row.
This was not caught in the first draft's review and should be fixed there, not worked around at the application
layer, since RLS is the actual security boundary.

## What becomes live if and when this is applied

- `jobs.listing_kind` — the one field the Jobs/Explore contract (`jobs-integration.ts`) is waiting on.
- A real `staffing_assignments` row per placement, extending `job_placements`.
- Real FoxHire/Checkr state tracking, once the readiness questions in `CHECKR_INTEGRATION_READINESS.md` /
  `FOXHIRE_INTEGRATION_READINESS.md` are answered and the adapters get real transports.
- Real audit trail and rate-card history for the eventual Command Center ops workspace.

Nothing above is applied today. This document exists so approval, when it comes, is a review of this document and
the finding above — not a re-derivation of the whole schema from scratch.
