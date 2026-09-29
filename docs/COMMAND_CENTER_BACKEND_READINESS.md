# Command Center backend readiness matrix

CAPABILITY | MOBILE OBJECT | BACKEND OBJECT | PARTNER NEED | ADMIN NEED | CURRENT SECURITY | STATUS

## MAJOR CORRECTION (found during the Resources data-operations deep pass)

An earlier version of this document, and `MOBILE_BUILD_EXIT_CRITERIA.md`, both stated "there is no Organization
concept anywhere in the schema at all" and called it the single largest piece of net-new Partner design work.
**That was wrong.** `resource_organizations` + `organization_members` (`20261001100000_resources_core.sql`) is a
real, working, RLS-enabled multi-tenant organization model: `resource_organizations.org_type` is a CHECK-
constrained enum that **already includes `'employer'`** alongside `'government'`/`'nonprofit'`/`'faith'`/
`'provider'`/`'other'`, and `organization_members` has real role-based membership (`owner`/`manager`/`editor`)
with invite/active/removed status and a membership-check helper function. This was built for Resources but is
generic enough to extend, not rebuild.

**What this actually changes:** extending this to Employer/Landlord/Reentry-Org identity is (1) add `'landlord'`
and `'reentry_org'` to the `org_type` enum (one-line CHECK constraint change), and (2) add an `organization_id`
FK to `jobs` and `housing_listings` alongside their existing `employer_id`/`owner_id` columns (currently those
point directly to `auth.users`, not to an org) — real, scoped, additive work, not a from-scratch design project.
The genuinely-missing piece is smaller than previously stated: linking Jobs/Housing ownership to an org instead
of only an individual user, and building the invite/role-management UI Resources itself doesn't have yet either.

## EMPLOYER

| Capability | Mobile object | Backend object | Partner need | Admin need | Current security | Status |
|---|---|---|---|---|---|---|
| Organizations | none | `resource_organizations` (generic, reusable, `org_type` already includes `'employer'`), `organization_members` (role-based) | Employer identity distinct from a bare `auth.users` row | Verify a real business | **Corrected this pass**: real, working, RLS-enabled model already exists (built for Resources) — needs extension (link `jobs.employer_id` to an org), not from-scratch design | **PARTIAL** — reusable foundation exists, not yet linked to Jobs |
| Jobs (ownership) | Job posting | `jobs.employer_id` FK to `auth.users` | Create/edit/close own postings | View any employer's postings | **Working RLS**: owner-scoped insert/update/delete (confirmed this pass) | **READY** (schema), **MISSING** (UI) |
| Applicants | Job application | `job_applications`, `job_application_events` | View/manage applicants to own jobs | View across all employers | **Working RLS**: "Employers read/update applications for own jobs," RLS-enforced valid status transitions | **READY** (schema), **MISSING** (UI) |
| Application statuses | Status field | `job_applications.status` check constraint | Set within allowed transitions | Override/audit | RLS already enforces the valid transition set at the database layer, not just app code | **READY** |
| Messaging | none | none | Message an applicant | Moderate/audit messages | N/A — doesn't exist | **MISSING** |
| Meetings | Interview scheduling (member-side only) | `member_meetings` (member-owned, no employer-side row) | See own scheduled interviews | none | No employer-side concept exists | **MISSING** |

## LANDLORD

| Capability | Mobile object | Backend object | Partner need | Admin need | Current security | Status |
|---|---|---|---|---|---|---|
| Organizations | none | none | Landlord/property-manager identity | Verify real landlords | N/A | **MISSING** |
| Properties/listings (ownership) | Housing listing | `housing_listings.owner_id` FK to `auth.users` | Create/edit/close own listings, set FastTrack eligibility | View any landlord's listings | **Working RLS**: owner-scoped insert/update/delete (confirmed this pass) | **READY** (schema), **MISSING** (UI) |
| Applications | Housing application | `housing_applications`, `housing_application_events` | Review/approve/deny own listings' applications | View across all landlords | Confirmed real state columns + events table exist; ownership-scoped access not independently re-verified this pass (Jobs' equivalent was) | **PARTIAL** — likely ready, not re-confirmed |
| Statuses | Status field | `housing_applications.status` | Set within allowed transitions | Override/audit | Not independently re-verified this pass | **PARTIAL** |
| Messaging (inquiries) | Housing inquiry / tour request | `housing_inquiries`, `partner_acknowledge_housing_inquiry()`, `partner_reply_housing_inquiry()` | **Already has real server functions for a partner-side actor** | Moderate/audit | Functions exist and are named for exactly this use, no partner UI consumes them yet | **READY** (backend), **MISSING** (UI) — the most partner-ready workflow in the whole matrix |
| Meetings (tours) | Tour request | `housing_tour_requests` | Confirm/decline a tour | none | Real status enum (`requested`/`confirmed`/`declined`/`completed`/`cancelled`) | **PARTIAL** — status model ready, no partner-side action function confirmed |

## REENTRY ORGANIZATION

