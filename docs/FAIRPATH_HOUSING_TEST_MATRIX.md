# FairPath Housing — Deep Test Matrix

Last updated: 2026-09-20

This is the release test plan for the renter-side Housing product. Run the fast smoke test after every large Housing change. Run the full regression before switching primary engineering effort to FairPath Partner and again before launch.

## Test environments

### A. Expo Web — fastest functional loop
Best for:
- routing
- search and filters
- auth redirects
- Standard/FastTrack forms
- application submission
- Supabase reads/writes
- saved homes/searches
- notifications inbox
- most document-picker behavior

Do not treat Web as final proof for:
- native map gestures
- mobile keyboard behavior
- iOS/Android document picker details
- release-build performance
- push notifications

### B. Expo Go on a real phone
Best for:
- touch targets
- phone/date keyboards
- scrolling
- document picker
- gallery gestures
- Android/iOS layout
- deep mobile usability

Remote push notifications are not the launch test here; use a development build when push is connected.

### C. Development build / release candidate
Required before launch for:
- push notifications
- app icons/splash
- native permissions
- production map behavior
- crash reporting
- release-only issues

### D. Supabase verification
Use after critical writes:
- application submit
- document upload metadata
- tour request
- inquiry
- report
- notification creation
- FastTrack quote/order

The UI is not considered proof of a write until the corresponding database row/state exists.

## 10-minute smoke test

1. Open Find Housing while logged out.
2. Search a city/state or ZIP.
3. Toggle 2+ beds, FastTrack, then open full Filters.
4. Use beds/baths/property/home filters and apply them.
5. Switch List → Map → List.
6. Open a property with photos and one without photos.
7. Attempt Save while logged out → auth flow should preserve intent.
8. Log in and Save the home.
9. Save the search.
10. Request a tour and send a property question.
11. Start a Standard application.
12. Try advancing with required fields missing → must block.
13. Complete all steps, upload one small PDF/image, accept confirmations, submit.
14. Confirm status becomes SUBMITTED and Activity contains APPLICATION SUBMITTED.
15. Open Notifications → submission notification should exist.
16. Start FastTrack on another eligible home.
17. Confirm profile data prefills where available and missing fields still block progress.
18. Confirm FastTrack fee quote is $75, or $65 when FairPath+ entitlement is active.
19. Submit FastTrack while payment enforcement is OFF in development.
20. Check Housing Applications, Saved Homes, Saved Searches and Housing Activity.

## Full regression

### Guest discovery
- Guest can browse without authentication.
- Logged-out header does not pretend the user is signed in.
- Search: keyword only.
- Search: city only.
- Search: "Columbus OH".
- Search: "Columbus, OH".
- Search: ZIP.
- Empty search.
- No-results state.
- Loading/error state.
- Sort Featured / Price Low / Price High / Newest.
- Map with located homes.
- Map with no coordinates.

### Filters
- Rent minimum.
- Rent maximum.
- Studio.
- 1+ / 2+ / 3+ / 4+ / 5+ bedrooms.
- 1+ / 1.5+ / 2+ / 2.5+ / 3+ / 4+ bathrooms.
- Apartment / Townhome / House / Duplex / Condo / Room.
- Minimum square feet.
- Garage.
- Parking.
- Furnished.
- Basement.
- Yard.
- Balcony / patio.
- Laundry.
- Central air.
- Move-in ready.
- Pets.
- Accessibility.
- FastTrack.
- Walk Score threshold.
- Clear filters.
- Back button returns to the prior Housing state.

### Property detail
- Real ordered gallery.
- No-photo state never shows unrelated/demo property media.
- Thumbnail controls.
- Save/unsave.
- Price / beds / baths / square feet.
- Deposit / fee / availability.
- Cost snapshot math.
- Screening.
- Lease.
- Amenities.
- Utilities.
- Pet policy.
- Parking.
- Accessibility.
- Home features.
- Walk/Transit/Bike only when provider data exists.
- Schools only when source-backed rows exist.
- Nearby places only when source-backed rows exist.
- Virtual tour / floor plan / video links.
- Source/original listing link.
- Report listing.
- Ask question.
- Request tour.

### Saved Housing
- Save home from feed.
- Save home from detail.
- Saved Homes shows real image or honest no-photo state.
- Unsave from Saved Homes.
- Saved search stores current query/filters/sort.
- Rerunning saved search reconstructs state.
- Deleting saved search removes it.

