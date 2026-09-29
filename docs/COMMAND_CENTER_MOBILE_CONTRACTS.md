# Command Center ↔ Mobile contracts

Documentation only — no Command Center code exists or is being built here. This maps every Mobile workflow to the
Partner or Admin counterpart it will eventually need, using tables/functions that already exist in the DEV schema
where possible, so the future build stays additive instead of duplicating backend logic.

## PARTNER WORKSPACE

| Mobile workflow | Partner counterpart needed | Existing backend to build on |
|---|---|---|
| Job application submitted (`submit_job_application`) | Employer reviews applications, changes status, messages applicant | `jobs`, `job_applications`, `job_application_events` (audit trail already exists) |
| Job posting (currently DEV-seeded only) | Employer creates/edits/closes postings | `jobs` table exists; needs an employer-facing write path with its own RLS (today only service-role writes) |
| Housing application (Standard + FastTrack) | Landlord/property manager reviews, approves/denies, requests documents | `housing_applications`, `housing_application_events`, `housing_application_documents` |
| Housing listing (currently DEV-seeded only) | Landlord creates/edits/closes listings, sets FastTrack eligibility | `housing_listings`; same gap as Jobs — no partner write path exists yet |
| Housing inquiry / tour request | Landlord responds, sets status | `housing_inquiries` already has real state columns (`received_at`/`seen_at`/`reply_read_at`) and server functions (`partner_acknowledge_housing_inquiry`, `partner_reply_housing_inquiry`) — **this one is already partly built for a partner-side actor**, just has no UI yet |
| Housing listing report (`housing_reports`) | Landlord sees reports against their own listings | Table exists; no partner read path |
| Resource submission (future: partner-submitted resources) | Reentry org/caseworker submits a resource for FairPath verification | No submission path exists yet; Resources today is FairPath-authored only |
| Meeting scheduled with a caseworker | Caseworker's own view of their scheduled meetings | `member_meetings` is member-owned only; no caseworker-side entity exists |

## ADMIN WORKSPACE

| Mobile workflow | Admin counterpart needed | Existing backend to build on |
|---|---|---|
| Resource report / flag | Verification queue: review, republish, unpublish | Resources' verification model already exists and is in active use — this is the most Command-Center-ready module in the app |
| Early Access waitlist enrollment | Coverage-market management: view enrollment counts per market, change status, trigger `activate_coverage_market` | **Directly ready** — `coverage_markets`, `market_waitlist_enrollments`, `upsert_coverage_market()`, `activate_coverage_market()` all exist and are service-role-only by design, i.e. already shaped as an admin action |
| Record Relief rule display | Legal-rule verification/versioning workspace: draft → verify → publish, effective-date scheduling, staleness alerts | `record_relief_rules`/`record_relief_jurisdictions`/`record_relief_forms` already have `status` (draft/verified), `last_verified_at`, `rule_version`, `effective_from`/`effective_to` — schema is admin-ready, no admin UI exists |
| FairPath+ entitlement grants (correctional/promo/admin/early-access) | Entitlement/campaign management: issue, revoke, extend, audit | `issue_entitlement_grant`, `revoke_entitlement_grant`, `extend_entitlement_grant`, `entitlement_audit_log` — **fully built, service-role only, directly Command-Center-ready today** |
| Privacy deletion request | Admin support/privacy workflow: process, confirm, log | `/privacy` deletion request exists member-side; no admin processing view exists |
| Credit report upload + extraction | Support/moderation: none identified — extraction is member-private by design, likely should NOT get an admin view (privacy boundary should probably stay member-only even in Command Center) |
| Job/Housing inventory (once real sources exist) | Integrations dashboard: source health, last sync, error counts | `opportunity_sources`, `opportunity_ingestion_runs` already model exactly this — dormant but schema-ready |
| Push/email/SMS delivery | Notification-delivery monitoring: sent/failed counts, retry | `notification_deliveries` already has `status`/`attempts`/`error` — schema-ready, no consumer exists yet |

## Exact action contracts (built from tonight's launch-closure findings)

For every row: MOBILE ACTION → SERVER OBJECT → COUNTERPART → PERMISSION REQUIRED → AUDIT EVENT → NOTIFICATION EVENT
(see `src/core/notifications/events.ts` for the canonical event IDs referenced here).

### Admin surfaces

