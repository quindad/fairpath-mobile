# FairPath Employer ATS Backend Contract — 2026-10-09

Status: source-code audit, NOT deployed-schema verification. Freebuff should use this contract; no migrations applied.

## Canonical tables
- resource_organizations: id, name, org_type (descriptive), status
- organization_members: organization_id, user_id, member_role (owner/manager/editor), status (invited/active/removed)
- organization_capabilities: organization_id, capability (employment/housing/case_management), status (active/revoked). Staff-managed.
- jobs: id, employer_id, nullable organization_id, title, company_name, status, application_method, application_questions and other fields.
- job_applications: id, user_id, job_id, status, answers, submitted_at, updated_at
- job_application_events: trigger-written audit history; read-only to clients.

## Integration rules
1. Use user-scoped Supabase Auth, never service-role in browser.
2. Resolve active organization membership and active employment capability separately; org_type is not authorization.
3. List jobs filtered by organization_id, enforced by database RLS.
4. Submit member applications using submit_job_application(p_job_id, p_answers); withdraw via withdraw_job_application(p_application_id). Do not insert directly.
5. Read org applications and trigger-generated events only through RLS; show only submitted application fields, never justice-history data.
6. Current org application update policy permits statuses viewed/interview/offer/hired/rejected. Do not enable status writes until the findings below are resolved.

## Security blockers identified by code inspection
HIGH: Migration 20261007100000_job_applications_organization_access.sql creates a permissive UPDATE policy on job_applications. Its WITH CHECK verifies destination status and org membership but does not enforce immutability of user_id, job_id, answers or submitted_at. RLS alone cannot compare OLD and NEW row values. Inspect column privileges and triggers; prefer a narrowly scoped status-update RPC with server-side transition validation and immutable fields. Verify against real DEV RLS tests before enabling Partner writes.

CAPABILITY: Existing org jobs and applications policies check membership/role but do not visibly check active employment capability. UI hiding alone is not a security boundary. Confirm desired enforcement and add server-side authorization.

TRANSITIONS: Current policy lists valid destination statuses but does not itself prevent invalid status transitions or reversal from terminal statuses. Test and enforce.

ORG TRANSFER: Test attempts to reassign jobs.organization_id, including to NULL, and ensure they cannot bypass ownership checks.

## Required regression tests
Org A cannot access Org B applications/events; invited/removed members denied; editor cannot change statuses; managers cannot rewrite applicant identity, job_id, answers or submitted_at; revoked capability denied where required; terminal transitions controlled; event history append-only; individual legacy jobs unaffected.

## Audited migration sources
20260901000000_baseline_tables.sql
20260926130000_jobs_search_and_applications.sql
20261001100000_resources_core.sql
20261004110000_jobs_housing_organization_ownership.sql
20261007100000_job_applications_organization_access.sql
20261007140000_organization_capabilities.sql

Do not assume these migrations are deployed. Compare live DEV schema read-only before changes.


## October 9 follow-up: proposed write hardening (NOT DEPLOYED)
Draft: `docs/proposed-migrations/20261009093000_partner_job_application_status_RPC_DRAFT.sql`.
RPC: `partner_update_job_application_status(p_application_id uuid, p_status text)`.
Authenticated browser clients must call the RPC instead of updating `job_applications` directly. The proposed SQL revokes table UPDATE, removes legacy and organization UPDATE policies, validates active org membership, owner/manager role, active employment capability and transitions, and preserves `withdraw_job_application` as SECURITY DEFINER. For individual-owned jobs (`organization_id IS NULL`), the existing employer_id path is preserved. Existing trigger `job_applications_log_status` records events.

Proposed transitions: submitted -> viewed/rejected; viewed -> interview/rejected; interview -> offer/rejected; offer -> hired/rejected. Withdrawn, hired and rejected are terminal for employer transitions. This is a product proposal requiring approval, not a previously verified rule.

Security caveats: `20261009053401_job_application_update_integrity.sql` is present locally and untracked; it has not been verified as applied. This RPC is a draft only. Real Postgres tests must prove role, RLS, revoked grants, event actor, rollback behavior, service-role privileges, cross-org access and actual withdrawal before deployment. Verify whether `revoke update` affects other authenticated workflows and whether Supabase/PostgREST role grants have changed. The placement RPC `partner_record_placement` should be audited for capability checks separately.

Static test: `node scripts/test-partner-job-status-contract.mjs` (17 checks); `node scripts/audit-jobs.mjs` passed. Static checks cannot validate live SQL semantics or RLS.

Freebuff: use this RPC for employer pipeline mutations after approved migration deployment; never direct `from('job_applications').update(...)`. Do not implement an optimistic write UI against an un-applied draft. Continue reading applications through user-scoped RLS.


## Partner organization context RPC (PROPOSED; NOT APPLIED)

Draft SQL: `docs/proposed-migrations/20261009094000_partner_org_context_RPC_DRAFT.sql`

Exact function: `public.partner_org_context()` — zero arguments, `STABLE SECURITY DEFINER`, `search_path = public`, execute granted to `authenticated` and `service_role`; revoked from `public` and `anon`.

Returns **one row per active organization membership** (zero rows for signed-out/no active org), ordered by organization name and ID:

```ts
type PartnerOrgContextRow = {
  organization_id: string;      // uuid
  organization_name: string;
  roles: ('owner' | 'manager' | 'editor')[];
  capabilities: ('employment' | 'housing' | 'case_management')[];
};
const { data, error } = await supabase.rpc('partner_org_context');
```

A membership is a single role in the current schema; `roles` is a one-element array for compatibility with Freebuff's requested response shape. Multiple memberships return multiple rows. `capabilities` contains only active staff-granted capability rows and can be empty. It is never derived from `roles` or `org_type`. The function takes no user_id; `auth.uid()` scopes results. No organization can be requested by an arbitrary client-provided ID.

**Freebuff:** use the returned rows for the organization picker and session-scoped navigation. Select an active org only from those rows. Treat an empty capability list as no workspace capabilities. Do not trust locally derived role-to-capability mappings as authority. This is a proposed RPC and is unavailable until approved and applied.

Static checks: `node scripts/test-partner-org-context-contract.mjs` (17 checks). The current security audit passed 95 migrations. **Not yet verified in PostgreSQL**: RLS/security-definer semantics, role membership, suspended/revoked cases, anonymous invocation, multiple-org result behavior, actual Supabase SSR invocation. No DEV or production changes made.