| Capability | Mobile object | Backend object | Partner need | Admin need | Current security | Status |
|---|---|---|---|---|---|---|
| Organization | none | none | Caseworker/org identity | Approve orgs | N/A | **MISSING** |
| Caseload | none | none | See assigned members (with consent) | Oversight | N/A — `member_meetings` has no caseworker-side link at all | **MISSING** |
| Referrals | none | none | Refer a member to a resource/service | Track outcomes | N/A | **MISSING** |
| Outcomes | none | none | Record what happened | Aggregate reporting | N/A | **MISSING** |
| Meetings | Meeting tracking (member-side only) | `member_meetings` | See meetings with own caseload | none | Member-owned only | **MISSING** (partner side) |
| Consent | none | none | Access requires explicit member consent | Audit consent grants | **No consent-boundary concept exists anywhere in the schema** — this needs to be designed before any caseworker read access is built, given the sensitivity of reentry-status data | **MISSING — and security-critical to get right before building** |

## ADMIN

| Capability | Mobile object | Backend object | Admin need | Current security | Status |
|---|---|---|---|---|---|
| Users | Member accounts | `auth.users`, `profiles` | View/support/deletion processing | Standard Supabase Auth; no admin role concept in schema yet | **PARTIAL** — data exists, no admin role/permission layer |
| Organizations | — | `resource_organizations`, `organization_members` (corrected this pass — real, reusable) | Approve/manage Partner orgs | Real `status` (`active`/`suspended`) already exists on `resource_organizations` | **PARTIAL** — model exists, no admin approval UI, not yet extended to Jobs/Housing |
| Coverage markets | Early Access | `coverage_markets`, `upsert_coverage_market()`, `activate_coverage_market()` | — | **Already service-role-only, directly callable** — confirmed working end-to-end this session including a real bug find-and-fix | **READY** |
| Early Access | Waitlist enrollment | `market_waitlist_enrollments` | — | Service-role read/write ready; RLS confirmed member-isolated | **READY** |
| Entitlements | FairPath+ status | `entitlement_grants`, `issue/revoke/extend_entitlement_grant()`, `entitlement_audit_log` | — | **Fully built, audited, append-only log** | **READY** |
| Job imports | (dormant) | `opportunity_sources`, `opportunity_ingestion_runs`, `external_opportunities` | — | Schema-ready, RLS fully locked (service-role only), zero code uses it yet | **PARTIAL** — schema ready, no consumer, no admin view |
| Housing imports | (dormant) | Same pipeline as Jobs (shared, kind-discriminated) | — | Same as Jobs | **PARTIAL** |
| Resources (verification) | Resource freshness/verification | Real, active verification lifecycle: `publish_status` (`draft`/`pending_review`/`published`/`retired`) + `verification_state`, with a DB-enforced CHECK (`publish_status <> 'published' or verification_state = 'verified'`) — **the richest, most enforced lifecycle in the entire schema, more advanced than Record Relief's current 4-state one** | — | Already in production use; the publish-requires-verified gate is enforced at the CHECK-constraint layer, not just RLS | **READY** (backend), **MISSING** (admin UI) — worth using as the reference pattern if Record Relief's lifecycle is ever expanded |
| Resource reports | Member report | `resource_reports` | — | Confirmed exists; no admin queue/state machine built | **PARTIAL** |
| Record Relief research | Rule drafting | `record_relief_rules` (draft/verified/superseded/retired), new `researched_by`/`staff_notes` fields | — | **Column-privilege-audited this pass**: staff-only fields now correctly excluded from member reads at the grant layer | **READY** (schema + security), **MISSING** (admin UI) |
| Record Relief publishing | Verification gate | `status = 'verified'` RLS gate | — | **Proven this pass**: draft/unverified never evaluated, TEST never masquerades as real (separate `kind='test'`), superseded/retired never current | **READY** (the safety gate), **PARTIAL** (only 4 lifecycle states exist vs. the richer 8-state design — documented, not built) |
| Integrations | — | DEV integration-health screen (mobile-side) | — | Mobile-only; no cross-environment admin equivalent | **PARTIAL** |
| Feature flags | — | — (doesn't exist) | — | N/A | **MISSING** |
| Support | — | — (doesn't exist) | — | N/A | **MISSING** |
| Deletion requests | `/privacy` request | Member-side deletion request/cancel flow exists | — | No admin processing view | **PARTIAL** |
| Audit logs | — | `entitlement_audit_log` exists for entitlements specifically; nothing general-purpose | — | Entitlements only | **PARTIAL** |

## Summary

**Most Command-Center-ready today, in order:** Entitlements (fully built) → Coverage Markets/Early Access (fully
built + hardened this session) → Record Relief research/publishing (schema + security ready, safety gate proven)
→ Resources verification (active in production) → Housing inquiries (real partner-facing functions exist, unused).

**Biggest structural gap — corrected this pass:** it is NOT true that no Organization concept exists — a real,
working, reusable one (`resource_organizations`/`organization_members`, with `org_type` already anticipating
`'employer'`) exists for Resources. The actual remaining gap is smaller: extending that model's `org_type` enum
and linking `jobs.employer_id`/`housing_listings.owner_id` to an organization instead of only an individual
`auth.users` row, so a business can have multiple staff seats. Reentry Organization's consent-boundary gap is
still flagged as **security-critical to design correctly before writing any caseworker-facing read access**, given
the sensitivity
of reentry data.
