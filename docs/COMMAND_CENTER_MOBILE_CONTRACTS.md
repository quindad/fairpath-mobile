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

## Cross-cutting notes for the future build

- Several of the "admin-ready" rows above (Early Access, entitlements, Record Relief rule status) are **already
  gated service-role-only** in the current schema — meaning Command Center's admin actions can call the exact
  same functions Mobile's backend already uses, with zero new backend logic, only a UI and an admin auth/role
  layer on top.
- The Partner workspace has a much bigger gap: almost nothing has a partner-facing write path today (Jobs and
  Housing listings are entirely service-role/seed-written). Building partner write access will need new RLS
  policies scoped to a partner's own employer/landlord identity, which does not exist as a concept in the schema
  yet — this is real, non-trivial design work for whenever Command Center starts, not a small addition.
- Housing inquiries are the one partner-facing flow already partially built (state columns + server functions
  exist) — worth using as the reference pattern for how partner actions should be shaped when the rest get built.
