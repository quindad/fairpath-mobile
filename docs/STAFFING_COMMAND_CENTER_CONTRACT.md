# Staffing Command Center contract — handoff to the Partner/Command Center repository

This is the implementation package for FairPath Staffing Ops and the Employer Staffing Workspace. Everything here
is a specification and a set of reusable TypeScript types; no screen is built in `fairpath-mobile`, and none should
be — building it here would create a second admin architecture competing with Command Center. The types below are
plain TypeScript with no React Native dependency, so they import cleanly into a Next.js (or any other) Command
Center codebase.

**Canonical types to import, not reimplement**, all in `fairpath-mobile/src/core/staffing/`:
`pipeline.ts` (stage machine), `economics.ts` (ops-only financials, never "profit"), `audit.ts` (event types +
redaction), `candidate-submission.ts` (what a client may see about a candidate), `rate-card-template.ts`,
`foxhire-adapter.ts` / `checkr-adapter.ts` (provider states), `evidence.ts` (what counts as a real outcome).

**Canonical DRAFT database schema**, not applied: `docs/proposed-migrations/20261021100000_staffing_architecture_DRAFT.sql`,
`20261022100000_staffing_audit_ratecards_provider_events_DRAFT.sql`, reviewed together in
`STAFFING_MIGRATION_REVIEW_AND_ORDER.md`. **One open finding there (provider_ref over-exposure) must be resolved
before Command Center build begins against this schema.**

---

## Part 1 — FairPath Staffing Ops (internal workspace)

### Dashboard

- **Purpose:** single view of everything needing attention across all requisitions and assignments.
- **Role:** FairPath staffing operator (service-role-backed; see `staff_users` pattern from the Command Center
  foundation migration — this workspace must check staff status server-side, never client-side).
- **Data:** counts and short lists for open requisitions, pipeline candidates by stage (`pipeline.ts` `PipelineStage`
  grouped by `STAGE_RECORD_LEVEL`), interviews today/upcoming, screenings pending
  (`staffing_screening_state.state = 'requested' | 'provider_processing'`), onboarding pending, starts this week,
  active assignments, assignments ending soon, retention checkpoints due, direct-hire conversions, exceptions (see
  Part 3 of Mission 10 below).
- **Allowed actions:** navigate to any sub-screen. No write actions on the dashboard itself.
- **Forbidden fields:** none — this is the full-visibility ops workspace.
- **State transitions:** none.
- **Empty state:** "No open items" per section, shown independently (an empty interview list doesn't hide a
  non-empty screening list).
- **Error state:** per-section retry, not a full-page failure.
- **Audit events:** none (read-only).
- **Mobile/member effects:** none.

### Requisitions / Requisition Detail

- **Purpose:** manage client staffing needs.
- **Role:** FairPath staffing operator.
- **Data:** `staffing_requisitions` row plus `jobs` row it extends; candidate counts by stage.
- **Allowed actions:** create, edit, approve, pause, close/cancel a requisition; assign owner/recruiter.
- **Forbidden fields:** n/a (ops-only).
- **State transitions:** `draft → submitted → approved → sourcing → partially_filled → filled → closed/cancelled`
  (Mission 5's lifecycle — not yet in the draft schema's `status` check constraint, which currently has
  `open/paused/filled/closed`; **reconcile before building** — see "Open items" below).
- **Empty state:** "No candidates yet" on Requisition Detail with headcount remaining.
- **Error state:** form validation inline; save failures show the specific field that failed.
- **Audit events:** `requisition_status_changed`.
- **Mobile/member effects:** none directly; approving a requisition is what allows sourcing to begin, which
  eventually produces member-visible staffing opportunities once `listing_kind='staffing'` is set on the `jobs` row.

### Candidates / Candidate Detail

- **Purpose:** track a specific member's progress through a specific requisition.
- **Role:** FairPath staffing operator.
- **Data:** the candidate's `CandidateSubmission` (allowlisted — see `candidate-submission.ts`), current pipeline
  stage, source, readiness, submitted date, interview/screening/onboarding/placement status, next action.
- **Allowed actions:** advance stage (through `pipeline.applyTransition`, server-side), record interview
  disposition, request screening (only after consent — enforced server-side, not just UI-side), request onboarding.
