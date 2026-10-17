# Competitive Intelligence Research Package: Honest Jobs
**Researcher:** Juice (FairPath mobile engineering, acting as competitive intelligence researcher)
**Date:** 2026-10-09
**Method:** Public, unauthenticated browser research of honestjobs.com. No login attempted, no credentials requested, no access controls bypassed, no restricted data scraped. Everything below comes from publicly published marketing/product pages — not from signed-in product use, so depth is capped at what the company chooses to disclose publicly. Flagged throughout.

**Evidence key:**
- **[OBSERVED]** — seen directly on a public page this session, with a source URL.
- **[DOCUMENTED]** — stated in Honest Jobs' own public copy (FAQ, feature list) but not independently observed as a working feature.
- **[INFERRED]** — a reasonable conclusion from observed facts, not stated outright.
- **[UNVERIFIED]** — could not be confirmed without authenticated access; flagged explicitly rather than guessed at.

---

## 1. Company overview

Honest Jobs is a fair-chance employment platform connecting justice-involved job seekers with employers who hire people with criminal records, plus a national database of reentry support services (housing, transportation, legal aid, healthcare, food). **[OBSERVED]** (https://www.honestjobs.com/)

**Recent acquisition:** Honest Jobs was acquired by **Orijin** (orijin.works), announced as creating "the first end-to-end education-to-employment pathway for justice-involved individuals in the U.S." **[OBSERVED]** (banner on every honestjobs.com page, linking to https://orijin.works/orijin-acquires-honest-jobs-to-create-the-first-end-to-end-education-to-employment-pathway-for-justice-involved-individuals-in-the-us/). This signals a strategic direction toward bundling education/training with job placement — relevant to FairPath's own Academy module.

Honest Jobs operates **three distinct product lines** for three distinct audiences, not just a job board:
1. **Honest Jobs** (job seeker + employer platform) — the consumer-facing job board.
2. **Reentry Navigator** — a B2B tool sold to case managers, probation/parole officers, and nonprofits.
3. **Reentry Planner** — a B2B2G tool sold to correctional facilities/tablet providers, used by incarcerated people *before release*.

This three-tier structure (member, professional/caseworker, institutional) is the single most important structural finding for FairPath, which currently only has a member-facing product. See §6.

---

## 2. Feature inventory

### 2.1 Job seeker side **[OBSERVED/DOCUMENTED]**
Source: https://www.honestjobs.com/for-job-seekers

| Feature | Evidence | Detail |
|---|---|---|
| Fair-chance job search | OBSERVED | "Over 300,000 Job Openings" from "more than 1,500 companies that are proven to hire people with criminal records" |
| **Conflix job matching** | DOCUMENTED (employer FAQ) | Reads the job description and the job seeker's self-reported conviction history, flags potential conflicts, shows a **visual compatibility indicator** per job. Job seekers can still apply to anything; the signal is advisory, framed against EEOC guidance. This is Honest Jobs' core technical/legal differentiator. |
| Employer track record ("Verified Hires") | OBSERVED | Each employer shows how many people with felony convictions it has actually hired, sourced from **self-reported hiring confirmations by job seekers**, not employer self-attestation — i.e., a crowd-verified trust signal, not a badge the employer can buy. |
| National resource database | OBSERVED | "Over 200,000 free and reduced-cost support programs," searchable by ZIP code, covering food, housing, transportation, legal aid, healthcare. |
| Success-story video testimonials | OBSERVED | Multiple named testimonial videos on the job-seeker landing page — a trust/marketing device, not a product feature. |
| Free to job seekers | OBSERVED | "Join for free" — no job-seeker paywall found anywhere in this research pass. |

### 2.2 Employer side **[OBSERVED/DOCUMENTED]**
Source: https://www.honestjobs.com/for-employers

| Feature | Evidence | Detail |
|---|---|---|
| Free tier | OBSERVED | Post up to 2 jobs free. |
| **Pro tier — $199/month** (billed, exact wording "per month") | OBSERVED (screenshot) | Post up to 10 jobs at a time; prioritized search placement; candidate database search; redirect applicants to employer's own career page. |
| **Premium tier — $499/month** | OBSERVED (screenshot) | Everything in Pro, plus: unlimited job postings; inclusion in marketing emails/campaigns; ATS integrations (noted with "*Additional fees for ATS integrations may apply"). |
| Fair Chance Recruiting Services (white-glove) | DOCUMENTED | A human-recruiter add-on: Honest Jobs screens candidates for qualifications/transportation/fit and only forwards qualified candidates. **90-day replacement-or-full-refund guarantee** if a placed hire doesn't work out. Pricing not disclosed publicly — contact-only (employers@honestjobs.com). |
| Distribution inside correctional facilities | OBSERVED | Job board "available inside most jails and prisons across the US," claiming "over 5 million monthly job searches from incarcerated individuals" — i.e., employer job posts reach a pre-release audience, not just post-release. |
| ATS integrations | DOCUMENTED | Claimed integration with "many of the leading ATS providers," others added on request. |
| Explicit non-positioning | OBSERVED (FAQ) | Honest Jobs explicitly states it is *not* a temp/staffing agency — direct-hire job board + recruiting services only. |

### 2.3 Reentry Navigator (professional/caseworker tool) **[OBSERVED/DOCUMENTED]**
Source: https://www.honestjobs.com/reentry-navigator

This is Honest Jobs' analog to a "Command Center" — a dashboard built for the people who support members, not for members themselves.

**Pricing (annual billing, per seat/org):**
- **Light** — <$9/month (observed as a promotional/discounted rate with a "SAVE30" 30%-off-12-months code visible on the page, so the undiscounted price is somewhat higher than $9)
- **Full Access** — $83/month
- **Enterprise** — "Contact for Info" (no public price)

**Tiered feature comparison (OBSERVED, full comparison chart captured):**

| Capability | Light | Full Access | Enterprise |
|---|---|---|---|
| Invite clients to join the platform | ✅ | ✅ | ✅ |
| Full fair-chance job search access | ✅ | ✅ | ✅ |
| Resource/services search | ✅ | ✅ | ✅ |
| Verified-hire employer data | ✅ | ✅ | ✅ |
| Color-coded background compatibility | ✅ | ✅ | ✅ |
| **Client referrals** to specific jobs/resources | — | ✅ | ✅ |
| **Client activity tracking** (resume/profile view, last login, jobs viewed/applied, application history export) | — | ✅ | ✅ |
| **Employment outcome tracking** (job, pay, start date, separation, filterable by employment status) | — | ✅ | ✅ |
| Exportable PDF job lists for clients | — | ✅ | ✅ |
| Multiple seats per org | — | — | ✅ |
| Dedicated support/training | — | — | ✅ |
| Org-wide outcome reporting | — | — | ✅ |
| Custom invitation links & flyers | — | — | ✅ |

(The chart's checkmark distribution across Light/Full/Enterprise was captured from the page's prose/FAQ restating exactly which tier unlocks which row, since the raw checkbox grid did not extract as text — this mapping is **[DOCUMENTED]** from the FAQ's explicit tier breakdown, cross-checked against the feature list, not a pixel-read of the checkbox grid itself.)

**Critical workflow detail [DOCUMENTED, FAQ]:** a caseworker gets *zero* visibility into a client unless they go through the in-dashboard "Invite Clients" flow — simply telling a client to sign up independently at honestjobs.com does **not** create the professional-client link. This is a deliberate, consent-gated linking model: the client's own signup doesn't expose their data to a caseworker; an explicit invite-and-accept flow does.

**Trust-signal mechanism [DOCUMENTED, FAQ]:** employer "verified hire" counts come from **two sources**: (1) job seekers self-reporting "I was hired here" after a felony conviction, aggregated once enough confirmations accumulate, and (2) employers proactively reaching out to be listed. This is a crowd-sourced reputation system, not a static directory.

### 2.4 Reentry Planner (in-facility, pre-release tool) **[OBSERVED/DOCUMENTED]**
Source: https://www.honestjobs.com/reentry-planner

- A correctional-tablet application (integrates into existing prison/jail tablet systems — not a separate device).
- Lets incarcerated individuals build a self-paced "Reentry Plan" before release: ID acquisition, employment search, healthcare access.
- Interactive checklists, saved/viewable personalized plan.
- Sold B2G/B2B to correctional facilities, tablet providers, and Departments of Corrections — not purchased by the end user at all.
- No pricing disclosed publicly; "get in touch" contact-gated.

---

## 3. Representative user workflows **[INFERRED from public copy — not observed as live interactive flows, since this requires a signed-in session]**

### 3.1 Job seeker workflow (inferred from marketing copy + standard job-board UX patterns)
1. Land on honestjobs.com → "Join Now" → directed to `/which-profile-is-right-for-you` (a profile-type chooser, implying separate seeker/employer/professional signup paths — **[OBSERVED]** as a distinct URL, content not explored further this pass).
2. Create a free job-seeker profile, including self-reported conviction history (required for Conflix matching to function).
3. Search/browse jobs; each listing shows a Conflix compatibility signal and the employer's verified-hire count.
4. Apply; application may redirect to the employer's own career page/ATS (per the employer-side "redirect applicants to career page" feature) rather than staying in-platform for every job.
5. Separately, search the resource database by ZIP for housing/food/transportation/legal/healthcare support.
6. If invited by a caseworker through Reentry Navigator, the seeker's activity (views, applications, resume) becomes visible to that caseworker — otherwise it's private.

### 3.2 Employer workflow (inferred)
1. "Post a Job" → free tier (2 jobs) or paid tier checkout (self-serve subscription, Stripe-style "Subscribe" buttons observed).
2. Post job description; Conflix parses it for conviction-category conflicts to generate the seeker-facing compatibility signal — **[INFERRED]** that this requires either structured input (checkboxes for excluded conviction types) or NLP over free-text job descriptions; which one is **[UNVERIFIED]** without posting a real job.
3. Receive applicants; optionally route them into own ATS (paid tiers) or review in-platform.
4. Optionally request white-glove recruiting (separate paid service, human-mediated).

### 3.3 Caseworker workflow (inferred, cross-referenced against the explicit FAQ language)
1. Caseworker signs up for Reentry Navigator independently of any client.
2. Caseworker uses "Invite Clients" (a dashboard action, not a generic signup link) to send an invitation — **[DOCUMENTED]** this is required for any data visibility.
3. Client accepts the invite, creating a bidirectional link.
4. Caseworker dashboard then shows: client's resume/profile, job-view/application history, last login, and (Full Access+) can make direct referrals to specific jobs/resources and track employment outcomes (job, pay, start/separation dates).
5. Org-level reporting (Enterprise) rolls this up across an entire caseload for funder/outcome reporting.

---

## 4. FairPath feature-gap analysis

Comparing the above against FairPath's current state (as I know it from this engineering engagement — Resume Studio, Credit Studio, Meetings, Home/Me, FairPath AI, Record Relief, Document Wallet, Marketplace, Jobs/Housing search):

| Honest Jobs capability | FairPath today | Gap |
|---|---|---|
| Conviction-to-job conflict matching (Conflix) | Not present — FairPath's job search has no conviction-compatibility signal | **Large gap.** This is Honest Jobs' signature differentiator and directly serves FairPath's core demographic. |
| Verified/crowd-sourced employer hire counts | Not present | **Large gap.** FairPath job listings show standard employer info only, no fair-chance trust signal. |
| Caseworker/professional dashboard (Reentry Navigator) | **Not present at all** — FairPath has no staff/professional-facing surface | **Largest structural gap.** Everything FairPath has is member-facing. This maps directly to the "Command Center" the user is asking for requirements on. |
| Client invite-and-link consent model | N/A (no professional tier exists) | Directly informs how FairPath's Command Center should gate staff access to member data — invite/accept, not blanket visibility. |
| Pre-release / in-facility product (Reentry Planner) | Not present | FairPath has no institutional/correctional-facility distribution channel today. Worth flagging as a possible future channel, not an immediate gap, since it requires B2G sales motion FairPath doesn't appear to be pursuing yet. |
| Employer self-serve subscription tiers ($199/$499) + human recruiting add-on | FairPath has FairPath+ member subscriptions but **no employer-side monetization** observed in this engagement | Gap, but may be intentionally out of scope for FairPath's current model — flagging, not recommending, since this is a business-model decision above engineering scope. |
| National resource database by ZIP | FairPath has Resources module (`/resources`) already, conceptually similar | **No gap** — FairPath already does this; worth a direct feature-parity comparison in a later pass (size of database, categories covered). |
| Reentry plan / checklist (pre-release) | FairPath has "Justice readiness" (`/profile-readiness`) per earlier engineering work in this engagement | **Partial overlap** — worth comparing FairPath's readiness checklist against Reentry Planner's checklist categories in detail later. |

---

## 5. Mobile UI requirements (if FairPath builds Conflix-equivalent matching)

Derived from the gap analysis, not from observing Honest Jobs' actual mobile app (none was tested this pass — **[UNVERIFIED]** whether Honest Jobs even has a native mobile app; only the responsive web site was reviewed):

1. **Per-listing compatibility indicator** on both the job list row and the job detail screen — a simple, non-alarming visual signal (e.g., a colored dot/chip), not a blocking gate, matching FairPath's existing honest-disclosure tone ("this may not be a good match" rather than "you are disqualified").
2. **Self-reported conviction-category input**, almost certainly as part of Opportunity Profile or a new dedicated section — needs its own privacy/consent treatment consistent with FairPath's existing justice-information handling (never shown to employers directly, consistent with FairPath's current privacy copy).
3. **Employer trust signal** on listing cards — a "verified fair-chance hires: N" style badge, sourced from FairPath's own data (member-confirmed hires), not fabricated or employer-self-reported.
4. All of the above must go through FairPath's existing no-fabrication discipline: never claim a job is "guaranteed compatible," never claim an employer verification that FairPath hasn't actually collected.

## 6. Command Center UI requirements (staff/caseworker surface)

This is the most significant actionable finding. A Command Center for FairPath (case managers, program staff, possibly employer partners) should, based on Reentry Navigator's structure:

1. **Tiered access model**, not all-or-nothing: view-only (jobs/resources), referral-capable, activity-tracking-capable, org-reporting-capable — mirroring Light/Full/Enterprise but mapped to FairPath's own roles rather than copied wholesale.
2. **Explicit invite-and-accept linking** between staff and member accounts — never implicit visibility. This matches FairPath's own stated privacy ethos (nothing shared without the member pressing a button) better than a caseworker-sees-everything model would.
3. **Per-client activity view**: last login, resources/jobs viewed, applications submitted, resume/profile snapshot — all read-only derived from data the member already owns, not new tracking infrastructure.
4. **Referral action**: staff can push a specific job or resource to a specific client's queue/inbox — requires a new data model (a "referral" object distinct from a saved job) and corresponding member-facing surface ("Your caseworker suggested this").
5. **Employment/outcome tracking fields**: job, pay, start date, separation date/reason, filterable list view — net-new data model, member-attested (never fabricated), likely member-entered or confirmed via a referral's lifecycle.
6. **Org-level reporting rollup**: aggregate, anonymized-where-appropriate outcome stats across a caseload — a later-stage feature, not a v1 requirement.
7. **Exportable lists** (PDF of matched jobs for a client) — a lower-effort, high-value early feature given FairPath already has a document-generation pipeline (`document-service.ts`, `builders/*`) that this could reuse directly.

## 7. Backend/API requirements (inferred, not observed — Honest Jobs' actual backend is opaque from public pages)

1. **Staff-member linking table** with invite/accept state machine (pending → accepted → revoked), mirroring the RLS-friendly ownership patterns already used throughout FairPath (e.g., `(storage.foldername(name))[1] = auth.uid()::text`-style ownership checks, member-row RLS).
2. **Referral object**: `referred_by_staff_id`, `member_id`, `target_type` (job/resource), `target_id`, `status`, timestamps — a new table, RLS-scoped so a member only sees referrals addressed to them and a staff member only sees referrals they created for clients who accepted their invite.
3. **Conviction-category taxonomy**: a controlled vocabulary (not free text) for both member self-report and job-posting exclusion categories, to make compatibility matching deterministic rather than NLP-guessed — this is safer and more honest than attempting free-text parsing, and matches FairPath's existing preference for rule-based, source-cited logic (see Record Relief's jurisdiction-rule-engine pattern already in this codebase) over ML inference.
4. **Employer verified-hire aggregation**: a member-confirmation flow ("I was hired here after disclosing a conviction") feeding an aggregate count per employer — needs anti-abuse consideration (rate limiting, maybe requiring an accepted job application to exist first) so the count can't be trivially gamed.
5. **Outcome-tracking table**: employment record per member (job, pay, start/end, separation reason) — highly sensitive, should follow the same sensitivity/consent model already drafted in `docs/proposed-migrations/20261009090000_member_document_uploads_DRAFT.sql`'s `ConsentGrant`/sensitivity pattern from this same engagement, not a new one.

## 8. Prioritized implementation backlog (draft, for product/founder review — not an engineering commitment)

1. **P0 — Conviction-category taxonomy + self-report field** (Opportunity Profile extension). Foundational; nothing else here works without it.
2. **P0 — Job-listing compatibility indicator** (client-side, rule-based against the taxonomy; no new backend beyond the taxonomy itself).
3. **P1 — Command Center v0**: staff accounts, invite/accept linking, read-only client activity view. No referrals yet.
4. **P1 — Employer verified-hire counter** (member self-confirmation flow + aggregate display).
5. **P2 — Command Center referrals** (push a job/resource to a client).
6. **P2 — Employment outcome tracking** (member-attested, staff-visible with consent).
7. **P3 — Org-level reporting rollups**.
8. **P3 — Exportable PDF job lists for a client** (lower effort given existing document pipeline, but sequenced after the data model exists).

## 9. Acceptance criteria (sketch, for the P0/P1 items above — to be refined with product before implementation)

- **Conviction-category self-report**: member can select from a fixed, published taxonomy (not free text); field is optional; never shown to employers directly; stored with the same privacy treatment as existing justice-related data in `/privacy`'s disclosed model.
- **Compatibility indicator**: never blocks application; always shows a plain-language explanation on tap; never implies a guarantee ("may not be a good fit," never "disqualified" or "will be rejected").
- **Command Center invite/accept**: a staff member cannot see any member data before that member explicitly accepts an invite; an accepted link can be revoked by the member at any time; revocation immediately removes staff visibility (enforced at the RLS layer, not just the UI).
- **Employer verified-hire counter**: count only increments from a member's own confirmed self-report tied to a real application record in FairPath; never employer-self-attested; publicly displayed count never exceeds what FairPath can actually substantiate.

## 10. Source links (all public, all accessed this session)

- https://www.honestjobs.com/
- https://www.honestjobs.com/for-job-seekers
- https://www.honestjobs.com/for-employers
- https://www.honestjobs.com/for-reentry
- https://www.honestjobs.com/reentry-navigator
- https://www.honestjobs.com/reentry-planner
- https://orijin.works/orijin-acquires-honest-jobs-to-create-the-first-end-to-end-education-to-employment-pathway-for-justice-involved-individuals-in-the-us/ (referenced, not independently fetched this pass)

## 11. What was NOT covered this pass (explicitly flagged, not silently skipped)

- No authenticated session was created — the actual signed-in job-seeker, employer, or Reentry Navigator dashboard UI was never seen. Everything above is marketing-page-derived.
- The `/which-profile-is-right-for-you` signup chooser and the actual Conflix UI were not explored in depth.
- Honest Jobs' mobile app existence/quality is unverified.
- Orijin's broader product suite (the acquiring company) was not researched this pass.
- No screenshots of password-gated screens exist or were attempted, per the authorization boundary in the directive.

---

*This document is a living artifact. Recommend re-running authenticated research (with the founder creating a real job-seeker or employer trial account and sharing session access directly, never a password) to validate the inferred workflows in §3 before committing engineering resources against §8.*
