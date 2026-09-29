# Notification event reconciliation — catalog vs. real DB producers vs. client consumers

Three-way matrix, built by reading the real `create_notification()`/`user_notifications` call sites across every
migration and the real client code, not by assuming the catalog (`src/core/notifications/events.ts`) is already
accurate. No fake producers added to make the matrix look complete.

| Canonical event (`events.ts`) | Real DB producer | Client consumer |
|---|---|---|
| `MARKET_OPENED` | `coverage_markets` activation flow (`20261003100000_coverage_markets.sql`) | Generic: `src/app/notifications.tsx` renders `category`/`title`/`body`/`route` for any row |
| `EARLY_ACCESS_GRANTED` | Entitlement grant flow (`20260930100000_entitlements.sql`) | Generic (same) |
| `FAIRPATH_PLUS_EXPIRING` | **No real producer found.** Catalog entry exists; nothing in the schema currently inserts this. | N/A |
| `NEW_MATCHING_JOB` | **No real producer found.** No background job/trigger matches saved searches against new listings. | N/A |
| `NEW_MATCHING_HOUSING` | **No real producer found.** Same gap as above, Housing side. | N/A |
| `SAVED_JOB_CHANGED` | **No real producer found.** | N/A |
| `SAVED_HOUSING_CHANGED` | **No real producer found.** | N/A |
| `APPLICATION_UPDATED` | `20260929100000_inquiry_status_and_notifications.sql` (job application status transitions) | Generic |
| `HOUSING_APPLICATION_UPDATED` | Same file, housing application transitions | Generic |
| `INQUIRY_RESPONSE` | Same file, housing inquiry replies | Generic |
| `MEETING_REMINDER` | **No real producer found.** `set_meeting_status()` has no cross-user event to fire (member-only action on their own row — confirmed this session); no separate reminder-scheduling job exists either. | N/A |
| `CREDIT_DISPUTE_FOLLOW_UP` | `20261001190000_member_reminders.sql`, DB category `'credit_dispute'` | Generic |
| `RECORD_RELIEF_DATE` | Same file, DB category `'record_relief'` | Generic |
| `DOCUMENT_EXPIRING` | Same file, DB category `'documents'` | Generic |
| `MARKETPLACE_CLAIM_UPDATE` *(added this pass)* | `approve_marketplace_claim`, `decline_marketplace_claim`, `expire_marketplace_pickups`, `mark_marketplace_claim_ready`, `cancel_marketplace_claim`-adjacent triggers, `request_marketplace_claim` (`20260901000100_baseline_constraints_security_logic.sql`), all under DB category `'marketplace_claim'` — the most fully-built producer in the schema | Generic |
| *(no catalog entry)* | DB category `'payment'` (`20260930110000_payments.sql`, `20260930120000_payments_apply_event_fix.sql`) | Generic — **real gap**: a working producer with no catalog entry at all |
| *(no catalog entry)* | DB category `'resources'` (`20261001190000_member_reminders.sql`, saved-resource-removed) | Generic — **real gap** |

## Honest findings

1. **The client does not consume this catalog at all today.** `src/app/notifications.tsx` renders whatever
   `category`/`title`/`body`/`route` a `user_notifications` row already contains, directly from the database —
   it never imports or branches on `NOTIFICATION_EVENTS`. The catalog (`events.ts`) is real, internally
   consistent, and audited (`scripts/audit-notification-events.mjs`), but it is currently a **reference
   vocabulary for a future push/email/SMS worker**, not something the live in-app inbox reads from. That's
   consistent with the file's own documented purpose, but worth stating plainly rather than implying the catalog
   drives current behavior.
2. **Five catalog events have no real producer**: `FAIRPATH_PLUS_EXPIRING`, `NEW_MATCHING_JOB`,
   `NEW_MATCHING_HOUSING`, `SAVED_JOB_CHANGED`, `SAVED_HOUSING_CHANGED`, `MEETING_REMINDER`. These describe
   real, sensible future features (a saved-search match notifier, an expiring-entitlement warning, a
   time-based meeting reminder) that nothing in the schema currently implements. Not built this pass — building
   a producer for an event that doesn't exist yet is exactly the "invent a multi-party workflow to fill the
   matrix" the boardroom-sprint directive explicitly said not to do.
3. **Two real, working DB producers (`payment`, `resources`) have no catalog entry.** Lower priority than the
   Marketplace gap (payments/resource-removed notifications are simpler, single-party, less likely to need
   push/SMS-specific handling), but the same category of gap. Flagged here rather than fixed this pass — the
   Marketplace one was fixed because it was explicitly named as a known gap earlier this session; these two
   are net-new findings from this reconciliation and are lower-risk to leave for a follow-up pass than to rush.
4. **The DB category strings and the catalog's `NotificationEventId`s are deliberately different vocabularies**
   (`'marketplace_claim'` vs. `MARKETPLACE_CLAIM_UPDATE`, `'credit_dispute'` vs. `CREDIT_DISPUTE_FOLLOW_UP`).
   That's fine as long as a future integration layer maps one to the other explicitly — nothing today does that
   mapping, which is one more reason `events.ts` isn't live-wired to the inbox yet.

## Recommended next step (not done this pass)

Add `payment` and `resources` entries to the catalog (mirrors the Marketplace fix exactly), then build the
actual client-consumer mapping layer (DB category → canonical event ID) before any push/email/SMS work starts —
that mapping is the real missing piece, not more catalog entries.
