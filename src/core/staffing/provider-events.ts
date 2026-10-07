// Generic provider event ingestion for FoxHire and Checkr. No real webhook payload is fabricated: this models the
// SHAPE every provider integration needs (an envelope with a stable event id, idempotent application, and a
// reconciliation path) so the real transport can be dropped in later without changing how events are applied.
//
// IDEMPOTENCY STRATEGY: every event carries a provider-issued id. An id seen before is a no-op, not an error — this
// is what makes webhook replay (the provider retrying a delivery) safe. A future server table
// (staffing_provider_events, not yet drafted) would store applied ids the same way ai_credit_debits.request_id
// does in the entitlements draft migration.
//
// RECONCILIATION: because webhooks can be missed, getState()-style polling (foxhire-adapter.ts /
// checkr-adapter.ts) must remain available as a fallback independent of events ever arriving. A periodic
// reconciliation job (not built here) would call getState() for any assignment whose last event is older than
// a threshold and reapply the authoritative state.

import { canTransition as foxhireCanTransition, type FoxHireState } from './foxhire-adapter.ts';
import { canTransition as screeningCanTransition, type ScreeningState } from './checkr-adapter.ts';

export type ProviderEventEnvelope<State extends string> = {
  eventId: string; // provider-issued, stable across redelivery
  assignmentId: string;
  toState: State;
  occurredAt: string;
  receivedAt: string;
};

export type IngestResult<State extends string> =
  | { outcome: 'applied'; state: State }
  | { outcome: 'already_applied'; state: State }
  | { outcome: 'rejected_invalid_transition'; currentState: State }
  | { outcome: 'rejected_out_of_order' }; // occurredAt older than the last applied event for this assignment

export type IngestionLedger<State extends string> = {
  appliedEventIds: Set<string>;
  currentState: State;
  lastOccurredAt: string | null;
};

function ingest<State extends string>(
  ledger: IngestionLedger<State>,
  event: ProviderEventEnvelope<State>,
  canTransition: (from: State, to: State) => boolean,
): IngestResult<State> {
  if (ledger.appliedEventIds.has(event.eventId)) {
    return { outcome: 'already_applied', state: ledger.currentState };
  }
  if (ledger.lastOccurredAt !== null && event.occurredAt < ledger.lastOccurredAt) {
    return { outcome: 'rejected_out_of_order' };
  }
  if (!canTransition(ledger.currentState, event.toState)) {
    return { outcome: 'rejected_invalid_transition', currentState: ledger.currentState };
  }
  ledger.appliedEventIds.add(event.eventId);
  ledger.currentState = event.toState;
  ledger.lastOccurredAt = event.occurredAt;
  return { outcome: 'applied', state: event.toState };
}

export function ingestFoxHireEvent(ledger: IngestionLedger<FoxHireState>, event: ProviderEventEnvelope<FoxHireState>): IngestResult<FoxHireState> {
  return ingest(ledger, event, foxhireCanTransition);
}

export function ingestScreeningEvent(ledger: IngestionLedger<ScreeningState>, event: ProviderEventEnvelope<ScreeningState>): IngestResult<ScreeningState> {
  return ingest(ledger, event, screeningCanTransition);
}

export function newLedger<State extends string>(initialState: State): IngestionLedger<State> {
  return { appliedEventIds: new Set(), currentState: initialState, lastOccurredAt: null };
}
