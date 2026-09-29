# Boardroom demo runbook

For Sterling to run himself, no technical background assumed. Every step names exactly what to click, what
should happen, and what to say. Built from what this session actually verified — either live in the Browser
pane earlier tonight, or read directly in the code and proven at the database layer (SQL/RLS tests). Steps
marked **[NOT LIVE-VERIFIED TONIGHT]** are believed correct from code + automated tests but were not personally
clicked through in a signed-in session this pass (no DEV member credentials were available). Run through the
whole thing yourself once before presenting — that single pass is also your live verification.

## Before you start

- **Sign in with your own real DEV test account** (whichever one you normally use). This runbook can't hand you
  one — it doesn't know your login.
- Confirm you're pointed at the DEV environment, not production. Every screen that shows fixture data will say
  "FairPath DEV Seed," "TEST DATA," or similar — if you see that language, you're in the right place.
- DEV currently has 109 published job listings and 76 housing listings (confirmed count as of this session) —
  real enough volume that search/filter/sort will look populated, not empty, even though it's fixture content.

## The path (~12-15 minutes)

### 1. Home
**CLICK:** Open the app, land on Home.
**EXPECTED:** A "Featured" section with 2 job cards, your overall readiness percentage.
**SAY:** "This is the member's front door — a snapshot of where they stand, not a wall of menus."

### 2. Opportunity Profile
**CLICK:** Me → Opportunity Profile (or the profile completion prompt on Home if one shows).
**EXPECTED:** 8 sections (contact, location, work experience, education, skills, preferences, availability,
transportation), each showing complete/incomplete.
**SAY:** "Everything downstream — Easy Apply, resumes, matching — pulls from this one profile. Members fill it
out once."

### 3. Jobs
**CLICK:** Find Jobs (bottom nav or Home).
**EXPECTED:** 109 results load. Try a filter (e.g. "Second Chance" toggle) — the count changes.
**CLICK:** Open any listing with an "EASY APPLY" badge → Apply.
**EXPECTED:** The application form pre-fills from the Opportunity Profile you just looked at.
**SAY:** "Second-chance friendly listings are explicitly labeled — never inferred, only shown when a real
employer has stated it."

### 4. Housing
**CLICK:** Find Housing.
**EXPECTED:** 76 results. Open a listing marked "FASTTRACK AVAILABLE."
**SAY:** "FastTrack is a paid expedited-application product — FairPath+ members get a discount, we'll show that
on the Plus screen in a minute."
**DO NOT** attempt an actual FastTrack purchase unless Stripe/payments are confirmed connected in this
environment — check with engineering first if unsure.

### 5. Early Access (zero-coverage state)
**CLICK:** Search housing or jobs in a ZIP code that FairPath doesn't cover yet (any ZIP outside the seeded
coverage markets works — ask engineering for a guaranteed-uncovered test ZIP beforehand, or use a rural/small
ZIP unlikely to be seeded).
**EXPECTED:** Instead of a bare "no results," an explanation that FairPath is expanding and an offer to join
Early Access. Submit it.
**EXPECTED:** Confirmation, and re-submitting the same ZIP shows "already enrolled" — not a duplicate.
**SAY:** "We never show a dead end. Every uncovered ZIP becomes a lead, not a bounce."

### 6. Resources
**CLICK:** Resources → search something like "food" or "ID help."
**EXPECTED:** Real results with an organization name, verification badge, and category.
**CLICK:** Save one.
**SAY:** "Every resource here is independently verified before it's ever shown to a member — nothing here is
scraped or guessed."

### 7. Marketplace
**CLICK:** Marketplace (bottom nav).
**EXPECTED:** A grid of free donated items. Open one, request a claim.
**EXPECTED:** Claim shows as pending; the donor side (if you have a second test account) would see an anonymous
"CLAIM #XXXX" request, never the claimant's real identity, until they choose to approve it.
**SAY:** "Marketplace is entirely free-item donation and pickup — never a marketplace for buying/selling. Claim
identity stays private until the donor picks someone."
**[NOT LIVE-VERIFIED TONIGHT]** — 17/17 adversarial database tests pass; the click-through itself wasn't
re-driven live this session.

