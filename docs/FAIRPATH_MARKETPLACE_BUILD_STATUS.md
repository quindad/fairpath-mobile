# FairPath Marketplace — Build Status

Last updated: 2026-09-20

## Product rule
FairPath Marketplace is a **free local-item exchange**, not a resale storefront. The Marketplace exists to move useful goods to FairPath members safely, fairly, and with less bias.

## User-defined Marketplace parameters preserved
- Free items.
- Claim-based access.
- Free plan: **1 Marketplace claim per month**.
- FairPath+ ($2/month product contract): **7 Marketplace claims per month**.
- Donor/seller claim approval.
- Anonymous / race-hidden selection.
- 48-hour pickup window after approval.
- Safe pickup.
- Private exact pickup details until approval.
- Pickup verification from the claimant's phone using a FairPath pickup code.
- Claim no-show handling.
- Donor-abuse / listing-safety reporting.
- Individual and organization donors.
- Facebook-Marketplace-style local browsing, saved items, listing management and photo-first detail.

## Built in this pass

### Browse
- Free Marketplace hero and rules.
- Keyword search.
- City/state/ZIP location search.
- Categories: Furniture, Home, Electronics, Appliances, Clothing, Kids & Baby, Tools, Sports & Outdoors, Books & Media, Auto Parts, Other.
- Safe Pickup filter.
- Newest / oldest sorting.
- Saved item state.
- Photo-first two-column local grid.
- Honest no-photo states; no demo Marketplace photo substitution.
- Featured item support.
- Public location / pickup-area display without exposing exact pickup address.

### Claim allowance
- Server-authoritative monthly quota.
- Free account limit = 1.
- Active FairPath+ limit = 7.
- Declined donor selection does not consume the member's quota.
- A request cancelled before donor approval does not consume quota.
- Cancellation after approval still counts because the donor reserved the item.
- No-show remains counted.
- Supabase pg_cron runs the pickup-expiration worker every 15 minutes, so stale approved/ready claims are released without waiting for a user to open the app.
- Donor-removal cancellation restores quota.
- Re-requesting an item after a cancelled/declined/expired request is supported when quota and item availability permit it.

### Anonymous selection / bias controls
- Sellers cannot directly read raw Marketplace claim rows through normal RLS.
- Sellers receive claim candidates through an RPC that returns anonymous claim IDs.
- Seller UI does not request or display claimant name, race, or profile photo.
- Donor selection UI explicitly explains the anonymous-selection rule.
- Discriminatory behavior is a Marketplace report reason.

### 48-hour pickup lifecycle
- Request starts as REQUESTED.
- Donor approves one anonymous claimant.
- Approval starts the 48-hour pickup deadline.
- Other pending requesters become NOT SELECTED and have their claim quota restored.
- Donor can mark the item READY.
- Claimant unlocks private pickup details only after approval.
- Claimant receives a six-character pickup code.
- Donor enters the pickup code in FairPath to verify the handoff.
- Successful verification marks the claim PICKED UP and item CLAIMED.
- Donor can mark NO-SHOW only after the 48-hour deadline; item returns to AVAILABLE.

### Pickup privacy / safety
- Exact address, instructions and contact phone live in a private marketplace_pickup_details table.
- Public Marketplace item rows contain only city/state/ZIP/pickup-area level data.
- Private pickup data is exposed to the approved claimant only through a restricted receipt RPC.
- Safe Pickup flag and safety education exist throughout the UI.
- Claimants cannot message donors in FairPath.
- After approval, the donor can send pickup-logistics messages to the selected claimant; the claimant can read them but does not get a reply composer.

### Donor/listing tools
- New listings start as private drafts, upload their media, then explicitly publish so partially-created listings never leak into browse.
- List a free item.
- Individual or organization donor type.
- Condition / quantity / category / description.
- Public area + private pickup details.
- Up to 20 listing photos.
- Public Marketplace media bucket with seller-scoped upload policies.
- Edit listing.
- Add/remove/reorder photos.
- First photo acts as cover.
- Pause / relist.
- Remove listing.
- My Listings dashboard.
- Anonymous Claim Manager.

### Member tools
- Saved Marketplace.
- My Claims dashboard.
- Claim allowance card.
- Claim detail workspace.
- Pickup deadline.
- Private pickup receipt.
- Pickup code.
- Claim activity history.
- Cancel claim.
- Pickup-only messaging.
- Marketplace notifications.

### Safety / Admin handoff
- Marketplace reports table and report UI.
- Prohibited-item policy copy: no weapons, drugs, alcohol, prescription medication, stolen/counterfeit goods or unsafe goods.
- Moderation status field: approved / pending / hidden / rejected.
- Admin will own report review and moderation tooling.

## Database / security
- marketplace_items remains the public listing record and is constrained to FREE / $0.
- marketplace_pickup_details stores private pickup information.
- marketplace_claims stores lifecycle and quota state.
- marketplace_claim_events provides audit history.
- marketplace_messages supports post-approval pickup coordination.
- marketplace_reports feeds Admin safety/moderation.
- Marketplace media is limited to 20 photos per item by DB trigger.
- Public listing/media RLS respects moderation status.
- Claim request/approval/verification use server RPCs rather than trusting the client.

## Transaction tests completed
- Free member first claim accepted.
- Free member second claim blocked with CLAIM_LIMIT_REACHED.
- FairPath+ temporary entitlement returned limit 7.
- Seller anonymous candidate RPC returned claim ID without claimant identity.
- Approval generated a 6-character pickup code and 48-hour deadline.
- Claim receipt became available after approval.
- Pickup-code verification moved claim to PICKED UP and item to CLAIMED.
- Tests were rolled back after verification.

## Still to close later
- Visual QR rendering / camera scan for pickup passes. The secure pickup-code flow is live now; QR should wrap the same claim verification contract rather than create a second lifecycle.
- Exact donor phone-number + 4-digit-code access. Native Supabase SMS OTP is not a 4-digit flow, so this must be implemented with a deliberate custom SMS/auth provider rather than faked inside the client. Architecture/options are locked in `docs/FAIRPATH_MARKETPLACE_DONOR_ACCESS.md`.
- Phone-OTP authentication if FairPath chooses to support phone-first account login.
- Marketplace Admin moderation queue.
- Push/email delivery on top of in-app notifications.
- Marketplace analytics dashboard.
- Optional distance/radius search once location/geocoding provider is connected.

## Handoff direction
Marketplace Admin should review reports, hidden/rejected listings, donor abuse and claim history. Marketplace does not need a separate Partner product unless organizations later need high-volume donation inventory tooling.


## Senior-engineering hardening notes
- Owners cannot self-feature listings or bypass moderation by directly updating `featured` / `moderation_status`; a database trigger preserves those Admin-controlled fields.
- Item creation is draft-first and publish-last.
- Claimant-to-donor messaging is disabled by policy and by UI.
- Donor pickup messaging is server-RPC backed and only available on approved/ready claims.
- The 48-hour window is enforced server-side and refreshed by Marketplace workflows; an automatic scheduled invocation can be added in the integrations/Admin sprint.
