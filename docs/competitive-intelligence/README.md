# FairPath Competitive Intelligence — Master Index
**Maintained by:** Juice | **Last updated:** 2026-10-09

## Tooling note (read before trusting anything in this directory)
All research in this directory was produced using the **Claude Browser pane** (`mcp__Claude_Browser__*`), a real Chromium browser tab driven directly in-session — navigate, read page text, screenshot, run JS for DOM inspection. The founder separately confirmed a tool named **REA** (`io.github.morluto/rea`, package `rea-agents`) is connected via `claude mcp list` on a **local Claude Code installation on their machine** — a different process from this session. I searched this session's tools by exact name (`rea`) and found no match; I cannot confirm whether this session is the same process as that local installation. Per the founder's own instruction, REA-specific research is being moved to that local Claude Code environment rather than attempted here. Every package in this directory is Browser-pane research only, truthfully labeled as such.

Authorization boundary observed in every pass: no login attempted on any competitor site, no credentials requested, no bypassing of bot-detection/access controls (two sites — conconnect.com and Capterra — blocked automated access and were left alone rather than circumvented), no scraping of restricted/gated data, no live account changes anywhere.

## Status legend
- ✅ Package complete (first pass)
- 🔲 Not yet started
- ⚠️ Attempted, blocked/limited — see package for detail

## Master competitor inventory

| # | Company | Category | Status | Package | Primary-source access |
|---|---|---|---|---|---|
| 1 | Honest Jobs | Fair-chance job board + caseworker tool + correctional tablet app | ✅ | [honest-jobs-research-package.md](honest-jobs-research-package.md) | Full public-site access |
| 2 | Untapped Solutions (f/k/a ConConnect) | Case-management CRM for reentry/nonprofits, AI agents | ✅ | [untapped-solutions-research-package.md](untapped-solutions-research-package.md) | **Blocked** (403 on primary site, Cloudflare on Capterra) — third-party sourced only, lower confidence |
| 3 | Indeed | General job aggregator | ✅ | [indeed-research-package.md](indeed-research-package.md) | Full public-site access, scoped narrower (generalist, not fair-chance-specific) |
| 4 | ZipRecruiter | General job aggregator | ✅ | [ziprecruiter-research-package.md](ziprecruiter-research-package.md) | Job search/homepage accessible; employer pricing pages blocked (Cloudflare) or 404 — pricing is third-party-sourced, low confidence |
| 5 | Homes.com | Housing listings/search | ✅ | [homes-com-research-package.md](homes-com-research-package.md) | Full public access. Note: owned by **CoStar Group**, same parent as Apartments.com |
| 6 | Zillow | Housing listings/search + Zestimate/financing | ⚠️ | [zillow-research-package.md](zillow-research-package.md) | **Blocked** — "Access denied" on every path including the homepage after one initial load. General-knowledge only, flagged low-confidence throughout. Needs a human-assisted retry. |
| 7 | Apartments.com | Rental listings | ✅ | [apartments-com-research-package.md](apartments-com-research-package.md) | Full public access. Same parent as Homes.com (CoStar). Key finding: live tenant-screening tool includes criminal-history checks with no fair-chance mitigation — validates FairPath's existing screening-disclosure feature. |
| 8 | RentCafe | Property management / rental listings + resident portal | ✅ | [rentcafe-research-package.md](rentcafe-research-package.md) | Full public access (homepage only this pass). Owned by **Yardi Systems**. |
| 9 | Unite Us | Coordinated-care / closed-loop referral network | ✅ (per directive, prior research — package not in this repo; founder to supply) | — | N/A — pre-existing |
| 10 | Other fair-chance employment platforms (to be identified) | Fair-chance jobs | 🔲 | — | — |
| 11 | Reentry/correctional technology competitors (to be identified) | Corrections tech | 🔲 | — | — |
| 12 | Case-management/coordinated-care platforms beyond Unite Us (to be identified) | Case management | 🔲 | — | — |

**Candidates surfaced during research so far, not yet assigned numbers:** OutsideConnection (fair-chance job placement, 10,000+ reentrants claimed across 17 states/34 cities, found via web search while looking for Untapped Solutions — not yet researched). Automated Reentry Management System (ARMS) — a California CDCR system (cdcr.ca.gov/rehabilitation/arms), found via search — government-built, not a vendor, but worth a short look as a corrections-tech reference point.

## Consolidated gap matrix (built incrementally — see each package's own §4/§5 for full detail; this table is the cross-competitor summary)

