# FairPath Housing — Closeout Status

Last updated: 2026-09-20

## Definition of done
FairPath Mobile Housing is ready to hand off to Partner when the renter can discover a published listing, evaluate it honestly, save/search it, contact the property side, complete Standard or FastTrack, satisfy property-required documents, submit through a server-enforced workflow, and track the lifecycle without fake approval, payment, provider data, or partner response.

## CLOSED — renter product core

### Discovery
- Public guest browse.
- Keyword + city/state/ZIP search.
- List and native map modes.
- Sorting: featured, price low, price high, newest.
- Advanced rent / beds / baths / property / square feet / home-feature / accessibility / pet / FastTrack / Walk Score filters.
- Saved Homes.
- Saved Housing Searches.
- Real no-results, loading and no-photo states.
- Demo property-image fallbacks removed from Housing browse, detail and Saved Homes.

### Listing evaluation
- Ordered photo gallery + thumbnails.
- Honest no-photo state.
- Rent, beds, baths, square feet, deposit, listed application fee, availability.
- Upfront-cost snapshot using only listed values.
- Screening, lease, amenities, utilities, pet policy, parking, accessibility and expanded home features.
- Virtual tour / floor plan / video links.
- Source/original-listing visibility.
- Walk / Transit / Bike provider contract.
- Schools + nearby grocery/parks/transit/healthcare/pharmacy provider contracts with attribution fields.
- Report Listing / Safety Concern.

### Renter/property communication
- Ask-a-question flow backed by housing_inquiries.
- Tour-request flow backed by housing_tour_requests.
- Housing Activity center.
- Pending tour cancellation.
- Partner-response fields now exist for inquiry responses, confirmed tour date/time and partner notes.
- In-app notifications trigger when those Partner responses/statuses arrive.

### Applications
- Standard and FastTrack are separate choices.
- Standard starts clean.
- FastTrack can reuse available FairPath profile data.
- Applicant → Income → Household → Housing History → Review.
- Phone + MM/DD/YYYY formatting.
- Client validation and step gating.
- Server-side validation in submit_housing_application; a modified client cannot bypass required core answers.
- Explicit accuracy/submission consent.
- Server-enforced FastTrack acknowledgment.
- Draft save/resume, current step, delete/restart.
- Property-specific required-document contract.
- Private 10 MB document storage bucket with applicant-scoped RLS.
- PDF/JPG/PNG/HEIC picker/upload/delete UI.
- Required-document gating in client and submit RPC.
- Transactional submission RPC.
- Submitted timestamp, consent snapshot and applicant snapshot.
- Application event history.
- Application status workspace + dashboard.
- Submitted application withdrawal.

### FastTrack money contract
- Backend quote is authoritative: $75 base.
- Active FairPath+ entitlement applies $10 discount → $65.
- housing_fasttrack_orders persists amount/status/provider IDs.
- FastTrack checkout/status screen exists.
- app_config.fasttrack_payment_enforced is currently false for development.
- When enforcement is true, unpaid FastTrack submissions fail server-side with PAYMENT_REQUIRED.
- Paid/waived status allows submission.
- Transaction tests passed for $75 quote, $65 FairPath+ quote, unpaid block and paid submit.
- Real card charging is intentionally NOT faked; a payment provider still must be connected before enforcement is enabled in production.

### Notifications + analytics
- Live in-app notification inbox replaces the old placeholder.
- Application status, tour status and inquiry response triggers create notification rows.
- Existing submitted applications were backfilled into event/notification history.
- Housing search/save/application/tour/inquiry/report event instrumentation foundation exists in product_events.
- Push/email delivery remains an external integration.

### Security / backend verification
- Applicant application/document RLS is in place.
- Document storage is private and user-path scoped.
- Document metadata isolation was transaction-tested with a second auth user.
- Standard submit server validation was transaction-tested and rolled back.
- Required-document submit gate was transaction-tested and rolled back.
- FastTrack payment enforcement path was transaction-tested and rolled back.
- Trigger SECURITY DEFINER functions are no longer directly executable by anon/authenticated users.
- Current Supabase security advisor now reports only the account-level leaked-password-protection setting as a warning.
- Housing-specific missing-FK-index warnings introduced by this pass were corrected.

### Code integrity
- Corrupted duplicated code blocks discovered in Housing Detail and Housing Apply were removed.
- Housing static audit now detects duplicate StyleSheet blocks, conflict markers, duplicate Housing helpers, demo-media regressions, payment/document regressions, package-lock drift and accidental automatic CI.
- Repository-equivalent audit performed after cleanup: PASS.
- GitHub app-check workflow remains manual-only to prevent another failure-email flood.

## NEEDS REAL-CLIENT VERIFICATION
These are code-complete enough to test, but the final proof must come from Expo/device behavior:
1. Pick/upload/delete a Housing application document on Expo Web and a real phone.
2. Submit one FastTrack application after this closeout pass with payment enforcement OFF.
3. Open Notifications and verify the existing submission notification routes back to the correct application.
4. Request a tour and send an inquiry; verify both appear in Housing Activity.
5. List → Map → List on a phone with real coordinates.
6. Run the manual GitHub workflow after dependencies install cleanly: typecheck + navigation audit + Housing audit.

## EXTERNAL INTEGRATIONS — intentionally not faked
These do not justify keeping the Mobile Housing coding lane open while Partner starts:
- Real payment processor / webhook connection.
- Remote push and transactional email provider.
- Walk/Transit/Bike credentials + ingestion.
- Schools provider credentials + licensing/attribution approval.
- Nearby-place provider/ingestion.
- Crash-reporting provider.
- Saved-search matching/delivery worker.

Their database/UI contracts exist where needed. Connect them during the integrations sprint.

## ONE MANUAL SECURITY SETTING
Supabase currently warns that leaked-password protection is disabled. Enable it in Supabase Auth password/security settings before production launch.

## PARTNER-DEPENDENT HOUSING
Move these to FairPath Partner:
- Partner/property onboarding and role access.
- Create/edit/publish/pause listings.
- 20-photo manager: upload, reorder, cover, replace, delete.
- Property-required application documents.
- Screening criteria / lease / amenities / availability management.
- Applications inbox and applicant review.
- Document review/accept/reject.
- Application status + decision notes.
- Inquiry response.
- Tour confirm/decline/reschedule.
- Property subscription/billing.
- Lead/application analytics.

## ADMIN-DEPENDENT HOUSING
Move these to FairPath Admin:
- Partner/property verification.
- Listing moderation.
- Housing report/fraud queue.
- Application audit trail.
- Billing/payment overrides.
- FastTrack payment-enforcement toggle.
- Provider monitoring.
- Operational analytics and feature flags.

## Exit rule
After the NEEDS REAL-CLIENT VERIFICATION list is green, treat FairPath Mobile Housing as frozen except for launch-blocking regressions. Primary engineering effort moves to FairPath Partner.