### 8. Credit Builder
**CLICK:** Credit Builder (from Me, under FairPath+ features).
**EXPECTED:** Sample/test credit report data with flagged items for review, and a clear explanation that
accurate negative items are not something to dispute.
**SAY:** "FairPath doesn't manufacture disputes. It only flags what's genuinely disputable and explains why."

### 9. Record Relief
**CLICK:** Record Relief → add a case using one of the seeded TEST jurisdictions (TEST-A/B/C/D — these will be
visibly labeled TEST DATA).
**EXPECTED:** A result like "potentially eligible" or "waiting period" with an exact countdown, a cited source,
last-verified date, and an explicit disclaimer that a court makes the final call.
**SAY:** "Everything here says 'potentially' — FairPath is legal information software, not a lawyer, and it says
so on every screen. Real jurisdiction data (we just started with Ohio research this week) is deliberately not
live yet — the safety machinery has to be proven first, which is exactly what happened tonight."

### 10. Resume Studio
**CLICK:** Resume Studio → create a resume.
**EXPECTED:** A generated resume you can export as PDF or DOCX.
**SAY:** "One click from a completed Opportunity Profile to a real exportable resume."

### 11. FairPath AI
**CLICK:** The AI tab (bottom nav).
**TYPE:** "What jobs did I save?" or "Do I have any marketplace claims?"
**EXPECTED:** A real, specific answer sourced from your actual account data — never a generic chatbot response.
**SAY:** "This isn't a wrapper around a general chatbot. Every answer is deterministic and sourced from the
member's real state — it can't invent an answer it doesn't have data for."

### 12. Documents
**CLICK:** Documents (Me → Documents, or bottom nav).
**EXPECTED:** Any documents generated during this walkthrough (resume, resource list) appear here, with version
history if you regenerate one.
**SAY:** "Every generated document lives in one place, versioned, member-owned."

### 13. Notifications
**CLICK:** Notifications (bell icon).
**EXPECTED:** Real in-app notifications from actions taken tonight (a claim update, an application status
change).
**SAY:** "In-app notifications are fully real today. Push/email/SMS delivery is the next infrastructure step —
the events are already being generated correctly, they're just not leaving the app yet."

### 14. Me
**CLICK:** Me (bottom nav).
**EXPECTED:** Tiles for jobs applied, saved jobs, housing applications, saved homes, resources saved, documents,
Marketplace claims, and upcoming meetings — every number reflects exactly what you did in this walkthrough.
**SAY:** "This is the proof the whole product is one connected system, not separate silos — everything you just
did shows up here, correctly counted."

## DO NOT DEMO — requires something this environment doesn't have yet

- **Apple/Google Sign-In completing end-to-end** — needs a physical device (Apple) or real OAuth credentials
  configured (Google). The buttons exist; don't click through and expect a working login.
- **Push notifications actually arriving** — the in-app inbox is real; nothing pushes to a lock screen yet.
- **A real Stripe/payment charge** — don't complete a FastTrack or FairPath+ purchase unless engineering confirms
  Stripe is live in this environment; it may be a "not configured" honest stop, which is correct behavior, not a
  bug, but isn't demo-worthy on its own.
- **Real Record Relief legal content for any real state** — only TEST-A/B/C/D fixture jurisdictions are wired to
  the engine. Ohio research was received and read this week but deliberately has not been loaded as verified
  law — say so plainly if asked, don't imply it's coming next week without checking with engineering first.
- **Native map pins on Android** — needs a Maps API key configured; web/iOS fallback works.
- **Walkability scores** — no provider connected; currently always absent, not faked.

## If something breaks live

Every list screen in the app is built to show an honest error message and a "Try Again" button rather than a
blank screen or a raw database error — if a network hiccup happens mid-demo, that's expected behavior, not a
crash. Tap Try Again and continue.