- **Forbidden fields:** anything in `FullMemberProfile` not in `CandidateSubmission` — reentry pathway, conviction
  details, veteran status (unless the member shared it), disability, recovery, housing, case-management notes,
  credit information, unrelated documents, private AI conversation refs. The ops screen may have broader internal
  access than the employer screen, but it still should not casually surface conviction detail next to a candidate
  record without a specific, separate, lawful reason — fair-chance decisions stay with the employer, not FairPath
  staffing operators ranking candidates informally.
- **State transitions:** `pipeline.ts`'s `applyTransition`; invalid transitions refused with a visible error, not
  silently ignored.
- **Empty state:** "Not yet submitted to this requisition."
- **Error state:** an invalid transition attempt shows why (`reason: 'invalid_transition'`).
- **Audit events:** `candidate_submitted`, and whichever pipeline stage was just entered if `requiresAudit()` is true.
- **Mobile/member effects:** stage changes should be reflected in the member's `My Assignment` screen once the real
  backend exists — e.g. `interview_scheduled` should be visible to the member as `interviewScheduledAt`.

### Interviews

- **Purpose:** today's and upcoming interviews across all requisitions.
- **Role:** FairPath staffing operator.
- **Data:** candidate, requisition, scheduled time, format.
- **Allowed actions:** record disposition (`interview_completed` → `employer_moving_forward` or a stall/decline, which is not currently a named pipeline stage — **open item**, see below).
- **Forbidden fields:** n/a.
- **State transitions:** `interview_requested → interview_scheduled → interview_completed`.
- **Empty state:** "No interviews scheduled."
- **Error state:** scheduling conflicts shown inline.
- **Audit events:** none dedicated; covered by `assignment_status_changed` if modeled on the assignment, or a new
  `interview_disposition_recorded` action — **not yet in `audit.ts`'s `StaffingAuditAction` enum; add before use.**
- **Mobile/member effects:** interview time should populate the member's `interviewScheduledAt`.

### Screening Queue / Onboarding Queue

- **Purpose:** operational queues for screening and onboarding in progress.
- **Role:** FairPath staffing operator (screening queue may need a narrower "authorized" sub-role — see
  `restricted_screening_state_viewed` audit action, which exists specifically because not every staffing operator
  should casually browse screening state).
- **Data:** `staffing_screening_state` / `staffing_provider_state` rows — **state only, never report content**
  (report content has no type yet; see `CHECKR_INTEGRATION_READINESS.md`).
- **Allowed actions:** mark manual review resolved (moves `screening_requires_human_review → onboarding_requested`
  per `pipeline.ts`), never an automatic clear.
- **Forbidden fields:** raw screening report content, provider credentials.
- **State transitions:** `checkr-adapter.ts` / `foxhire-adapter.ts` state machines.
- **Empty state:** "Nothing pending."
- **Error state:** `provider_error` / `provider_error_manual_review` shown with a retry action.
- **Audit events:** `screening_requested`, `restricted_screening_state_viewed` (logged every time an operator opens
  a restricted screening record — this is a real audit requirement, not optional), `onboarding_requested`,
  `provider_state_changed`.
- **Mobile/member effects:** member sees only the small enum via `ScreeningStatus`/`OnboardingStatus` components.

### Placements / Active Assignments / Assignment Detail

