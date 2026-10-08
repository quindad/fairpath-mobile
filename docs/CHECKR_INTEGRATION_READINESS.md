# Checkr integration readiness

The founder is verified with Checkr. This document lists what FairPath has built ahead of real API access
(`src/core/staffing/checkr-adapter.ts`, `src/core/staffing/provider-events.ts`) and exactly what information is
needed before wiring a live call. No Checkr endpoint, payload, or field name is fabricated anywhere in this repo.

## Canonical FairPath objects already built

| Concept | Where |
|---|---|
| Workflow state (`consent_pending` → `requested` → `provider_processing` → `result_available` / `provider_error`) | `checkr-adapter.ts` `ScreeningState` |
| Consent gate (`mayRequestScreening`) | `checkr-adapter.ts` |
| Idempotent, replay-safe event ingestion | `provider-events.ts` `ingestScreeningEvent` |
| DEV mock that always routes to human review, never auto-clear/auto-reject | `checkr-adapter.ts` `createMockScreeningAdapter` |

## Separation already enforced

**Screening workflow state** (the enum above — where a screening is in its process) is kept completely separate
from **screening report content** (what the report actually says). Nothing in this codebase has a type for report
content yet, deliberately — building one before knowing Checkr's actual schema would mean guessing at a legally
sensitive data shape.

General FairPath application screens (My Assignment, job cards, matching) never receive report content, only the
small workflow-state enum, and only for the member's own assignment.

## Tests already proving the boundaries (`tests/staffing.test.ts`, `tests/staffing-events-matching-evidence.test.ts`)

- Screening cannot begin before authorization (`mayRequestScreening` requires `consentGiven`).
- Duplicate authorization does not duplicate a request (idempotent per event id).
- A replayed provider event is idempotent (`ingestScreeningEvent` no-ops on a seen `eventId`).
- A provider error can never become an automatic candidate rejection (`AUTO_REJECT_STAGES` / `AUTO_DECISION_STAGES`
  are empty arrays, checked directly).
- No exported function in the Checkr adapter matches an auto-decision naming pattern (`FORBIDDEN_FUNCTION_NAME_PATTERNS`).

**Not yet tested** (cannot be, without a real report-content type): report content entering match scoring, Signal,
or an employer-safe DTO. These stay impossible today because no such type exists; a test should be written the
moment report-content handling is designed, to lock in that it never flows into matching, Signal, or the employer
DTO unless a separate, explicitly lawful and authorized workflow is built for it.

## What we need from Checkr before wiring a live call

1. **Authentication model** — API key, OAuth, something else.
2. **Candidate/report creation API** — the actual request shape for initiating a check.
3. **Webhook payload schema** — exact field names and event types, or confirmation that polling is required instead.
4. **Idempotency guarantee** — does Checkr provide its own idempotency key, or must FairPath generate one?
5. **Report content schema** — exact fields returned, so a report-content type can be designed without guessing.
6. **Adverse-action / FCRA-related obligations** specific to Checkr's product (pre-adverse-action notice timing,
   dispute process, required disclosures).
7. **Sandbox environment** — availability, and whether sandbox responses differ structurally from production.
8. **Rate limits and retry guidance.**
9. **Data retention and deletion requirements** on FairPath's side.
10. **Error taxonomy** — what failure states Checkr itself distinguishes (so `provider_error` can be split further
    if useful, e.g. retryable vs. not).

## Mapping rule

When this information arrives, it gets mapped INTO the existing canonical `ScreeningState` enum and event shape.
The reverse — rewriting FairPath's domain model to match Checkr's vocabulary — does not happen. This is what keeps
Checkr replaceable.
