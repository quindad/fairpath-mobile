# Proposed migrations — DRAFT, not applied

Files here are **not** in `supabase/migrations` on purpose, so no tool or person can accidentally
apply them with `supabase db push`. Each file explains, in its own header, what it changes, what it
deliberately leaves alone, how to roll it back, what isolation it provides, and what tests should
exist before it is applied. Moving a file from here into `supabase/migrations` is itself a decision
that needs founder and backend review, a real version-number slot (never reuse one that's applied),
and the tests described in the file's header written and passing against a local Postgres first.

## Backlog (priority order, per the founder's Wave-1 direction)

1. **`20261020100000_three_tier_entitlements_and_ai_credits_DRAFT.sql`** — written. Free/Plus/Premium
   tier resolution reusing `entitlement_grants`/`billing_subscriptions`, plus a server-enforced AI
   credit ledger matching `src/core/credits/ledger.ts` and `src/core/membership/frozen-v1.ts` exactly.
2. Entrepreneurship persistence — not yet drafted. Needs a `entrepreneurship_progress` table mirroring
   `src/core/entrepreneurship/progress-store.ts`'s shape, owner-only RLS.
3. Privacy/consent persistence — not yet drafted. Needs tables for `disclosures`, `deletion_requests`
   and `privacy_settings` mirroring `src/core/privacy/privacy-center.ts`, owner-only RLS, and the
   same "location sharing and Safety partner visibility are fixed off" rule enforced server-side, not
   just in the client.
4. Food Rescue — not yet drafted. Needs `food_listings`, `food_reservations` mirroring
   `src/core/food/inventory.ts`'s hold/expiry/redeem rules, with the oversell protection done as
   `for update` row locks (same technique used in `debit_ai_credits` above).
5. Giving — not yet drafted. Needs `assistance_needs`, `donations` mirroring
   `src/core/giving/{needs,donations}.ts`'s explicit state machine, with the public view enforced as
   a Postgres view or RPC that only ever exposes the allowlisted fields, never raw table access.
6. Document metadata/extraction state for the generic (non-credit) upload flow — not yet drafted.
   Needs a table mirroring `src/core/documents/extraction-contract.ts`'s field/status shape, reusing
   the existing `documents` storage conventions in `src/core/documents/document-service.ts` rather
   than inventing new storage.
7. Safety & Recovery preferences, if any need storage beyond the public, stateless `/safety`
   screen — not yet drafted. Any such table must enforce the never-shared-externally rule server-side.

None of these are applied. None will be applied without a separate, explicit approval.

## Staffing (flagship business line, prioritized above the remaining backlog)

**`20261021100000_staffing_architecture_DRAFT.sql`** — written. Extends `jobs` (new `listing_kind`
column) and `job_placements` (new 1:1 `staffing_assignments` row) rather than duplicating either.
Adds requisitions, assignment stage history, FoxHire/Checkr provider state, and a strictly
ops-only rate-card/economics pair with no authenticated RLS policy at all. See the file's own
header for the full five-way isolation model (member / employer-client / FairPath ops / provider
integration / financial).

**Why no member-facing "Direct Hire vs. FairPath Staffing" badge was built yet:** `jobs.listing_kind`
does not exist in the real database until this migration is reviewed and applied. Building a UI
that reads a column that isn't there yet would mean faking the distinction client-side. The
classifier (`src/core/staffing/listing-kind.ts`) is ready and defaults safely to `direct_hire`
for any job that doesn't carry the field, so wiring the badge in is a small, low-risk follow-up
the moment the column exists.

## Staffing backlog additions not yet in the draft migration

The 2026-10-21 staffing draft covers requisitions, assignments, provider state, screening state, rate cards and
economics. Not yet added to that draft, pending further design:
- `staffing_audit_log` table matching `src/core/staffing/audit.ts`'s action types, same append-only pattern as
  `entitlement_audit_log`.
- `staffing_rate_card_templates` table matching `src/core/staffing/rate-card-template.ts`'s effective-dated shape.
- `staffing_provider_events` table for the idempotent ingestion ledger `src/core/staffing/provider-events.ts`
  models in memory (its `IngestionLedger` type is the row shape: `event_id` primary key, `assignment_id`,
  `to_state`, `occurred_at`).
