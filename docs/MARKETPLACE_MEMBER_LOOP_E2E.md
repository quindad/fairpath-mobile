# Marketplace member loop E2E (101–108)

**Automated:** `npm run test:marketplace`, `npm run test:keyboard` (claim/list flows).

## Browse & claim (member)

1. `/marketplace` → search/list; failed refresh clears stale items.
2. Item detail → quota copy (free vs FairPath+), **48-hour pickup**, anonymous selection explained.
3. Request claim via `request_marketplace_claim` RPC (no client-side quota bypass).

## Claimant workspace

1. `/marketplace-claim/{id}` → status, pickup code/QR when approved.
2. **No** “send message to donor” for claimants; donor pickup notes shown **read-only** when provided.
3. Verify pickup through server RPC only.

## Donor flow

1. `/marketplace-list-item` → draft → photos → publish.
2. `/marketplace-manage/{id}` → approve claim, **donor-only** pickup logistics message RPC.

## Saved & listings hub

1. `/saved-marketplace`, `/marketplace-my-listings`, `/marketplace-claims` reachable when signed in.

## Preconditions

- DEV marketplace seed/quota RPCs applied; signed-in member for claim flows.
