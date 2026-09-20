# FairPath — 5 Week Execution Plan

Target: working FairPath Mobile + Partner + Admin + public website in five weeks.

## Product architecture
- **FairPath Mobile** — justice-impacted user experience: Jobs, Housing, Marketplace, Resources, profile/readiness, applications.
- **FairPath Partner** — employer and property-owner operating portal.
- **FairPath Admin** — FairPath staff operations, moderation, support, fraud and analytics.
- **FairPath Core / Supabase** — shared data model, permissions, rules, application lifecycle, billing state and audit events.
- **Public Website** — marketing, trust, acquisition, product explanation and Partner conversion. It should not become the operational Partner/Admin app.

## Week 1 — close renter core and stabilize
Primary goal: Mobile becomes stable enough that Partner can be built against real workflows.

- Close Housing P0 submission reliability.
- Run/fix manual TypeScript and navigation checks.
- Finish application documents data model and upload UX.
- Define FastTrack payment contract and checkout states.
- Define notification/event contract used by Jobs + Housing.
- Remove demo-only behavior from production mode.
- Freeze Mobile Housing database contracts for Partner.
- Keep Jobs stable; only fix regressions.

**Week 1 exit:** renter can search → save → apply → submit → track, and the Partner requirements are frozen.

## Week 2 — FairPath Partner MVP
Build a web-first Partner portal against the same Supabase project.

### Shared Partner shell
- Partner auth
- Organization profile
- Role-based access
- Dashboard
- Billing/plan state
- Notifications/activity

### Employer side
- Create/edit jobs
- Publish/pause/close
- Candidate/application inbox
- Application status updates
- Job analytics

### Property side
- Create/edit listings
- 20-photo manager
- Cover/reorder/delete/replace
- Screening/lease/amenity fields
- Publish/pause availability
- Applications inbox
- Tour requests
- Renter questions
- Status updates

**Week 2 exit:** a real employer/property manager can create inventory and act on renter activity.

## Week 3 — FairPath Admin MVP
- Admin auth/roles
- User search
- Partner search
- Organization verification
- Job/listing moderation
- Housing reports/fraud queue
- Application audit trail
- Source/ingestion monitoring
- Billing/support overrides
- Feature flags
- Basic operational analytics
- Manual notification tools

**Week 3 exit:** FairPath staff can operate the marketplace without touching Supabase manually.

## Week 4 — website, integrations, money and communications
### Public website
Fastest path for the five-week target: rebrand the existing Wix site into the FairPath public marketing site.

Core pages:
- Home
- Find Jobs
- Find Housing
- For Employers
- For Property Owners
- For Reentry / Community Partners
- FairPath+
- FastTrack Housing
- About / Friend A Felon → FairPath story
- Safety / Trust
- Help / Contact
- Privacy / Terms

Website CTAs should send users to the app and partners to FairPath Partner.

### Integrations
- Payments / FastTrack
- Email/push notifications
- Walk / Transit / Bike provider
- Schools provider
- Analytics / crash reporting
- Production email/domain configuration

**Week 4 exit:** acquisition, billing and communication paths are connected.

## Week 5 — hardening and launch
- Full end-to-end regression
- Permission/RLS review
- Mobile responsive/device pass
- Partner/Admin desktop responsive pass
- Seed real launch inventory
- Remove stale demo data
- Legal/privacy copy review
- App icons/splash/store assets
- Production environment variables
- Backups/monitoring
- Beta group
- Fix launch blockers only
- Deploy Partner/Admin/web
- Prepare App Store / Play Store submission

**Week 5 exit:** launch candidate, not an endless feature branch.

## Engineering rules for the five-week sprint
1. One shared Supabase production contract; no duplicate data models between apps.
2. Every important state change writes an auditable event.
3. Mobile never fakes a Partner/Admin action.
4. Partner/Admin actions must immediately reflect in Mobile.
5. Critical writes use server-side/RPC or otherwise transaction-safe backend paths when multi-step state matters.
6. CI stays manual until green; once green, automatic CI can return with controlled notifications.
7. Separate launch blockers from post-launch improvements.
8. No visual polish pass should block an end-to-end workflow.

## After the five-week launch
- Protection + Incentives
- More state-specific screening/incentive logic
- Advanced partner analytics
- Automated fraud/risk tooling
- Deeper FairPath AI workflows
- Expanded Marketplace and reentry workflows
