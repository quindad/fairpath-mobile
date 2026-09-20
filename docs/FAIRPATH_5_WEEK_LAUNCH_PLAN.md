# FairPath — 5 Week Launch Plan

Target: close FairPath Mobile, ship Partner + Admin web operations, finish the FairPath marketing website, and leave the system launchable rather than demo-only.

## Delivery principle
Five weeks is achievable only if we separate **launch-critical** from **post-launch depth**. We are not cloning every Zillow/Indeed/Admin feature before launch. We are shipping complete user journeys, strong data contracts, honest states, and operational controls; deeper automation can layer on after launch.

## Product surfaces
### 1. FairPath Mobile
Consumer app for jobs, housing, marketplace, resources, readiness and FairPath tools.

### 2. FairPath Portal
Recommended implementation for speed: one Next.js/Supabase web codebase with separate role-gated Partner and Admin areas.
- `/partner` — employers + property owners/managers.
- `/admin` — FairPath staff.
- Shared auth, design system, database types, tables, forms and audit utilities.
- Role-based routing/RLS prevents Partner and Admin permissions from blending.

This is faster and safer to ship in five weeks than two unrelated web applications.

### 3. FairPath Marketing Website
Keep the marketing site on Wix for the five-week launch window. Do not rebuild the public marketing site in custom code while Partner/Admin still need to ship.
- Rebrand Friend A Felon → FairPath.
- Explain the transition respectfully.
- Primary message: **Opportunity Has a Path.**
- Supporting campaign language: **FairPath Forward.**
- Drive visitors to Download / Find Jobs / Find Housing / Partner With FairPath / Resources.
- Separate Employer and Property Owner acquisition pages.
- Keep product portals outside Wix.

---

# WEEK 1 — Close FairPath Mobile

## Housing — launch critical
- Verify Standard + FastTrack submission end-to-end.
- Finish post-submit receipt/status UX.
- Verify saved homes/searches, sorting and filters.
- Verify tour request / inquiry / report flows.
- Decide document upload launch scope.
- Decide FastTrack payment handoff and FairPath+ discount handling.
- Real notification event model for application status, tour responses and inquiries.
- Final Housing regression test.

## Jobs — regression / finish
- Run Job browse/detail/save/application regression.
- Confirm Easy Apply, external apply and saved job states.
- Confirm job application lifecycle and Me links.
- Fix remaining type/runtime errors discovered during manual suite.

## Mobile platform
- Auth/session regression.
- Back-button/navigation regression.
- Profile/readiness regression.
- Empty/loading/error states.
- Remove accidental demo-only behavior from production paths.
- Manual TypeScript + route audit green.
- Prepare environment/config strategy for dev vs production.

**Week 1 exit:** a consumer can create an account, browse jobs/housing, save, apply, track applications and return to account state without broken routes or fake success.

---

# WEEK 2 — FairPath Partner MVP

Create a new `fairpath-portal` repo with Next.js + Supabase.

## Shared Partner onboarding
- Partner sign up/sign in.
- Organization profile.
- Partner type: Employer / Property Owner / Both.
- Role membership and organization permissions.
- Verification status.
- Dashboard.

## Employer Partner
- Create/edit/publish/close jobs.
- Company website and job media/location.
- Second-chance policy fields.
- Easy Apply settings + application questions.
- View applicants.
- Applicant detail.
- Update status: viewed / interview / offer / hired / rejected.
- Basic applicant notes.
- Pricing/plan UI wired to entitlements; real billing only when processor is ready.

## Property Owner Partner
- Create/edit/publish/unpublish listings.
- Listing details matching Mobile filters.
- Up to 20 property photos.
- Reorder photos.
- Set cover photo.
- Replace/delete media.
- Screening criteria.
- FastTrack enable/disable.
- View Standard/FastTrack applications.
- Application detail.
- Status updates.
- Tour-request queue.
- Inquiry queue + response state.

**Week 2 exit:** a real employer/property owner can create inventory and work applications from desktop without FairPath staff touching Supabase manually.

---

# WEEK 3 — FairPath Admin MVP