### Tour / inquiry
- Invalid tour date blocks.
- Future tour date submits.
- Tour request appears in Housing Activity.
- Pending tour can be cancelled.
- Confirmed date/time fields display when Partner writes them.
- Question under minimum length blocks.
- Question submits.
- Partner response text displays when populated.
- Notification created when tour status or inquiry response changes.

### Standard application
- Starts clean.
- Phone formats (###) ###-####.
- DOB formats MM/DD/YYYY.
- Invalid email blocks.
- Invalid DOB blocks.
- Empty current address blocks.
- Employment status required.
- Employer/income-source conditional logic.
- Monthly income accepts 0.
- Move-in date required.
- Occupants must be >= 1.
- Pets must be answered.
- Housing history required.
- Reference or explicit "None available" required.
- Draft persists when leaving.
- Current step persists.
- Previous-step navigation saves.
- Delete draft actually deletes and permits a restart.
- Document upload supports PDF/JPG/PNG/HEIC under 10 MB.
- Oversized file blocks.
- User can delete an unreviewed upload.
- Final confirmations required.
- Confirm & Submit creates a real submitted row + timestamp.
- Submission creates application event.
- Submission creates in-app notification.
- Workspace displays submitted state and event history.
- Submitted application can be withdrawn.

### FastTrack application
- Renter can choose Standard even when FastTrack is offered.
- FastTrack prefill only uses available FairPath profile data.
- Prefilled fields remain editable.
- Missing fields still block advancement.
- FastTrack acknowledgment is required.
- Quote is server-derived, not UI hard-coded.
- Base price = $75.
- Active FairPath+ discount = $10 → $65 due.
- When payment enforcement is false, development submission remains testable.
- Before production launch, turn payment enforcement on only after the payment provider writes paid/waived order state.
- When enforcement is on and order is unpaid, submission must return PAYMENT_REQUIRED.

### Notifications
- Submission notification.
- Review/status notification.
- Tour status notification.
- Inquiry-response notification.
- Unread state.
- Open notification routes correctly.
- Mark one read.
- Mark all read.

### Security / privacy
- User A cannot read User B applications.
- User A cannot read User B documents.
- User A cannot read User B notifications.
- Storage path is private and user-scoped.
- Document bucket rejects files above 10 MB.
- Document bucket rejects unsupported MIME types.
- Guests cannot create application/tour/inquiry rows.
- Published listings remain public-readable.
- Never display fake school/neighborhood data.

## Database verification queries

Use the authenticated app plus Supabase dashboard/SQL editor to confirm states. Do not paste secrets into chat.

Check latest applications:
```sql
select id,user_id,listing_id,status,application_type,current_step,submitted_at,updated_at
from public.housing_applications
order by updated_at desc
limit 20;
```

Check application events:
```sql
select application_id,event_type,created_at,metadata
from public.housing_application_events
order by created_at desc
limit 50;
```

Check documents:
```sql
select application_id,document_type,file_name,status,size_bytes,created_at
from public.housing_application_documents
order by created_at desc
limit 50;
```

Check notifications:
```sql
select user_id,category,title,read_at,created_at
from public.user_notifications
order by created_at desc
limit 50;
```

Check FastTrack orders:
```sql
select application_id,user_id,base_amount_cents,discount_cents,amount_due_cents,status,provider
from public.housing_fasttrack_orders
order by updated_at desc
limit 50;
```

## Automated/manual code checks

Run locally:
```bash
npm ci
npm run typecheck
npm run test:navigation
npm run test:housing
```

GitHub Actions stays manual-only until these pass cleanly. From GitHub: Actions → FairPath app checks → Run workflow.

## Release blockers vs deferred integrations

### Must be green before Mobile Housing freeze
- Standard submit.
- FastTrack submit.
- Documents metadata/storage.
- Saved/search/tour/inquiry/report flows.
- Notifications inbox.
- RLS isolation checks.
- No demo property media.
- Typecheck/navigation/Housing audit.

### Can be integration-gated while we begin Partner
- Payment processor checkout UI/provider credentials.
- Remote push/email delivery.
- Walk/Transit/Bike ingestion credentials.
- Schools provider credentials/attribution approval.
- Crash-reporting provider.

Their data contracts are built; do not fake live provider output while credentials are missing.
