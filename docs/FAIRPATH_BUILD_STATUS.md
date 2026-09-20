# FairPath Mobile — Build Status

Last updated: 2026-09-20

## Source of truth
Read this file and the latest commits on `main` before starting a new build chat. The repository is authoritative; chat memory is secondary.

## Current lane
**FairPath Mobile → Marketplace major build + Housing verification, then FairPath Partner**

Do not restart Jobs. Housing core is waiting on its short real-client verification. Marketplace is now a major active lane with its server-side claim/pickup model built. After Marketplace smoke testing + Housing verification, move primary engineering effort to FairPath Partner.

## Mobile architecture
- **FairPath Mobile** — renter/job-seeker/consumer experience.
- **FairPath Partner** — employers and property owners/managers.
- **FairPath Admin** — FairPath staff controls, moderation, support and operations.
- **FairPath Core** — shared data contracts, services, status logic and policy rules.
- **Supabase** — shared auth/database/storage backend.

## Completed — core mobile shell
- Auth: sign up, sign in, password reset/callback flows.
- Home / Find / Me navigation shell.
- FairPath profile + readiness foundation.
- Live in-app Notifications inbox backed by Supabase.
- FairPath AI, Record Relief, Forms/Filing, Credit Tools, Resources and Marketplace foundations.
- Jobs browse/detail/save/apply/application-tracking flows substantially built.
- Saved Jobs + Job Applications available from Me.
- Shared FairPath visual system: dark UI, lime `#A8F32C`, sharp product styling.
- Shared US phone + MM/DD/YYYY input formatting.
- Context-aware back navigation cleanup.
- GitHub automatic failing app-check workflow disabled; manual-only until green.

## Completed — Housing browse and discovery
- Public guest housing browsing.
- Search by keyword + stronger city/state/ZIP parsing.
- Advanced dedicated Filters screen.
- Bedrooms: Studio / 1+ / 2+ / 3+ / 4+ / 5+ while preserving exact listing bedroom counts.
- Bathrooms through 4+ including half-bath thresholds.
- Property types: apartment, townhome, house, duplex, condo, room.
- Rent, square footage, FastTrack, pets, accessibility, garage, parking, furnished, basement, yard, balcony/patio, laundry, central air, move-in-ready filters.
- Walk Score threshold model.
- Sorting: Featured, Price Low, Price High, Newest.
- Saved Housing Searches stored in Supabase and rerunnable.
- Saved Homes stored in Supabase with visual saved-home cards.
- Housing feed uses ordered `housing_media` cover photo data.
- Swipeable multi-photo gallery with thumbnail navigation.
- Demo property-image fallbacks removed; missing media uses honest no-photo states.
- List / native map modes.

## Completed — Housing listing detail
- Price, location, beds, baths, square footage, deposit, application fee, availability.
- Description, screening summary, lease terms, amenities, utilities, pet policy, parking and accessibility.
- Expanded home attributes: garage spaces, parking types, furnished, basement, yard, balcony/patio, laundry and central air.
- Property media: virtual tour, floor plan and video links.
- Source labeling / original listing link support.
- Verified Walk / Transit / Bike score surfaces when provider data exists.
- Source-backed schema and UI support for nearby schools and nearby grocery / parks / transit / healthcare / pharmacy.
- No fabricated FairPath neighborhood or school scores.
- Renter actions: Request Tour, Ask a Question, Report Listing / Safety Concern.
- Housing Activity center for tour requests and property questions.

## Completed — Housing applications
- Standard and FastTrack are distinct application choices on eligible properties.
- Standard starts clean; FastTrack can reuse available FairPath profile data.
- 5-step application: Applicant → Income → Household → Housing History → Review.
- Phone and date formatting.
- Field-level validation and step gating.
- Explicit final accuracy / submission consent.
- FastTrack acknowledgment before submit.
- Draft persistence + current-step persistence.
- Draft deletion and restart.
- Application workspace shows draft progress.
- Housing Applications dashboard shows Standard/FastTrack, progress, submission dates and status.
- Submitted lifecycle model: Submitted → Under Review → Tour / Next Step → Approved / Not Approved / Withdrawn.
- Submission service requires Supabase to return an actual submitted row before UI success.

## Submission bug status
The database accepts the application transition from `started` to `submitted` with `submitted_at` and consent data. A transaction test succeeded and was rolled back. The remaining failure was the Expo Web multi-button `Alert.alert` confirmation path: the final Submit callback was not reliably firing. The mobile form now submits directly after the on-screen consent checkboxes, then routes to the application workspace only after Supabase confirms success.

## Housing backend contracts added
- `housing_listings`
- `housing_media`
- `saved_housing`
- `saved_housing_searches`
- `housing_applications`
- `housing_schools`
- `housing_nearby_places`
- `housing_tour_requests`
- `housing_inquiries`
- `housing_reports`

