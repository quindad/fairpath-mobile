## UPDATE 2026-10-14: Signal (AI) is live, several items below are now resolved

- ✅ **Anthropic API key is live** on the DEV backend. 13 real Signal (AI) features are built, deployed, and verified live in the browser preview: Job Fit, Housing Fit, Resource Guidance, Credit Report Explanation, Credit Item Explanation, Dispute Letter Drafting, Record Relief Case Explanation, Resume Bullet Improvement, Interview Prep, Housing Application Prep, Meeting Prep, My Path Focus Guidance, Entrepreneurship Idea Feedback, Veteran Experience Translation, and Retention Check-in resource routing. Every one spends a real rate-limited credit and runs through a decision-language safety guard before showing anything to a member.
- ✅ **AI credit rate-limit system applied to real DEV database** (per-member balance + global daily circuit breaker), proven with 8 local adversarial tests before going live. All 61 DEV accounts got 20 starter credits.
- ✅ **Credit-report AI reading (OCR) is now ON** — the item below this that said "turned OFF on purpose" is resolved; `CREDIT_EXTRACTION_ENABLED=true` is live.
- 🟡 **The 🔴 "Database update-history mismatch" item below is NOT fixed, but I found a safe way to work around it**: `supabase db query` runs real SQL against DEV via the Management API without touching the broken migration ledger, so new migrations (like the rate-limit one) can still go live safely. The underlying ledger reconciliation (see `docs/DEV_MIGRATION_RECONCILIATION_2026-10-09.md`) is still unresolved and still blocks plain `supabase db push`.
- ✅ **Veterans pathway improved**: 7 of 8 dashboard sections are now live (were mostly placeholders) — 3 route into real existing tools (Resume Studio, Job Applications, Entrepreneurship), 1 shows real official VA.gov/VSO links, 2 route into real search pre-filled for veterans (weak until real veteran-tagged data exists), 1 is the new Signal duty-translation feature. Only "transition and community support" remains unscoped.

---

# FairPath — The Whole List (v2, full product audit)
Updated after going through all 8 repos, including a huge trove of prior work I found in `fairpath-mobile-ai-gateway/docs/` that I hadn't seen before — a detailed, evidence-based status doc from an earlier deep session. Merging that with everything I've personally tested live.

**Key:** ✅ = proven live, I watched it work (me or a documented prior session with real evidence) · 🟡 = built, not fully proven live · 🔴 = real problem, needs fixing · ⬜ = not started · 🚨 = decision needed from you

---

## ✅ DECIDED AND VERIFIED 2026-10-14: `fairpath-partner-case-plans` is the official Partner build

Sterling decided: `fairpath-partner-case-plans` goes forward. `quindad-fairpath-partner` is deprecated — no new feature work goes into it. The security fix found in `quindad-fairpath-partner` (missing `organization_id` filter on job/housing/campaign detail queries) was already ported to both repos, so that's covered either way. **Now live-tested**: signed in for real, clicked through Dashboard, Caseload, Jobs (real job + real applicant counts), Housing (real listing, has its own "Draft with Signal" button already), Team (honestly flags that invite emails aren't wired yet), Billing (honestly shows "not subscribed," real V1 plan pricing), and Reports (7 real report types, CSV/PDF export). Also discovered it already has its own staff-facing AI module independently branded "FairPath Signal" (Daily Brief, Bottleneck Analysis, Executive Brief) — same name convergence as the member-facing mobile AI.

---

## 🚨 BIGGEST REAL BLOCKER: the app isn't published yet

Checked the public website's download page myself — it honestly says "App Store link coming soon" and "Google Play link coming soon." **The app is not live for the public to download on either platform.** Everything else on this list matters less than this one, long-term.

---

## 1. PHONE APP — mobile

### Proven solid (real evidence, not just "looks done")
- ✅ Sign up / log in / password reset — driven live, works
- ✅ Opportunity Profile — all 8 sections save and reload correctly
- ✅ Jobs — search, save, Easy Apply (autofills from your profile), full application tracking
- ✅ Housing — search, filters, save, full 5-step application with drafts
- ✅ Early Access (the "we don't cover your area yet, join the waitlist" flow) — proven end-to-end including the 60-day free bonus when a market activates
- ✅ Resume Studio — create, edit, export PDF/DOCX
- ✅ Meetings — create, cancel, status changes
- ✅ Credit Builder/Studio — upload, review, dispute letters
- ✅ Record Relief — the legal engine itself tested against 8 different real-world scenarios, all came back correct (with exact countdowns, citations, honest "this isn't legal advice" disclaimers)
- ✅ FairPath AI — tested against 13 trick questions designed to make it overpromise, it refused every single one
- ✅ Privacy / account deletion — proven to work correctly, can't be duplicated by mistake
- ✅ FairPath+ membership perks — at least one real perk confirmed actually unlocking for a real member
- ✅ Light/dark mode — both screenshotted, no visual bugs
- ✅ Marketplace — the security rules (17 adversarial tests: can't claim your own item, can't double-claim, quota limits enforced, etc.) all pass at the database level

