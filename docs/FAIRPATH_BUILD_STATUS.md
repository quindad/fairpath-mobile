# FairPath Mobile — Build Status

Last updated: 2026-09-20

## Source of truth
Read this file and the latest commits on `main` before starting a new build chat. The repository is authoritative; chat memory is secondary.

## Current lane
**FairPath Mobile → close Housing renter MVP**

Do not restart Jobs. Do not begin Partner/Admin until the Housing exit checklist below is cleared or explicitly deferred as a cross-product dependency.

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
- Notifications screen foundation.
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
- Demo galleries only when real listing media is absent.

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

## Housing integrations still external / not live
- Walk Score API credentials + production ingestion.
- GreatSchools API credentials + production ingestion / attribution.
- Nearby-place provider selection and ingestion.
- Real payment processor for FastTrack fees / FairPath+ discounts.
- Push/email delivery for saved-search alerts and application-status notifications.
- File storage + document upload workflow for income/identity/application documents.

## Housing exit checklist before Partner/Admin
These are the remaining mobile-Housing items to clear or explicitly defer:
1. Confirm Standard submission works end-to-end on Expo Web after commit `157001e0`.
2. Confirm FastTrack submission works end-to-end with required fields and acknowledgments.
3. Add application submission receipt / clear post-submit status UX if needed after visual QA.
4. Add document-upload/storage workflow or explicitly defer uploads to the Partner sprint with a locked “Documents coming next” state.
5. Decide FastTrack payment processor and implement payment handoff before charging real users.
6. Connect notification delivery for application status / tour response / inquiry response / saved-search alerts.
7. Connect real neighborhood + school providers when credentials are available.
8. Run one final Housing regression pass: guest browse → auth → save → filters → saved search → listing → tour/inquiry/report → Standard apply → FastTrack apply → application dashboard.
9. Re-enable CI only after the manual typecheck/navigation suite is green; never re-enable noisy failing push emails.

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
