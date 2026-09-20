# FairPath Housing — Closeout Checklist

Last updated: 2026-09-20

## Definition of done for FairPath Mobile Housing
FairPath Mobile Housing is feature-complete when a renter can discover a real listing, evaluate it, save/search it, contact the property side, complete either a Standard or FastTrack application, submit it reliably, and track its lifecycle without fake approval, payment, provider data, or partner response.

## Built now

### Discovery
- Public housing browse
- Search by keyword and city/state/ZIP
- List and map modes
- Sorting: featured, price low, price high, newest
- Advanced filters: rent, beds, baths, property type, square feet, garage, parking, furnished, basement, yard, balcony/patio, laundry, central air, move-in ready, pets, accessibility, FastTrack, minimum Walk Score
- Saved searches
- Saved homes

### Listing evaluation
- Multi-photo gallery and ordered thumbnails
- Exact beds, baths, square feet, rent, deposit, application fee, availability
- Lease terms, screening summary, amenities, utilities, pet policy, parking and accessibility
- Home features
- Walk / Transit / Bike data contract
- Schools and nearby-place data contract with source attribution
- Virtual tour, floor plan and video links
- Listing source visibility
- Report-listing flow

### Renter-to-property actions
- Ask-a-question flow backed by housing_inquiries
- Tour-request flow backed by housing_tour_requests
- Housing Activity screen for questions and tour requests
- Tour cancellation while still requested

### Applications
- Standard and FastTrack are separate renter choices
- Standard starts clean
- FastTrack can prefill reusable FairPath profile information
- Five-step application: Applicant → Income → Household → History → Review
- US phone and MM/DD/YYYY input formatting
- Required-field validation before advancing
- Explicit final submission confirmations
- Draft save/resume
- Draft delete/restart
- Housing Applications dashboard
- Application workspace with draft progress and lifecycle
- Transactional Supabase submit RPC
- Application event history foundation
- Submitted timestamp and status tracking
- Submitted-application withdrawal

## P0 — finish before calling Mobile Housing closed
1. Verify the new transactional submit RPC from the real Expo client for Standard and FastTrack.
2. Re-enable a clean manual CI/typecheck run and fix every remaining TypeScript/navigation error before automatic CI is restored.
3. Remove demo housing/media from production mode and confirm published-listing empty/error/loading states.
4. Add application document metadata + upload flow for proof of income / ID / other property-required documents.
5. Add FastTrack checkout/billing flow. Current pricing/business rules must be enforced in backend, not only UI.
6. Add renter notifications for application status, tour changes, inquiry responses and saved-search matches.
7. Connect real neighborhood/school providers and obey attribution/licensing requirements.
8. Add analytics + error/crash instrumentation for search, save, start app, submit app, tour, inquiry and checkout.
9. Final mobile accessibility, keyboard, small-screen and slow-network pass.

## Partner-dependent Housing work
These belong in FairPath Partner and should not block moving the mobile code lane forward:
- Property owner/manager onboarding
- Create/edit/publish/unpublish listings
- 20-photo upload, reorder, replace, delete and cover selection
- Screening criteria editor
- Availability/unit management
- View renter applications
- Change application status
- Review documents
- Respond to renter inquiries
- Confirm/decline/reschedule tours
- Property plan/subscription controls
- Lead/application analytics

## Admin-dependent Housing work
- Property/partner verification
- Listing moderation
- Report/fraud review
- Application audit view
- Partner account controls
- Billing/support overrides
- School/neighborhood provider monitoring
- Marketplace/source ingestion monitoring
- Feature flags and operational metrics

## Exit rule
Do not keep polishing Mobile Housing forever. Once the P0 mobile items that do not depend on Partner are stable, switch primary engineering effort to FairPath Partner. Partner is what turns the renter-side Housing experience into a complete two-sided product.