### Not fully proven yet (probably fine, just not click-tested)
- 🟡 Marketplace — the actual click-through (the database rules are proven, but nobody's walked through the screens live recently)
- 🟡 Notifications — the in-app inbox is real and proven; push notifications actually hitting a phone lock screen is NOT proven
- 🟡 Documents — works in a browser; whether "Save to Files" / "Share" / print actually work on a real iPhone/Android is unproven
- ⬜ Accessibility — flat out not been tested yet, nobody's checked it

### Real, known gaps
- ⬜ Real job/housing inventory — still running on test/fixture data, not real nationwide listings
- ⬜ Real Record Relief legal content — the engine works, but 0% of states have real, lawyer-reviewed legal rules loaded yet (Ohio research was started, not finished)
- ⬜ Apple Sign-In — needs a physical iPhone to test, can't be done in a browser
- ⬜ Google Sign-In — needs real OAuth credentials set up, not fully wired
- ⬜ Android map pins — needs a paid Maps API key, not configured yet
- ⬜ Walkability scores — no data provider connected, honestly shows nothing instead of faking it
- ⬜ Push/email/SMS actually sending — the system that should trigger them is built, nothing is actually being sent yet
- ⬜ Credit-report AI reading (auto-extracting data from an uploaded report) — built, tested, but turned OFF on purpose pending a decision from you about sending member data to an AI provider

## 2. COMMAND CENTER — business/staff side

- ✅ Partner app (`quindad-fairpath-partner`) — logged in live, clicked every page, created a real campaign, found + fixed 3 real security bugs tonight (two were real holes, one was a false alarm that turned out already protected)
- ✅ Admin app (staff-only) — logged in live, clicked every page, confirmed it's tracking your own real actions already
- 🔴 Admin's new "Staffing" page is broken — not a code bug, a database timing issue (new tables, the system hasn't "noticed" them yet). Needs one safe command to fix, I didn't run it without checking with you first.
- 🟡 A second, possibly-better Partner build exists untested (see decision needed above)
- ⬜ Document sharing between a case manager and a member — unconfirmed if this exists
- ⬜ Follow-up reminders actually firing as real alerts — the data tracks them, whether anything fires is unconfirmed

## 3. PUBLIC WEBSITE
ChatGPT is actively working on this one right now — not touching it. What I saw: 33 real pages, genuinely well-built, honest pricing page (matches your approved plan exactly, correctly says "checkout not live yet" instead of faking a buy button). Download page honestly says the app isn't published yet.

## 4. BACKGROUND/PLUMBING
- 🔴 Database update-history mismatch — a known, real issue, needs careful reconciliation by someone who can see exactly what changed, not a blind fix. Blocking me from pushing 2 of my already-finished fixes live tonight.
- ⬜ Payment system (Stripe) — intentionally not the current priority per an earlier decision; still needs setup when it's time
- ⬜ Error/crash monitoring — not connected yet

## 5. WHAT TO SHOW IN YOUR MEETING TOMORROW
There's already a **written, step-by-step demo script** sitting in the repo (`fairpath-mobile-ai-gateway/docs/BOARDROOM_DEMO_RUNBOOK.md`) — built for exactly this, no tech background needed, tells you exactly what to click, what to expect, what to say, and explicitly what NOT to demo (so you don't get caught showing something that isn't ready). I'm sending it to you directly.

---

## The honest bottom line, updated

This product is **further along than it looks from the outside**, and better-tested than most startups at this stage — real security proof, honest "we don't know yet" messaging instead of fake numbers, and a real demo script already written. The two real open questions are business/process ones, not engineering ones: **(1) which Partner build do we keep**, and **(2) when do we actually submit to the App Store/Google Play** — because that's the thing that turns "impressive internal demo" into "a real company people can use."
