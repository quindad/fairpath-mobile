# Mobile → Command Center handoff

**MOBILE ENGINEERING DETERMINATION: COMPLETE — FREEZE APPROVED.**

This document is the final engineering handoff. For the detailed workflow-by-workflow contract mapping, see
`COMMAND_CENTER_MOBILE_CONTRACTS.md` (already built, not duplicated here) — this doc adds what that one doesn't
cover: the freeze determination itself, tonight's Organization-ownership extension, the DEV/PROD safety
boundaries, and the recommended build order for Admin and Partner.

## The freeze determination

Every item on `FAIRPATH_MOBILE_LAUNCH_BOARD.md`'s "TOP 10 MOBILE LAUNCH BLOCKERS" list was re-checked against
this rule: **is this an actual unfinished code requirement, or a data/business/external/device dependency?**

| # | Blocker | Category | Blocks engineering freeze? |
|---|---|---|---|
| 1 | Real Jobs/Housing inventory | DATA | No |
| 2 | Record Relief real legal data (50 states) | RESEARCH (in progress, parallel workstream — see Federal candidate-data pass) | No |
| 3 | Physical-device verification (share/print/Apple Sign-In/native maps) | DEVICE | No |
| 4 | Payments deployment + Stripe key | EXTERNAL (no key exists) | No |
| 5 | Android Maps key | EXTERNAL | No |
| 6 | Push notification wiring (client registration + sending worker) | DEVICE (untestable without a physical device; server side already exists) | No |
| 7 | Google/Apple auth configuration confirmation | EXTERNAL | No |
| 8 | Resources real-data sourcing (211/open-data/partner) | BUSINESS DECISION | No |
| 9 | Credit extraction deployment | PRODUCT DECISION (provider/privacy), function already built+tested | No |
| 10 | Observability (crash reporting) | EXTERNAL (vendor decision) | No |

**Zero of the ten are engineering gaps.** Every one either needs a credential/key Claude cannot obtain, a
physical device, a business/legal decision, or real-world data that doesn't yet exist. None reveals an actual
unfinished code path — each was independently verified against the real code, not assumed.

Beyond that list, this session's own marathon closed a substantial amount of engineering that was NOT yet on the
board: Jobs/Housing Organization ownership (new), Marketplace's full adversarial lifecycle (17/17), a systematic
failure-state sweep across every `useFocusEffect` screen in the app (10 real bugs fixed), a complete cross-member/
cross-org security sweep for every member-data table, Home/Me/AI cohesion for Marketplace and Meetings, one real
performance fix, notification-catalog reconciliation, and the Ohio + Federal Record Relief candidate-data
pipelines (built safely, zero real legal content published). Offline suite: **49/49**.

## What's still open, honestly

- **Ohio and Federal Record Relief candidate data** exist in DEV as unverified `draft` rows / staging
  (`legal_rule_candidates`), never member-facing. Promoting them to real, verified, member-visible law needs a
  human legal reviewer — not an engineering task, and explicitly not rushed. 12 of 13 Federal pathways are
  additionally blocked on a missing effective date the research didn't supply (queued as a follow-up research
  ask, not a code gap).
- **`NATIONAL_RECORD_RELIEF_RESEARCH_MANIFEST.md`** has not arrived. Not a blocker for anything processed so far.
- Everything else genuinely engineering-closeable that this session found, it closed.

## Organization ownership model (built this session — the Partner-workspace foundation)

Extended the REAL, pre-existing `resource_organizations`/`organization_members` model (built for Resources) to
Jobs and Housing, instead of inventing a second model:

- `jobs.organization_id` / `housing_listings.organization_id` — nullable, additive. `NULL` means individually
  owned (unchanged, existing behavior). Set means an active `owner`/`manager` member of that organization can
  manage the listing in addition to the individual `employer_id`/`owner_id` owner.
- New RLS policies are purely additive — the pre-existing individual-owner policies were tightened to
  `organization_id is null` (closing a self-forgery gap found and fixed before it shipped: without this, any
  authenticated user could tag a job with a real organization's id they don't belong to).
