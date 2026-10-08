# FoxHire integration readiness

FoxHire is the planned initial EOR (Employer of Record) partner. This document lists what FairPath has built ahead
of real API access (`src/core/staffing/foxhire-adapter.ts`, `src/core/staffing/provider-events.ts`) and exactly
what information is needed before wiring a live call. No FoxHire endpoint, payload, or field name is fabricated.

## Canonical FairPath states already built (vendor-independent)

`candidate_submitted → onboarding_requested → onboarding_pending → onboarding_complete → payroll_active →
assignment_active → assignment_ended`, plus `provider_error_manual_review` reachable from any onboarding step.
Defined in `foxhire-adapter.ts` as `FoxHireState`, with `canTransition()` enforcing legal moves only.

**FoxHire terminology gets mapped into this model later. The reverse never happens** — FairPath's domain model does
not get rewritten to match FoxHire's vocabulary, so a future second EOR provider plugs into the same states.

## Already built: idempotency, retry, reconciliation design

- **Idempotency:** `provider-events.ts`'s `ingestFoxHireEvent` keys on a provider-issued `eventId`; a repeat is a
  no-op, which is what makes webhook redelivery safe.
- **Retry/error model:** `provider_error_manual_review` is reachable from every onboarding step and can resume
  back into `onboarding_requested` or `onboarding_pending` — a human can retry; the state machine never silently
  retries into `payroll_active` on its own.
- **Reconciliation job design (not built, documented):** because webhooks can be missed, a periodic job should call
  `getState()` for any assignment whose last applied event is older than a threshold, and reapply whatever FoxHire
  reports as authoritative. This requires FoxHire's real polling endpoint, not yet known.
- **Provider-reference storage design:** `staffing_provider_state.provider_ref` (draft migration) holds FoxHire's
  own identifier for the assignment, opaque to FairPath's app logic, used only to correlate future events/polls.
- **Audit logging:** `src/core/staffing/audit.ts`'s `provider_state_changed` action, redacted of credentials before
  it can reach any client bundle (`toClientSafeEvent`).

## What we need from FoxHire before wiring a live call

1. **Worker creation/onboarding API** — exact request/response shape.
2. **Client/worksite representation** — how FoxHire expects the client company and work location to be identified.
3. **Assignment creation** — how an assignment (not just a worker) is represented on FoxHire's side.
4. **Pay rate and bill rate handling** — does FoxHire need both, or only pay rate (with bill rate staying entirely
   FairPath-internal, which is the current assumption in `economics.ts`)?
5. **Employment status model** — FoxHire's own state names, to map into FairPath's canonical states above.
6. **Onboarding documents** — what FoxHire requires from the worker (I-9, tax forms, direct deposit, etc.) and
   whether FairPath collects and forwards them or FoxHire collects them directly.
7. **Tax/payroll forms** — W-4 and state equivalents: who presents these to the worker.
8. **Time collection** — does FoxHire provide its own timesheet system, or does it expect FairPath to submit hours?
   This directly determines where Mission 9's time-and-attendance domain ultimately lives.
9. **Overtime handling** — FoxHire's rules, which may differ from FairPath's `economics.ts` overtime assumptions.
10. **Workers' compensation** — whether FoxHire's workers'-comp cost is a flat fee, a percentage, or state-rated.
11. **Payroll schedule** — weekly, biweekly, other — affects member-facing pay expectations.
12. **Invoicing** — how FoxHire bills FairPath, and how that reconciles with FairPath's own client billing.
13. **Assignment changes** — extension, early termination, conversion-to-direct-hire: does FoxHire need to be
    notified of each, and in what shape?
14. **Webhook/event model** — push events with their actual schema, or polling only.
15. **API and sandbox availability.**
16. **Reconciliation support** — does FoxHire expose a way to fetch current state for a batch of assignments?
17. **Error handling** — FoxHire's own failure taxonomy.
18. **Data retention and data ownership** — who is the system of record for a terminated worker's employment history,
    and what FairPath is required or permitted to retain independently.

## Mapping rule

Same as Checkr: FoxHire's terminology is translated into FairPath's canonical states and events. FairPath's domain
model is never restructured around a vendor's API shape, which is what makes a future second EOR provider possible
without a rewrite.
