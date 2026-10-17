# Competitive Intelligence Research Package: Untapped Solutions (formerly ConConnect)
**Researcher:** Juice | **Date:** 2026-10-09
**Method:** Browser research via the Claude Browser pane (see master index for the REA clarification). **The company's own site, conconnect.com, returned HTTP 403 Forbidden to automated browser access.** Per the directive's explicit boundary ("no bypassing access controls"), I did not attempt to circumvent this (no header spoofing, no alternate access path, no proxy). Capterra's product page was also blocked by a Cloudflare interstitial challenge and not pushed through. Everything below is therefore sourced from **third-party coverage** (press, Techstars/CB Insights/G2 listings) rather than the vendor's own site — this package is lower-confidence than the Honest Jobs one and is labeled accordingly throughout.

**Evidence key:** [OBSERVED] = seen directly on a reachable page this session. [THIRD-PARTY REPORTED] = stated by press/listing sites about the company, not seen on the company's own site. [INFERRED] = reasonable conclusion, not stated outright. [UNVERIFIED] = could not be confirmed at all.

---

## 1. Company overview

- Founded 2020 by **Andre Peart**, a formerly incarcerated founder, originally as **ConConnect** — described as "a LinkedIn only for formerly incarcerated people." **[THIRD-PARTY REPORTED]** (Hypepotamus, businessradiox.com, higherpurposevc.com)
- Rebranded to **Untapped Solutions**; pivoted from a job-seeker social network toward an **AI-powered case-management CRM for nonprofits, workforce agencies, and government organizations** serving justice-impacted, homeless, youth, and other marginalized populations. **[THIRD-PARTY REPORTED]** (Hypepotamus, 23 Dec 2025)
- Went through **Techstars Social Impact** (Atlanta cohort, 2022). **[OBSERVED]** (jobs.techstars.com/companies/conconnect)
- Raised **$515,000** from the **Richard King Mellon Foundation** (grant/non-equity, per the Techstars listing's "pre-seed + grants" funding stage) to build out the AI platform. **[THIRD-PARTY REPORTED]**
- HQ: New York (Yonkers/Union Square/Manhattan addresses all listed); also an Atlanta presence from the Techstars cohort. **[OBSERVED]**
- Company size: listed inconsistently across sources as 1–10 or 7 employees — **[UNVERIFIED]**, flagging the discrepancy rather than picking one number.
- A **"Justice CRM"** product was announced, described as in beta with a pilot partner, the **Westchester NY Legal Aid Society**. **[THIRD-PARTY REPORTED]**

This is structurally the **closest analog found so far to what FairPath's "Command Center" needs to be** — not a job board with a caseworker add-on (like Honest Jobs' Reentry Navigator), but a platform built case-management-first, with the job/resource matching as one function among several.

## 2. Feature inventory **[THIRD-PARTY REPORTED — none of this was independently observed in a live product UI]**

| Feature | Audience | Detail |
|---|---|---|
| Original networking platform | Member (justice-impacted job seeker) | LinkedIn-style professional networking specifically for formerly incarcerated people; also let parole/probation officers manage caseloads and connect clients to housing, education, counseling, job placement "all in one place" (per businessradiox.com interview with Peart). |
| **AI Social Worker** | Staff/caseworker | Automates case notes, assessments, case plans, workflows, referrals, and reporting. |
| **AI Caseworker** | Staff/caseworker | Named separately from "AI Social Worker" in Peart's quote; exact functional split between the two is **[UNVERIFIED]** — the press piece names both without clearly differentiating them. |
| **Workforce Coach** (AI) | Staff or member, unclear | Named as a third AI agent; audience not specified in the source. **[UNVERIFIED]** which side of the product it lives on. |
| **AI Life Assistant** | Member (community user) | Helps "justice-impacted, homeless, youth, and marginalized individuals navigate jobs, services, programs, and opportunities" — this is the member-facing counterpart to the staff-facing AI agents, conceptually parallel to FairPath AI. |
| Automated referrals | Staff | Explicitly named as a differentiator vs. generic CRMs (Salesforce, etc.). |
| Specialized outcome tracking | Staff/org | Explicitly named; positioned against generic CRM reporting as built for nonprofit/government reporting requirements specifically. |
| Client-facing tools | Member | Named generically; specifics not disclosed in available sources. |
| Reported efficiency claim | Staff | "Frontline case managers using Untapped save 8–12 hours per week by automating routine documentation and administrative tasks" — a company-provided claim, not independently verified; presented here as a marketing claim, not a fact. |