| Mobile action | Server object | Admin counterpart | Permission | Audit event | Notification event |
|---|---|---|---|---|---|
| Member joins Early Access | `market_waitlist_enrollments` (`join_early_access`) | Coverage Markets: view enrollment counts/list per market | `admin.coverage:read` | none today — should log to a future `admin_audit_log` | none (member-facing only) |
| Admin activates a market | `activate_coverage_market()` | Coverage Markets: activation button, dry-run preview of affected members | `admin.coverage:write` | `entitlement_audit_log` (already fires: `grant_issued`) | `MARKET_OPENED`, `EARLY_ACCESS_GRANTED` |
| Admin grants/revokes FairPath+ | `issue_entitlement_grant`/`revoke_entitlement_grant`/`extend_entitlement_grant` | FairPath+ Campaigns / Entitlements | `admin.entitlements:write` | `entitlement_audit_log` (already fires) | `EARLY_ACCESS_GRANTED` or none (revocation should probably notify too — not built) |
| Member reports a resource | `resource_reports` (confirmed: `supabase/migrations/20261001120000_resources_member_state.sql`) | Resource Reports queue: REPORT RECEIVED → REVIEW NEEDED → VERIFIED CORRECT / UPDATED / TEMPORARILY UNAVAILABLE / RETIRED | `admin.resources:write` | none today | none today |
| Member uploads/edits Record Relief case | `record_relief_cases`/`record_relief_evaluations` | Record Relief Research/Review/Publishing: DRAFT → RESEARCHED → REVIEW_REQUIRED → VERIFIED → PUBLISHED → STALE → SUPERSEDED → RETIRED (see `RECORD_RELIEF_DATA_OPERATIONS.md`) | `admin.legal:research` / `admin.legal:review` / `admin.legal:publish` (three distinct permissions — publish must never equal research) | none today — should log every state transition | `RECORD_RELIEF_DATE` for affected members once published |
| Job/Housing listing ingested | `external_opportunities`/`opportunity_ingestion_runs` (dormant pipeline) | Jobs/Housing Import Health: per-source fetch/create/update/error counts, last sync | `admin.ingestion:read` | `opportunity_ingestion_runs` already models this if populated | `NEW_MATCHING_JOB`/`NEW_MATCHING_HOUSING` for matching saved searches |
| Member requests account deletion | `/privacy` deletion request (existing) | Privacy/Delete Requests queue | `admin.privacy:write` | none today — should be append-only like `entitlement_audit_log` | none (confirmation is in-app) |
| Push/email/SMS delivery attempted | `notification_deliveries` | Notification Operations: sent/failed/pending counts, retry | `admin.notifications:read` | `notification_deliveries.status`/`attempts`/`error` already model this | n/a (this IS the delivery layer) |
| DEV integration-health screen (mobile, tonight) | live Supabase queries, no new table | Integration Health (admin equivalent, cross-environment) | `admin.integrations:read` | none needed (read-only) | none |

### Partner surfaces

| Mobile action | Server object | Partner counterpart | Permission | Audit event | Notification event |
|---|---|---|---|---|---|
| Member applies to a job | `submit_job_application`, `job_applications`, `job_application_events` | Employer: Applicants list, Application Review, status change | `partner.jobs:write`, already RLS-scoped to `jobs.employer_id = auth.uid()` — **working today**, needs UI + employer identity/verification, not new ownership plumbing | `job_application_events` already fires | `APPLICATION_UPDATED` |
| Member applies to housing | `housing_applications`, `housing_application_events` | Landlord: Housing Applications, review, approve/deny | `partner.housing:write`, scoped to `housing_listings.owner_id = auth.uid()` — **working today**, same UI/identity gap as Jobs | `housing_application_events` already fires | `HOUSING_APPLICATION_UPDATED` |
| Member sends a housing inquiry/tour request | `housing_inquiries`, `housing_tour_requests` | Landlord: Housing Messaging | `partner.housing:write` | none today | `INQUIRY_RESPONSE` |
| Landlord replies to an inquiry | `partner_acknowledge_housing_inquiry`, `partner_reply_housing_inquiry` (**already built, no UI**) | Landlord: Housing Messaging reply box | `partner.housing:write` | none today | `INQUIRY_RESPONSE` |
| Caseworker schedules a meeting with a member | no partner-side table exists — `member_meetings` is member-owned only | Reentry Org: Caseload, Meetings | `partner.caseload:write` (**entire caseworker-org concept does not exist in schema**) | none | `MEETING_REMINDER` |

## Permission model note — MAJOR CORRECTION from an earlier draft of this doc

An earlier version of this document claimed "the entire employer/landlord ownership concept doesn't exist in the
schema." That was wrong, and matters enough to correct prominently rather than quietly: it was based on this
session's own earlier, incorrect finding in `EXTERNAL_INTEGRATION_REGISTER.md` ("Jobs/Housing listings are
entirely service-role/seed-written, no partner write path exists"), which was itself never re-verified before
being repeated here. Checking the actual RLS policies this time:

- `jobs.employer_id` and `housing_listings.owner_id` are **real, FK-constrained columns referencing
  `auth.users(id)`** — not placeholders.
- Both tables already have **working owner-scoped RLS**: `authenticated` users can already `insert`/`update`/
  `delete` `jobs`/`housing_listings` rows where they are the `employer_id`/`owner_id` (policies "Employers create/
  update/delete own jobs", "Owners create/update/delete housing").
- `job_applications` already has an **"Employers read applications for own jobs"** policy, and an update policy
  that even enforces the valid status transitions an employer may set (`viewed`/`interview`/`offer`/`hired`/
  `rejected`) at the RLS layer, not just in application code.

**What this actually means:** the raw ownership/permission plumbing for a Jobs Partner workspace is already
built and working today — any authenticated user can already act as an employer for their own postings via
direct table access, fully RLS-scoped. **What's still missing is UI and identity/verification** (there's no
"become a verified employer" onboarding flow, no employer profile, no way to distinguish a verified real employer
from any signed-in member who happened to insert a jobs row) — that's real work, but meaningfully smaller than
building ownership from scratch. Housing's equivalent inquiry-reply functions (`partner_acknowledge_housing_inquiry`,
`partner_reply_housing_inquiry`) already assume this same owner-identity model.
Caseworker/reentry-org caseload is the one workflow in this table where no such foundation exists at all — that
one genuinely needs an organization/caseload concept built from scratch.

## Cross-cutting notes for the future build

- Several of the "admin-ready" rows above (Early Access, entitlements, Record Relief rule status) are **already
  gated service-role-only** in the current schema — meaning Command Center's admin actions can call the exact
  same functions Mobile's backend already uses, with zero new backend logic, only a UI and an admin auth/role
  layer on top.
- **Corrected this pass:** Jobs and Housing already have real, owner-scoped RLS write access (see the permission
  model note above) — the Partner workspace gap is UI + identity/verification, not backend ownership plumbing.
  The caseworker/reentry-org caseload workflow is the one genuine from-scratch design gap in Partner.
- Housing inquiries are the one partner-facing flow already partially built (state columns + server functions
  exist) — worth using as the reference pattern for how partner actions should be shaped when the rest get built.