| Competitor | Feature | Evidence | FairPath capability | Gap | Recommended implementation | UI owner | Backend dependency | Priority |
|---|---|---|---|---|---|---|---|---|
| Honest Jobs | Conviction-to-job compatibility matching (Conflix) | OBSERVED | MISSING | Large | Rule-based conviction-category taxonomy + per-listing compatibility chip | Super Mardo (mobile) | New taxonomy table, member profile extension | P0 |
| Honest Jobs | Verified/crowd-sourced employer fair-chance hire count | OBSERVED | MISSING | Large | Member self-confirmation flow + aggregate counter, anti-gaming rate limit | Super Mardo (mobile) | New confirmation table tied to real application records | P1 |
| Honest Jobs | Reentry Navigator (caseworker dashboard, invite/accept client linking, activity + outcome tracking, referrals) | OBSERVED | **EXISTS** — confirmed real backend (`partner_referral_crm_core.sql` + related migrations) and real frontend routes (`caseload`, `referrals`, `campaigns`, `impact`, `jobs`, `housing`) in the sibling `quindad-fairpath-partner` repo; see §"Existing FairPath capability verification" below | **Narrowed**: not "build a Command Center," but "diff `quindad-fairpath-partner`'s existing UX against Honest Jobs' specific patterns" | Someone scoped to `quindad-fairpath-partner` should compare its invite/accept flow, activity tracking, and exportable lists against Honest Jobs' Reentry Navigator feature set (this package's §2.3) to find the real, narrow gaps | Freebuff (Command Center) | None identified yet — needs the diff above first | P1 for the diff, not for new construction |
| Untapped Solutions | AI-assisted case notes/plans with human-confirm review state | THIRD-PARTY REPORTED (low confidence) | NEEDS VERIFICATION | Possible | If built: reuse existing `FieldStatus` (proposed/confirmed/corrected/rejected) pattern from `extraction-contract.ts` | Freebuff (Command Center) | None new — reuse existing enum pattern | P2 |
| Indeed | Fair-chance specialization | OBSERVED ABSENT | N/A | **FairPath advantage, not a gap** | No action — confirms strategic direction | — | — | — |
| ZipRecruiter | "Be Seen First" candidate boost + Breakroom employer-quality ratings | OBSERVED | MISSING (quality-ratings concept only; boost feature not recommended) | Medium | Member-sourced post-hire "what was it like" quality signal, combined with the Honest Jobs conviction-compatibility signal in one trust panel | Super Mardo (mobile) | Reads existing employment-outcome data from Command Center once it tracks it | P2 |
| Apartments.com | Landlord tenant-screening tool: criminal history via TransUnion, zero fair-chance mitigation | OBSERVED | **FairPath already mitigates this** via existing per-listing screening-policy disclosure | **Validates existing FairPath feature, not a gap** | No action — use as messaging/positioning evidence | — | — | — |
| Homes.com / Apartments.com / RentCafe (3 of 3 housing competitors) | Conversational/AI search ("AI Advisor," "Apartments.com Ai," RentCafe mobile conversational search) | OBSERVED (named on all three; depth untested) | PARTIAL — FairPath AI exists but not yet extended to conversational housing search | Category-wide pattern, not one competitor's quirk | Extend existing FairPath AI orchestrator to handle housing-search intents | Super Mardo (mobile) | None new — extends existing `orchestrator.ts` intent set | P1 |

## Existing FairPath capability verification (per directive item THIRD) — RESOLVED

The directive states FairPath has "already reported case-management, referrals, caseload, outcomes, follow-ups, and partner workspace foundations." I verified this directly rather than leaving it as a guess:

**Backend (this repo, `fairpath-mobile`):** `supabase/migrations/20261006100000_partner_referral_crm_core.sql` implements a real closed-loop referral workflow: `PERSON → NEED → REFERRAL → RECEIVING ORG → ACCEPT/DECLINE → IN PROGRESS → OUTCOME → FOLLOW-UP → CLOSED`, built on `20261005100000_organization_person_relationships.sql` (an org-to-person consent-link model) with security-definer RPCs only (no direct table grants). Supporting migrations: `partner_campaigns.sql`, `impact_evidence_ledger.sql`, `referral_participant_basic_identity.sql`, `organization_directory_read.sql`. All real, applied-looking SQL, not drafts.

**Frontend:** none of this is wired into `fairpath-mobile`'s `src/app/` — confirmed by grep, zero references to `participant_needs`, `public.referrals`, or `partner_link_person_to_organization` anywhere in this repo's client code. That's correct and expected: `scripts/test-cross-repo-partner-adapter-contract.mjs` explicitly tests a **sibling repository**, `../quindad-fairpath-partner`, for contract alignment with this repo's SQL.

**I checked that sibling repo directly** (`C:\Users\Friend A Felon\Documents\GitHub\quindad-fairpath-partner`, a real Next.js app, `package.json` name `fairpath-partner`). It has live routes for exactly the claimed capabilities: `src/app/caseload/[personId]`, `src/app/referrals`, `src/app/campaigns`, `src/app/impact`, `src/app/jobs`, `src/app/housing`, `src/app/login`. This **is** the Command Center / partner workspace.

**Corrected classification: EXISTS**, not NEEDS VERIFICATION — in a separate repository (`quindad-fairpath-partner`), correctly outside `fairpath-mobile`'s scope, which is exactly why I never encountered it while doing member-facing mobile engineering all session. I did not open individual files inside that repo (out of my assigned scope — I'm mobile engineering + competitive research, not partner-app engineering), so I can't speak to *how complete or polished* those routes are, only that they genuinely exist and match the claimed feature set structurally. A deeper pass there would be a request for whoever owns that repo (Freebuff, per the team structure), not something I should start editing unprompted.

**Correction to the Honest Jobs package (§5):** that package's "largest gap" framing for a caseworker/Command Center surface should be read as **largely already addressed** at the backend+frontend level in `quindad-fairpath-partner`; the real open question is narrower — whether its referral/caseload UX already covers the specific patterns Honest Jobs' Reentry Navigator does well (invite/accept client linking, per-client activity tracking, exportable job lists), which requires someone with `quindad-fairpath-partner` in scope to check, not me from here.

## Pacing note
Each full first-pass package (Honest Jobs) took substantial multi-step browser research to do honestly — real pricing screenshots, real feature-comparison tables, cross-checked FAQ text. Producing that same depth for 10+ more companies in immediate succession would mean either rushing (shallow, low-confidence packages not worth the paper they're on) or running for many hours uninterrupted. I'm continuing company-by-company as instructed without stopping for approval between packages, but flagging here — once, plainly — that genuine depth and honest "I don't know yet" labeling (the standard this whole exercise explicitly wants) takes real research time per company, not just a page fetch.
