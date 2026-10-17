# Competitive Intelligence Research Package: Apartments.com
**Researcher:** Juice | **Date:** 2026-10-09 | **Method:** Claude Browser pane, public pages only.

## 1. Overview
**Same parent company as Homes.com — both are CoStar Group brands** (confirmed in both sites' footers; Apartments.com's footer lists Homes.com as a sibling "Marketplace," and vice versa). This is the consumer+landlord rental-specific brand; Homes.com skews broader (buy/sell/rent). Treat these two packages as one research unit, not fully independent competitors.

## 2. Feature inventory **[OBSERVED]**
- **Apartments.com Ai** — a conversational search feature ("Search Smarter: Type it or say it," claims instant answers on unit availability, fees, pet policies, amenities, move-in specials; neighborhood info on schools/walkability/transit; guided Matterport 3D tours; "over 50 languages"). Not opened/tested this pass — button/feature existence confirmed, depth unverified.
- **Renter-side:** browse listings, "Apply online," "sign your lease," "pay your rent" — claims a fully online rent-to-lease pipeline, not just a listings board.
- **Landlord-side "Rental Manager" suite** (the most consequential finding this pass): list property, **screen applicants**, create digital leases, collect rent online, view "Rent Comps."
- **Screen Applicants / Online Tenant Screening** (own page, directly observed): landlords can screen on **evictions, criminal history, summarized credit risk, and uploaded documents**, powered by **TransUnion's "ResidentScore"** (credit-risk rating) plus total debt, payment history, employment/address history. **No fair-chance consideration, no disclosure requirement, no "ban the box"-equivalent messaging anywhere on this page.** This is landlord-configurable screening tooling handed out at scale, with criminal history as a first-class, explicitly named screening category.
- Scale claims: "over 1 million" listings, "75 million renters."

## 3. FairPath comparison — this one is different from the others

This isn't primarily a feature-gap comparison; it's **threat-landscape validation**. Apartments.com is the dominant rental-listing platform, and its own landlord tooling actively facilitates criminal-background-based screening with zero fair-chance mitigation built in. This directly confirms *why* FairPath's existing per-listing screening-policy disclosure (observed live earlier this engagement: "Credit and rental history required. Background check reviewed against a 7-year lookback for certain offense categories") is genuinely valuable, member-protective functionality — it's translating exactly the kind of opaque, criminal-history-weighted screening Apartments.com's own tooling enables, into something a FairPath member can see *before* they apply and get rejected (and before an application fee, often non-refundable, is spent).

| Capability | FairPath status | Classification |
|---|---|---|
| Criminal-history screening tooling for landlords | Not something FairPath should build (FairPath serves the applicant, not the screener) | **Not a gap** — explicitly out of scope by mission. |
| Pre-application screening-policy transparency for the applicant | **FairPath already has this** | **FairPath advantage**, now validated against the actual adversarial tooling landlords use. |
| Conversational AI search | FairPath AI exists for cross-module navigation (traced and audited earlier this engagement) but not yet for housing-specific conversational listing search | Possible future extension of FairPath AI's existing scope — not a new system, an extension. Low priority pending product interest. |

## 4. Recommendation
No new build recommended from this pass specifically — the actionable output is **validation and messaging**, not a feature gap: FairPath's existing screening-transparency feature on housing listings is a real differentiator against the exact mechanism (TransUnion ResidentScore + criminal-history screening) that makes housing search hardest for FairPath's population. Worth highlighting in any FairPath marketing/pitch material, flagging to product rather than engineering.

## 5. Source links
- https://www.apartments.com/
- https://www.apartments.com/rental-manager/online-tenant-screening

## 6. Not covered
- Apartments.com Ai (conversational search) — not opened.
- Actual renter application flow (would require creating an account).
- Rental Manager's leasing/rent-collection tools beyond the screening page.
