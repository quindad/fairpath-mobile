# FairPath proposed backend rollout reconciliation — 2026-10-09

**UNAPPLIED — approval required.** No DEV/production ledger verified.

## Order and dependencies
1. Confirm all historical migrations applied to approved DEV, including `20261007140000_organization_capabilities.sql`, `20261007100000_job_applications_organization_access.sql`, `20261007110000_job_placements.sql`, and `20261009053401_job_application_update_integrity.sql`. Do not duplicate the integrity trigger.
2. Review and approve `docs/proposed-migrations/20261009093000_partner_job_application_status_RPC_DRAFT.sql`. This revokes authenticated direct application UPDATE and introduces `partner_update_job_application_status(uuid,text)`. Ensure direct member withdrawal remains possible through `withdraw_job_application(uuid)`. The status progression is proposed product policy, not yet approved.
3. Review and approve `docs/proposed-migrations/20261009094000_partner_org_context_RPC_DRAFT.sql`. It exposes zero-argument `partner_org_context()` with membership-scoped organization rows, roles[], and active capabilities[].
4. Address placement RPC authorization: existing `partner_record_placement` accepts `v_job.employer_id = auth.uid()` even for org-owned jobs, and does not require active employment capability or active org. Draft a narrow correction before rollout.
5. Validate on isolated PostgreSQL and then approved DEV with explicit authorization. Confirm Data API exposure, grants, RLS, migration ledger, SSR auth, audit events, and placement evidence. Only then coordinate Freebuff's UI wiring.

## Local verification
- PGlite available at system temp path (no hosted DB needed).
- `node scripts/test-local-partner-contracts.mjs`: 5/5 passed, executing both drafts in PGlite against migration history.
- `node scripts/test-partner-org-context-contract.mjs`: 17 static checks passed.
- `node scripts/test-partner-job-status-contract.mjs`: 17 static checks passed.
- `node scripts/audit-security.mjs`: passed across 95 migrations (prior run).
- Remaining: full authorized status-transition matrix and placement evidence regression coverage; DEV state unverified.
## Follow-up verification
- Expanded PGlite integration: `node scripts/test-local-partner-contracts.mjs` **12/12 passed** (actual SQL for org-context and employer status RPCs).
- Covered status progression, rejection, terminal transitions, editor/outsider/removed-member denial, revoked employment capability, legacy employer, immutability, withdrawal, and event trail.
- `node scripts/test-local-org-ownership.mjs`: **7/7 passed**.
- Jobs audit and security audit passed (95 migrations).
- TypeScript invoked; final exit status must be collected before marking passed.
- Outstanding: explicit cross-organization manager attempted status mutation (existing test covers other unauthorized roles), comprehensive audit-event actor assertion, placement authorization patch coordinated with Super Mardo, DEV ledger and external provider proof.

## ATS security sign-off follow-up
- `node scripts/test-local-partner-contracts.mjs`: **17/17 PGlite tests passed** (exit 0). Includes active-org/capability isolation, cross-org manager, suspended org, removed manager, direct UPDATE denial, transition event actor/order, withdrawal, legacy employer.
- Prior combined `node scripts/audit-jobs.mjs`, `node scripts/audit-security.mjs`, `node scripts/test-local-org-ownership.mjs`, `npx tsc --noEmit --pretty false`: exit **0**; Jobs audit passed, security audit passed (95 migrations), org ownership 7/7, TypeScript clean.
- Placement hardening draft exists: `docs/proposed-migrations/20261009095000_partner_record_placement_hardening_DRAFT.sql` (Super Mardo ownership; not modified here). Review dependencies and run placement-specific tests before any migration approval.
- Partner integration: `supabase.rpc('partner_org_context')` returns organization_id, organization_name, roles[], capabilities[]. Status RPC: `supabase.rpc('partner_update_job_application_status',{p_application_id,p_status})`. Both **proposed and unapplied**; client must keep unavailable state until authorized rollout. No hosted DB proof yet.