- **Purpose:** the durable hire fact and its staffing-specific extension.
- **Role:** FairPath staffing operator.
- **Data:** `job_placements` + `staffing_assignments` joined; member, client, start, expected/actual end, status,
  shift, time status (once Mission 9's domain exists), EOR status, screening status, extension/conversion flags,
  retention linkage.
- **Allowed actions:** confirm placement, record extension, record early end, initiate conversion to direct hire,
  confirm retention.
- **Forbidden fields:** none for this ops role, but financial fields (`staffing_rate_cards`, `staffing_economics`)
  render in a **separate** panel/tab, never inline with operational status — keeps the "never call it profit" rule
  visually enforced, not just technically.
- **State transitions:** the assignment-level portion of `pipeline.ts` (`placement_confirmed` through
  `retention_confirmed`).
- **Empty state:** n/a (list screens use "No active assignments").
- **Error state:** an invalid transition attempt is refused with the reason.
- **Audit events:** `placement_confirmed`, `assignment_status_changed`, `conversion_to_direct_hire`,
  `assignment_completed`.
- **Mobile/member effects:** every field the member is allowed to see flows through `toMemberView()` — this screen
  is the ops-side source of what that function reads.

### Assignment Exceptions

- **Purpose:** Mission 10's exception engine, surfaced operationally.
- **Role:** FairPath staffing operator.
- **Data:** exception type, severity, owner, created/due timestamps, status, resolution, related entity, safe
  internal detail (see Mission 10 types below — not yet built this wave; specified for the next pass).
- **Allowed actions:** assign owner, resolve, escalate.
- **Forbidden fields:** n/a (internal detail is for this role).
- **State transitions:** open → owned → resolved (exact enum TBD in the exception-engine build).
- **Empty state:** "No open exceptions."
- **Error state:** n/a.
- **Audit events:** none yet defined; should be added alongside the exception engine.
- **Mobile/member effects:** the exception's **safe member message** (not the internal detail) is what reaches
  notifications per Mission 13.

### Retention

- **Purpose:** retention checkpoints due/confirmed, feeding `evidence.ts`.
- **Role:** FairPath staffing operator.
- **Data:** assignment, checkpoint due date, confirmation status.
- **Allowed actions:** record confirmation (produces `evidenceForStage('retention_confirmed', ...)`.
- **Forbidden fields:** n/a.
- **State transitions:** `assignment_completed`/`assignment_ended_early → retention_checkpoint_due → retention_confirmed`.
- **Empty state:** "No checkpoints due."
- **Audit events:** none beyond the pipeline's own `requiresAudit('retention_confirmed')`.
- **Mobile/member effects:** this is what the member's `retentionCheckpointDueAt` field reflects.

### Clients

- **Purpose:** the client organizations FairPath staffs for.
- **Role:** FairPath staffing operator.
- **Data:** `resource_organizations` row, active requisitions, rate card templates.
- **Allowed actions:** create/edit client record, manage rate card templates.
- **Forbidden fields:** n/a.
- **Audit events:** n/a (covered by `rate_card_changed` when a template changes).
- **Mobile/member effects:** none.

### Rate Cards

- **Purpose:** `rate-card-template.ts` and `staffing_rate_cards` management.
- **Role:** FairPath staffing operator with financial access — **this likely needs its own sub-permission**, not
  every staffing operator should edit commercial terms; not decided in this wave.
- **Data:** full `RateCardTemplate` and `RateCard`/`EconomicsResult` including the ops-only economics card
  (`buildEconomicsCardRows`).
- **Allowed actions:** create/edit template, generate a real rate card from a template for a specific assignment.
- **Forbidden fields:** none for this role — this IS the financial screen. It must never be reachable by the
  employer workspace or exposed through any member-facing route.
- **Audit events:** `rate_card_changed` (a `FINANCIAL_ACTIONS` entry — `toClientSafeEvent` must never be bypassed
  for this action's details when shown anywhere outside this screen).

### Provider Status

- **Purpose:** FoxHire/Checkr state across all assignments, for ops troubleshooting.
- **Role:** FairPath staffing operator.
- **Data:** `staffing_provider_state`, `staffing_screening_state`, `staffing_provider_events` (the idempotency ledger).
- **Allowed actions:** trigger reconciliation (once the reconciliation job design is built), view event history.
- **Forbidden fields:** n/a.
- **Audit events:** `provider_state_changed`.

### Staffing Audit

- **Purpose:** the append-only `staffing_audit_log`, browsable.
- **Role:** FairPath staffing operator, likely a restricted compliance sub-role.
- **Data:** `AuditEvent` rows, always passed through `toClientSafeEvent()` before rendering even here — financial
  detail for `rate_card_changed` should still require an explicit "show financial detail" action logged as its own
  audit event (view-of-audit-log is itself auditable), not shown by default.
- **Allowed actions:** read, filter by action/assignment/requisition/actor.
- **Forbidden fields:** raw `details` for financial actions, by default.

---

## Part 2 — Employer Staffing Workspace

Simpler than Ops. An employer/client sees only their own data.

### Staffing Overview

- **Purpose:** the client's own requisitions and assignments at a glance.
- **Role:** authenticated employer/client user, scoped via `organization_members` to their `client_organization_id`.
- **Data:** counts of open requisitions, candidates submitted, interviews pending their action, active assignments.
- **Forbidden fields:** any other client's data (tenant isolation — see Mission "attack-test tenant isolation" below).
- **Mobile/member effects:** none.

### Create Requisition / Requisition Detail

- **Purpose:** request staffing.
- **Role:** employer/client user.
- **Data:** role, description, openings, assignment type, target start, duration, schedule, shift, requirements,
  credentials, screening requirements, onboarding requirements, **member-visible pay rate/range only.**
- **Forbidden fields:** bill rate, markup, EOR cost assumption, FairPath's internal recruiter/owner assignment,
  other clients' requisitions. The requisition creation form must not even render a bill-rate input — that is set
  by FairPath ops on the rate card, not entered by the client directly (or if the client does propose a rate,
  it becomes a `RateCardTemplate` draft that an ops operator reviews before it is used for `economics.ts`
  calculations — **decide this UX in the Command Center build**, not assumed here).
- **State transitions:** `draft → submitted` (client-initiated); everything after `submitted` is ops-driven.
- **Empty state:** blank form with sensible defaults.
- **Error state:** validation inline.
- **Audit events:** `requisition_status_changed`.
- **Mobile/member effects:** none until FairPath approves and sourcing begins.

### Submitted Candidates / Candidate Review

- **Purpose:** review who FairPath has submitted.
- **Role:** employer/client user, scoped to their own requisitions.
- **Data:** `CandidateSubmission` **exactly as built in `candidate-submission.ts` — nothing more.** This is the
  precise type this screen must use; do not project a broader internal object into it.
- **Forbidden fields:** everything in `FORBIDDEN_SUBMISSION_FIELDS` — reentry, conviction, disability, recovery,
  housing, case-management, credit info, unrelated docs, AI conversation refs, and veteran status unless the member
  explicitly shared it.
- **Allowed actions:** request interview, pass.
- **Audit events:** none at view time (viewing a lawful candidate submission isn't itself sensitive the way
  screening state is); interview request logged on the ops side.

### Interview Scheduling / Disposition

- **Purpose:** the client's half of the interview workflow.
- **Role:** employer/client user.
- **Allowed actions:** propose times, record outcome ("moving forward" / "not at this time" — never a FairPath
  auto-decision).
- **Forbidden fields:** n/a.
- **Mobile/member effects:** interview time surfaces to the member.

### Start Confirmation

- **Purpose:** client confirms a candidate's actual start.
- **Role:** employer/client user.
- **Allowed actions:** confirm start date.
- **Audit events:** feeds `placement_confirmed` / assignment-start evidence.

### Active Assignments / Extension Request / Conversion Request / Assignment Completion

- **Purpose:** the client's ongoing view of their placed workers.
- **Role:** employer/client user.
- **Data:** worker's role, start date, status, shift — **never the worker's full FairPath profile, never bill
  rate or economics.**
- **Allowed actions:** request extension, request conversion to direct hire, record completion/early end.
- **Forbidden fields:** EOR cost, gross spread, estimated contribution, internal notes, provider payloads, other
  clients' assignments, and anything the member did not authorize sharing.
- **Audit events:** `assignment_status_changed`, `conversion_to_direct_hire` (request only — FairPath ops confirms).

### Retention Confirmation (employer side)

- **Purpose:** the client's confirmation input to a retention checkpoint.
- **Role:** employer/client user.
- **Allowed actions:** confirm the worker is still active at the checkpoint date.
- **Audit events:** feeds `retention_confirmed` evidence once FairPath ops processes it.

---

## Attack-test tenant isolation (required before Command Center ships)

Write server-side tests (pgTAP or the local-sql harness, per `STAFFING_MIGRATION_REVIEW_AND_ORDER.md`'s testing
section) proving:
- Client A cannot read Client B's requisitions, candidates, or assignments via the `organization_members` policy.
- An employer-scoped query can never retrieve `staffing_rate_cards` or `staffing_economics` rows, by any join path.
- A `CandidateSubmission` built for Client A's requisition cannot be requested for a candidate who never applied to
  one of Client A's requisitions.

## Open items this contract surfaces for the Command Center build (not resolved here)

1. **Requisition lifecycle mismatch:** Mission 5 specifies `draft → submitted → approved → sourcing →
   partially_filled → filled → closed/cancelled`; the draft migration's `status` check constraint currently has
   `open/paused/filled/closed`. Reconcile before building against the schema.
2. **`provider_ref` over-exposure** in the draft migration's member-read policies on
   `staffing_provider_state`/`staffing_screening_state` — see `STAFFING_MIGRATION_REVIEW_AND_ORDER.md`.
3. **`audit.ts`'s `StaffingAuditAction` enum** needs an `interview_disposition_recorded` action (or equivalent)
   before the Interviews screen can audit correctly.
4. **Rate-proposal UX from the employer side** (does a client ever submit a bill rate, or only FairPath ops) is
   explicitly undecided and should be a founder/commercial decision, not inferred by whoever builds the screen.
