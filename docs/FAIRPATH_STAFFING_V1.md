# FairPath Staffing — V1

Plain-English explanation of the product, for the founder, a future CEO, a sales rep, an engineer, or an investor.
Written 2026-10-07. Reflects what is built in `src/core/staffing/` on `development/mobile-v1-completion`, not what
is live — nothing described here is connected to a production database or a real paying client yet.

## What FairPath Staffing sells

Workers for temporary, contract, and temp-to-hire roles. A client business tells FairPath what it needs; FairPath
sources, prepares, and places a worker; the worker is legally employed through an Employer of Record (EOR) partner
while working for the client.

## Who buys it

A business that needs workers without taking on the employment paperwork itself — payroll, taxes, workers'
compensation, and compliance. Warehouse, logistics, light industrial, and similar roles are the first use case.

## The difference between Recruit and Staffing

| | FairPath Recruit | FairPath Staffing |
|---|---|---|
| Who employs the worker | The client, directly | The EOR partner (FoxHire), not FairPath or the client |
| Duration | Permanent | Temporary, contract, or temp-to-hire |
| What FairPath owns | The hire, end to end | Recruiting, matching, preparation, the client relationship, and placement operations |
| Record of the fact | `job_placements` | `job_placements` + `staffing_assignments` (a 1:1 extension) |

## How a member enters

Through the normal FairPath app: Jobs/Explore, or a pathway (Veterans, Reentry, or any other). A listing is marked
`direct_hire` or `staffing` (see "What FairPath owns" below for why that field isn't live yet). A member applies the
same way regardless of which kind of listing it is.

## How an employer enters

A client creates a staffing requisition describing the role, headcount, and assignment type. FairPath sources and
submits candidates. The client interviews, authorizes screening, and confirms placement. (The employer-facing
screens for this live in the Partner/Command Center product, not in this mobile app — see "What FairPath does not
own" below.)

## Where FoxHire fits

FoxHire is the planned initial EOR partner. It handles the employment back office: W-2 payroll, taxes, workers'
compensation, benefits, and compliance for the worker while on assignment. FairPath never rebuilds that
infrastructure. The integration is an adapter (`src/core/staffing/foxhire-adapter.ts`) with FairPath's own canonical
states (`candidate_submitted` through `assignment_ended`), independent of whatever FoxHire's actual API looks like.
No real FoxHire endpoint or payload has been fabricated; only the canonical model and a DEV mock exist.

## Where Checkr fits

Checkr is the planned background-screening provider. Screening only ever starts after a candidate has moved forward
and given explicit consent (`src/core/staffing/checkr-adapter.ts`, `mayRequestScreening()`). A result is handed to an
authorized human; FairPath never auto-rejects or auto-ranks anyone from a screening result, and screening data never
feeds Signal or any ranking system.

## Why providers are replaceable

Every provider (FoxHire, Checkr, and the still-undefined Experian use case) sits behind an adapter interface with
FairPath's own state language. Swapping the real vendor in later, or adding a second EOR or screening provider,
means implementing the adapter interface — nothing else in the product changes. This was a deliberate architecture
decision, not an accident: FairPath's product should never be hard-wired to one vendor's API shape.

## How Veterans fits

Veterans is a member pathway, not a separate staffing system. A veteran member can translate military experience,
build civilian resume material, and then enter the exact same staffing engine as any other member. There is no
separate "Veteran Staffing" database or workflow, and veteran status is never automatically disclosed to a client.

## How Reentry fits

Same principle. A member who came through Reentry uses the same staffing engine. Conviction history is never a
staffing profile badge, is never automatically disclosed to a client, and never produces a hidden risk score. Fair-
chance matching (`src/core/staffing/matching.ts`, built on `src/core/matching/fair-chance.ts`) explains fit using
only what the member has chosen to disclose.

## What FairPath owns

- The member experience: Jobs/Explore, applications, the staffing pipeline, My Assignment.
- Matching, preparation, the client relationship, and placement operations.
- The economics model: pay rate, bill rate, EOR cost, screening cost, statutory burden, gross spread, and estimated
  contribution (internal only — see terminology below).
- Evidence of real outcomes: placement, assignment start, retention, and conversion to direct hire.

## What FairPath does not own

- Employment administration (payroll, taxes, workers' comp, benefits) — that's the EOR partner.
- Background screening itself — that's Checkr (or a future replaceable provider).
- The employer/client-facing operations UI (requisitions, candidate pipeline, interview scheduling, rate cards) —
  that belongs in the Partner/Command Center product, a separate repository, not `fairpath-mobile`. Building it here
  would duplicate that workstream.
- Case management for Reentry — that's a separate, explicitly out-of-scope repository
  (`fairpath-mobile-case-plans` / `fairpath-partner-case-plans`).

## Assignment economics terminology

- **Gross spread** = bill rate − pay rate − EOR cost, per hour. **This is not profit.** It has not absorbed
  overhead, bad-debt risk, or anything beyond the costs explicitly listed.
- **Estimated contribution** = gross spread − statutory burden − amortized screening and other costs, per hour.
  **This is not guaranteed profit either.** Both terms are enforced in code: a test fails the build if either field,
  or any function, is literally named `profit`.
- Economics logic (`economics.ts`) must never be imported from a member-facing screen. A test checks every file
  under `src/app/` for that import and fails if it is found.

## Data boundaries

| Audience | Can see |
|---|---|
| Member | Their own assignment (`toMemberView()`'s allowlist only) — role, client name, location, pay rate, schedule, status, screening/onboarding state, start date, retention check-ins |
| Member | Never: bill rate, markup, EOR cost, screening cost, statutory burden, gross spread, estimated contribution, internal notes, provider credentials |
| Employer/client | Their own requisitions and assignments under them — never another client's, never FairPath's internal economics |
| FairPath staffing operations | Everything, through service-role-only tables with no authenticated RLS policy at all for financial data |
| Provider (FoxHire/Checkr) | Only what is sent to request onboarding or screening — never the member's full profile |

## V1 vs. later

**V1 (this build):** the member experience, the pipeline state machine, provider adapter boundaries with DEV mocks,
economics logic, fair-chance matching, the evidence layer, and a draft (unapplied) database design.

**Later, explicitly not V1:**
- Real FoxHire and Checkr API integration (waiting on official technical material).
- Experian integration (waiting on the founder's demo to identify an approved product and use case).
- The employer/Command Center staffing operations UI (separate repository).
- Applying the draft migration, and any real billing.