## Housing closeout additions — 2026-09-20
- Server-side application validation now mirrors critical client requirements.
- Private Housing application document storage + metadata + RLS.
- Document picker/upload/delete UI.
- Property-specific required-document contract and server submit gate.
- FastTrack server quote/order contract: $75 base / $65 with active FairPath+.
- Contract-ready FastTrack checkout/status screen.
- FastTrack payment enforcement feature flag; OFF in development until a real provider is connected.
- Server test proved unpaid FastTrack is blocked when enforcement is ON and paid/waived is accepted.
- Live in-app notification inbox plus application/tour/inquiry notification triggers.
- Housing product-event analytics foundation.
- Security-definer trigger functions locked from direct API execution.
- Supabase security advisor now has no Housing-code warning; remaining warning is account-level leaked-password protection.
- Demo Housing image fallbacks removed.
- Corrupted duplicate code discovered in Housing Detail/Apply was removed and the Housing audit now detects that class of regression.
- Deep regression matrix: `docs/FAIRPATH_HOUSING_TEST_MATRIX.md`.
- Closeout source of truth: `docs/FAIRPATH_HOUSING_CLOSEOUT.md`.

## Housing integrations still external / not live
- Walk/Transit/Bike credentials + production ingestion.
- Schools API credentials + production ingestion / attribution.
- Nearby-place provider selection and ingestion.
- Real payment processor/webhooks for FastTrack.
- Remote push/email delivery.
- Crash-reporting provider.
- Saved-search match worker.

## Housing exit checklist before Partner/Admin
1. Pull/install the new document-picker dependency and reload Expo.
2. Verify application document pick/upload/delete on Web + one real phone.
3. Complete and submit one FastTrack application after this pass with payment enforcement OFF.
4. Verify Notifications opens the backfilled submission event and routes correctly.
5. Verify Tour + Inquiry → Housing Activity.
6. Verify List ↔ Map on a phone.
7. Run the manual GitHub `FairPath app checks` workflow and clear any remaining type/navigation failures.
8. Enable Supabase leaked-password protection before production.
9. Keep payment provider, push/email, school/neighborhood providers and crash reporting in the integrations sprint rather than faking them now.

## Partner handoff contracts already prepared
Partner will consume the existing shared tables for:
- Housing listing creation/editing.
- Media upload, reorder, cover selection, delete/replace (up to 20 photos).
- Applications and status updates.
- Tour requests.
- Renter inquiries.
- Listing reports routed to Admin.
- Schools / neighborhood data attribution.
- FastTrack availability flag.

## Git workflow
1. ChatGPT inspects current `main`.
2. ChatGPT makes coherent changes and pushes.
3. User: GitHub Desktop → **Fetch origin** → **Pull origin**.
4. Expo → reload (`r`).
5. User does visual/device QA only where needed.
6. Bugs are fixed against repo + Supabase state, not chat guesses.

## Parked architecture
Protection + Incentives remains documented in `docs/FAIRPATH_PROTECTION_AND_INCENTIVES_BLUEPRINT.md`. Preserve it, but do not let it block the 5-week launch path.


## Marketplace major build — 2026-09-20
- Free-item-only Marketplace enforced in database.
- Free plan = 1 claim/month; active FairPath+ = 7/month, server-authoritative.
- Search by keyword + city/state/ZIP, categories, condition, Safe Pickup, sorting.
- Saved Marketplace, My Claims, My Listings and donor listing management.
- Anonymous donor selection: seller Claim Manager receives claim IDs, not claimant identity/race/photo.
- Claimants cannot message donors. Selected donors may send pickup-logistics messages after approval.
- Approval starts a 48-hour pickup window and generates a secure pickup code.
- Exact pickup details remain private until approval.
- Correct pickup code completes claim + item handoff.
- No-show after deadline reopens item and remains counted against claimant quota.
- Donor-declined / pre-approval cancelled claims restore quota.
- Safe pickup + reporting/moderation contracts.
- Individual/organization donors.
- Up to 20 listing photos, cover/reorder/delete, edit, pause/relist/remove.
- Listing creation is draft-first, publish-last to prevent partially-created public inventory.
- Owner cannot self-feature or bypass Admin moderation fields.
- Marketplace notifications + product-event analytics foundation.
- Transaction tests passed for free quota, FairPath+ quota, anonymous claim flow, pickup verification, 48-hour expiration, and donor-only messaging.
- Exact 4-digit donor phone access and QR scanning remain deliberate integrations rather than fake client-side implementations.
- Marketplace claimant-to-donor message surface was removed at both schema and UI level; donor-only pickup logistics messaging remains after approval.
- Marketplace 48-hour expiration is now scheduled in Supabase every 15 minutes.
- Direct donor attempts to self-feature, bypass moderation, force price/status, or skip draft-first publishing are blocked/preserved by database guard logic.
- Post-hardening transaction test passed end-to-end after these final controls.
- Marketplace source of truth: `docs/FAIRPATH_MARKETPLACE_BUILD_STATUS.md`.
- Marketplace regression matrix: `docs/FAIRPATH_MARKETPLACE_TEST_MATRIX.md`.