## 3. Workflows **[INFERRED, low confidence — no live UI was observed]**

Given the product is positioned as "built for frontline staff" with case notes/assessments/plans/workflows/referrals/reporting all AI-assisted, the inferred core loop is:
1. Staff member (caseworker) manages a caseload of clients within the platform.
2. The AI Social Worker/Caseworker agent drafts case notes, assessments, and case plans from staff input (likely conversational or form-based — **[UNVERIFIED]** which).
3. Referrals to jobs/services are generated (possibly AI-suggested) and tracked per client.
4. Outcome tracking feeds organizational reporting, likely for funder/government compliance reporting (a named pain point in the press coverage — generic CRMs don't fit nonprofit reporting requirements).
5. Separately, the community member (client) has their own "AI Life Assistant" surface to navigate jobs/services directly — implying a true two-sided product (member app + staff CRM), not just a staff tool with client records.

This two-sided-with-AI-on-both-sides structure is the most important pattern to validate against FairPath's own direction (FairPath AI already exists member-side; nothing exists staff-side).

## 4. Pricing / business model
**[UNVERIFIED]** — not disclosed in any reachable source this pass. The funding profile (grant-funded, nonprofit/government customer base) suggests a B2B SaaS-to-nonprofits model, likely subscription-per-org or per-seat, but this is **[INFERRED]** from the customer type, not stated anywhere found.

## 5. FairPath comparison

| Untapped Solutions capability | FairPath status | Classification |
|---|---|---|
| Member-facing AI assistant for navigating jobs/services | FairPath AI exists (orchestrator.ts, traced and audited earlier in this engagement) | **EXISTS**, functionally parallel to their "AI Life Assistant" — FairPath's version is deterministic/rule-based with optional AI rewording, not LLM-driven case planning, which is arguably a *safer* design choice given this engagement's strict no-fabrication/no-invented-eligibility rules. Worth noting as a genuine FairPath strength, not just a gap. |
| Staff/caseworker case-management CRM (AI-assisted case notes, plans, referrals, reporting) | Per the prior directive's own framing, FairPath has "reported case-management, referrals, caseload, outcomes, follow-ups, and partner workspace foundations" | **NEEDS VERIFICATION** — I do not have confirmed, source-level visibility into this claim from my own prior engineering work in this engagement; everything I personally built/audited this session (Resume Studio, Credit Studio, Meetings, Home/Me, FairPath AI, Documents) was strictly member-facing. I have not seen a staff/caseworker-facing module, table, or route in this codebase. Per the directive's own instruction ("do not declare missing solely because you haven't seen it... label REPORTED / NOT SOURCE-VERIFIED"), I'm labeling this **REPORTED / NOT SOURCE-VERIFIED** rather than MISSING. See §7 for exactly how I'd verify this with repo access. |
| AI-automated case notes/assessments | Not seen anywhere in this engagement | **NEEDS VERIFICATION** (same caveat as above) |
| Nonprofit/government outcome reporting for funders | Not seen | **NEEDS VERIFICATION** |

## 6. Original FairPath implementation recommendations

1. If the Command Center (per the Honest Jobs package's §6) is built, Untapped Solutions' pattern argues for **AI-assisted case note/plan drafting as a staff-side productivity feature**, not just data entry — but FairPath's existing discipline (never fabricate, always cite source/basis — see `orchestrator.ts`'s `Basis` type and the `PROMISE_PATTERN` guard fixed earlier this engagement) should extend here: AI-drafted case notes must be clearly marked as AI-drafted/unconfirmed until a human staff member reviews and confirms them, exactly like Resume Studio's extraction-review pattern (`FieldStatus`: proposed → confirmed/corrected).
2. A member-facing "AI Life Assistant" equivalent already substantially exists as FairPath AI — the recommendation is to **extend its scope to surface staff referrals** (once the Command Center referral object exists, per the Honest Jobs package §7) rather than build a separate assistant.
3. Funder/outcome reporting is a distinct, lower-priority feature that only matters once FairPath has institutional (nonprofit/government) customers — flag as a later-phase business decision, not an immediate engineering gap.

## 7. How to resolve the "NEEDS VERIFICATION" items (for Mardo/founder, since I don't have confirmed case-management code visibility)
Search the FairPath repository for: any table/migration with `case`, `caseload`, `referral`, `partner_workspace`, `outcome`, or `follow_up` in its name under `supabase/migrations/`; any route under `src/app/` serving a staff/admin role (as opposed to a member role); any `role`/`is_staff`/`is_caseworker` column or RLS policy distinct from the member-owns-their-row pattern used everywhere I've personally audited this engagement. If these exist, the correct classification is **EXISTS** or **PARTIAL**, not what I've labeled above — I'm flagging my own visibility limit rather than asserting absence.

## 8. UI specifications for Super Mardo (Mobile) and Freebuff (Command Center)
Given the primary site was inaccessible, I don't have enough first-party workflow detail to write real UI specs for this competitor specifically (unlike Honest Jobs, where I had actual pricing tables and feature comparison grids). The one concrete, re-usable pattern is:
- **Freebuff (Command Center):** case notes/plans should distinguish AI-drafted-and-unreviewed from staff-confirmed content in the UI (a visual badge/state), mirroring Resume Studio's dirty-state/review pattern already in FairPath's codebase — a true original-FairPath implementation, not a copy, since Untapped's own UI was never observed.
- **Super Mardo (Mobile):** no new mobile-specific requirement from this competitor beyond what Honest Jobs already established (referral inbox surfacing staff suggestions).

## 9. Backend dependencies
No new dependency beyond what the Honest Jobs package already specified (staff-member linking, referral object, outcome tracking). An AI-drafted-content review-state pattern would reuse the exact `FieldStatus`-style enum (`proposed`/`confirmed`/`corrected`/`rejected`) from `src/core/documents/extraction-contract.ts`, already in FairPath's codebase — genuinely reusable, not hypothetical.

## 10. Acceptance criteria
- AI-drafted case notes/plans (if built) are never displayed to a second staff member or exported until a human confirms them — same acceptance bar as the extraction-review pattern already used for documents.

## 11. Source links
- https://jobs.techstars.com/companies/conconnect **[OBSERVED]**
- https://www.hypepotamus.com/untapped-solutions-raises-515k-ai-nonprofit-crm/ **[OBSERVED]**
- https://conconnect.com — **[BLOCKED, HTTP 403]**, not accessed
- https://www.capterra.com/p/10037792/Untapped/ — **[BLOCKED, Cloudflare challenge]**, not accessed
- https://www.g2.com/products/untapped-crm/discuss — loaded empty (likely JS-rendered, not fetched further)
- Referenced but not independently fetched this pass: linkedin.com/company/untappedcrm, higherpurposevc.com/articles/untapped-solutions, businessradiox.com podcast page, 914inc.com article

## 12. What was NOT covered (explicitly flagged)
- No first-party product UI, pricing, or workflow was observed anywhere for this company — this entire package rests on press coverage and should be treated as **directional, not authoritative**. If this competitor matters enough to prioritize, the right next step is a founder-initiated authenticated trial/demo request (a sales call, not automated browsing), which is outside what browser research alone can produce.