## Admin shell
- Staff auth + admin role gate.
- Dashboard metrics.
- Search users, partners, jobs, listings and applications.

## Moderation / operations
- Approve/suspend partners.
- Review/publish/unpublish jobs and housing.
- Review listing reports.
- Review suspected scams/safety concerns.
- View applications and timelines.
- View tour requests/inquiries for support.
- Manual status correction with audit trail.

## Content / product controls
- Featured jobs/listings.
- Source labels.
- Demo vs live flags.
- Resource/content management where practical.
- FairPath+ entitlement view.
- FastTrack pricing configuration surface.

## Audit/security
- Admin action audit log.
- RLS review.
- Security Advisor review.
- Sensitive-field handling review.

**Week 3 exit:** FairPath can operate, moderate and support the marketplace without database-console work for normal operations.

---

# WEEK 4 — Website, billing, notifications, integrations

## Wix marketing site
- Home.
- About FairPath / Friend A Felon transition.
- Jobs.
- Housing.
- Employers.
- Property Owners.
- Reentry / Resources.
- FairPath+.
- Contact / Support.
- Privacy / Terms / acceptable-use and relevant disclosures.
- App download / web portal CTAs.
- SEO titles/descriptions and social share assets.

## Billing
- Select payment processor.
- FairPath+ $2/month entitlement.
- FastTrack base fee $75.
- FairPath+ FastTrack price $65.
- Employer/property-owner plans.
- Receipts / payment states.
- Never mark paid until processor confirms.

## Notifications
- In-app event records.
- Email provider.
- Push provider.
- Saved-search notifications.
- Application-status updates.
- Tour/inquiry response notifications.

## External housing intelligence
- Walk Score credentials/integration.
- GreatSchools credentials/integration + attribution.
- Nearby places provider if launch critical.

**Week 4 exit:** acquisition, pricing, billing and communication loops connect the product surfaces.

---

# WEEK 5 — Hardening and Launch

## QA matrix
- iOS / Android / web where supported.
- Guest vs signed-in.
- Standard vs FastTrack.
- Partner roles.
- Admin role.
- Failure states / offline-ish states / duplicate taps.
- Deep links and back navigation.

## Data/security
- RLS policy audit.
- Supabase Security + Performance Advisors.
- Production seed/demo separation.
- Backups and recovery plan.
- Rate limiting / abuse controls where required.
- Validate no service-role key ships to clients.

## Product operations
- Analytics/events.
- Error tracking.
- Support flow.
- Content/report escalation.
- App Store / Play Store metadata and screenshots if native launch is in scope.
- Production environment variables and domains.
- Final launch checklist and rollback plan.

**Week 5 exit:** launch candidate with operating procedures, not just working screens.

---

# Housing scope after launch
These are strong “big-box app” upgrades but should not block the five-week launch unless a customer/partner requires them:
- Full interactive map-cluster search.
- Commute-time search.
- Side-by-side home comparison.
- Rich landlord/property reviews.
- Rental affordability calculator.
- AI property recommendations.
- Automated school/neighborhood refresh jobs.
- Advanced fraud scoring.
- Full document verification vendor.
- E-signatures / lease execution.
- Credit/background screening provider.
- Real-time chat threads.
- Recommendation ranking/personalization.

# Website / Portal decision
**Recommended five-week architecture**
- Marketing: Wix.
- Mobile: existing Expo/React Native repo.
- Partner + Admin: one new Next.js `fairpath-portal` repo with two role-gated surfaces.
- Backend: existing Supabase project, with stricter roles/RLS and shared Core contracts.
- Do not rebuild the Wix marketing site or split Partner/Admin into multiple repos until launch pressure is off.

# Definition of “done”
A feature is not done because the screen exists. It is done when:
1. The user can enter the flow from the real app.
2. Required auth/permissions are enforced.
3. Data persists correctly.
4. Errors and empty states are handled.
5. Success is confirmed by the backend.
6. Back navigation works.
7. The next surface can consume the same data.
8. There is no fake success, fake provider data, or fake payment state.