## Consolidated three-draft review (Mardo)
Status: NO-GO for hosted deployment until DEV ledger, API grants, SSR read paths and approvals are verified. All drafts remain unapplied.
- Proposed filename order: 093000 status, 094000 context, 095000 placement. Status/context have no direct SQL dependency on one another. Placement depends on canonical placements and org capability tables; status assumes 20261009053401 immutable-field trigger.
- Placement draft inspected read-only: org jobs require active owner/manager membership, active organization, active employment capability. Legacy employer_id only for individual jobs. Immutable hire evidence guard included. Super Mardo reports 5/5 placement tests; no edits to his files.
- Status RPC revokes direct authenticated UPDATE. Validate other consumers including withdrawal in approved end-to-end tests.
- Canonical organization_capabilities migration REVOKES ALL authenticated table privileges; Freebuff's direct three-table resolver cannot assume SELECT works. Use proposed SECURITY DEFINER partner_org_context RPC with fail-closed feature gate.
- job_application_events records status changes (submitted/status_changed/withdrawn), actor and from/to statuses; not interview appointments, notes or offer documents.
- ATS child-table organization scoping requires verified joins to parent jobs, not assumptions that every child table has organization_id. Verify Data API grants, RLS and SSR reads in DEV.
- Approval gates: read-only DEV migration ledger; isolated combined 3-draft test; approved DEV dry-run; Data API/RLS; authenticated org A/B isolation; employer status/withdrawal; hired-to-placement evidence; explicit release authorization. No production rollout approval.

## Combined three-draft isolated integration (Mardo)
- Added `scripts/test-local-partner-combined.mjs` (new Mardo-owned test; no other agent files modified). Applies proposed 093000 status, 094000 context, and 095000 placement migrations together, in timestamp order, on an isolated PGlite DB after canonical migrations.
- `node scripts/test-local-partner-combined.mjs`: **5/5 PASS**, exit 0. Covers active manager context, job creator without membership, cross-org manager, removed manager, suspended org, revoked capability (both status and placement), submitted->viewed->interview->offer->hired with exact actor/status audit sequence, idempotent durable placement, authenticated direct UPDATE denial for application and placement.
- Fresh separate regressions: Partner RPCs **17/17 PASS**, placement security **5/5 PASS**, organization ownership **7/7 PASS**, Jobs audit **PASS**, security audit **PASS** (95 canonical migrations); combined regression command exit **0**.
- **NO-GO hosted deployment:** no read-only DEV migration ledger confirmation; no hosted Data API/RLS/SSR signed-in verification; no authorized DEV dry run or release approval. No commits, pushes, deployments, DEV/production migrations or data changes.

## Read-only grant/RLS audit correction and Freebuff integration gates
- **Correction to earlier note:** `20261007140000_organization_capabilities.sql` first REVOKEs ALL but subsequently explicitly `GRANT SELECT ... TO authenticated` (line 41). Its SELECT RLS permits active members of the organization. Therefore the direct three-table resolver is **not categorically blocked by missing capability SELECT privileges**. The `partner_org_context()` RPC remains a recommended single-call, fail-closed, consistent adapter, not a prerequisite merely for grant access. Correct prior statements before forwarding to Freebuff.
- `organization_members` has authenticated SELECT and own-user RLS; `resource_organizations` has authenticated SELECT and active-membership RLS from `20261005110000_organization_read_for_own_members.sql`; `organization_capabilities` has authenticated SELECT and active-membership RLS. Confirm on hosted DEV ledger before asserting live.
- `job_application_events` authenticated SELECT and org-job SELECT policy exist (`20260926130000` and `20261007100000`). `job_placements` authenticated SELECT and org membership read policy exist (`20261007110000`). Read policies are membership-based, not always active-org/active-capability-based; Partner UI must apply workspace eligibility and backend mutations must enforce stronger role/capability checks. Review whether suspended org members should retain read access as a product/privacy decision.
- The canonical events schema uses `applicant_id`, `job_id`, `application_id` and lacks a direct organization_id; use parent job ownership for scoped reads. `job_placements` has organization_id. Do not infer scheduling/offer-document/note records from events.
- **Hosted DEV authorization test plan (not executed):** confirm ledger and schema/grants; sign in active org A manager, org B manager, editor, removed member, suspended org manager, revoked-capability manager, and legacy employer; verify organization selection, RLS-scoped jobs/applications/events/placements; verify no cross-tenant reads; verify status RPC transitions and immutable evidence; verify placement RPC and duplicate ID; verify withdrawal; capture request IDs, results, and audit trail. Use synthetic data and obtain explicit approval before any hosted writes.
- Release decision remains **NO-GO**: DEV ledger and authenticated Data API/SSR tests unverified; migration dry run and release approval absent.