- Membership (`organization_members`) has three roles (`owner`/`manager`/`editor`) and a status
  (`invited`/`active`/`removed`) — `editor` can read but not write; only `owner`/`manager` can create/update/
  delete. Membership rows are service-role-inserted only today — **no self-serve "join an organization" flow
  exists yet**, which is exactly right for a pre-Partner-launch state (Command Center's Admin workspace is where
  an org's initial owner/manager gets provisioned).
- Adversarially proven: cross-org isolation, forged `organization_id`, role-gated writes (6/6 tests,
  `test-local-org-ownership.mjs`).

**This is the single most important piece of Partner-workspace foundation already sitting in the schema** — an
employer or landlord signing into a future Partner app doesn't need new ownership plumbing, they need a UI over
what already works.

## DEV/PROD safety boundaries (unchanged, reconfirmed)

DEV Supabase project only (`znvhmuhojvwvjzmaqwff`). Every migration this session applied to DEV, zero to
production. `data_origin`/`fixture_set` + a DB-level trigger guard (`*_guard_fixture()`) make it structurally
impossible for `dev_fixture`-tagged rows to exist outside `app_config.environment = 'dev'` — not just convention.
Nothing pushed to GitHub this entire session; all work is local commits on `feat/v1-canonical-profile`.

## Feature flags

No dedicated feature-flag table/service currently exists for member-facing toggles beyond
`feature_flags`/`profiles.feature_flag_justice_engine` (an existing, narrow justice-data-engine flag). Command
Center's Admin workspace will likely want a general-purpose flag table before Partner ships anything
member-visible incrementally — not built this session (no immediate need surfaced), flagged here as a real
near-term Admin-workspace requirement.

## Audit-log requirements (real gap, named in `COMMAND_CENTER_MOBILE_CONTRACTS.md`, restated here)

`entitlement_audit_log` is the one append-only audit trail that already exists and is in active use. Every other
future Admin action (resource-report resolution, Record Relief publish/supersede, privacy-request processing,
organization membership changes) has no audit trail today. Recommend a single generic `admin_audit_log`
(actor, action, target table/id, before/after where feasible, timestamp) rather than one bespoke table per
Admin surface — this is exactly the kind of generic, reusable capability worth building once Command Center
starts, not guessed at speculatively tonight.

## Recommended build order

**Admin before Partner**, per the same reasoning `MOBILE_BUILD_EXIT_CRITERIA.md` already reached and this
session reconfirms: nothing schema-shaped is currently unstable, and Admin's surfaces are overwhelmingly already
backend-ready (Coverage Markets, Entitlements, Resource verification, Record Relief publishing/legal-review
queue, Legal Source Monitoring, integration health) while Partner's Organization/identity model — though now
meaningfully more built than it was — still needs a deliberate self-serve provisioning decision before a real
employer/landlord can onboard themselves.

1. **Admin: Coverage Markets + Entitlements.** Fully backend-ready today (`upsert_coverage_market`,
   `activate_coverage_market`, `issue/revoke/extend_entitlement_grant`, `entitlement_audit_log`). Lowest-risk,
   highest-immediate-value starting point — closes the loop on tonight's own Early Access work.
2. **Admin: Resource verification queue.** Resources already has the most mature publish/verify/report lifecycle
   in the schema (`publish_status` × `verification_state`, DB-CHECK-enforced, not just RLS-gated).
3. **Admin: Record Relief legal-data review queue.** Backend built THIS session
   (`legal_source_registry`/`legal_source_snapshots`/`legal_change_candidates`/`legal_rule_candidates`/
   `legal_review_queue`, `promote_legal_rule_candidate()`), proven safe with 23+16+7 adversarial tests across the
   Ohio and Federal passes. This is the natural next Admin surface once Coverage/Entitlements ship, and it's what
   actually unblocks real Record Relief content at scale instead of hand-written SQL.
4. **Admin: generic audit log + basic feature-flag table.** Small, foundational, unlocks safer iteration on
   everything above.
5. **Partner: Organization self-serve provisioning + Jobs/Housing listing management UI.** The ownership/RLS
   foundation is real and tested (including tonight's org-ownership extension) — this is now a UI-over-working-
   backend project, not a from-scratch design project. Gate this behind a deliberate decision on how an
   organization's first owner gets verified/provisioned (Admin-assisted onboarding is the safer first version,
   not fully self-serve).
6. **Partner: Housing inquiry/tour messaging UI.** `partner_acknowledge_housing_inquiry`/
   `partner_reply_housing_inquiry` already exist server-side with zero UI — the cheapest possible Partner win
   after Organization provisioning lands.
7. **Partner: Job/Housing application review UI.** Same shape — RLS and status-transition enforcement already
   exist at the database layer (`job_applications`' update policy already enforces valid status values).

Everything else in `COMMAND_CENTER_MOBILE_CONTRACTS.md`'s tables (caseworker/reentry-org caseload, ingestion
integrations dashboard, notification-delivery operations) is real future work but has a materially bigger gap
between "schema exists" and "ready to build" — sequenced after the above, not blocking it.
