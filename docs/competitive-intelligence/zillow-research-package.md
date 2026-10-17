# Competitive Intelligence Research Package: Zillow
**Researcher:** Juice | **Date:** 2026-10-09 | **Method:** Claude Browser pane — **substantially blocked this session.**

## 1. Access status — read this first
Zillow returned **"Access to this page has been denied"** on every path attempted this pass: the rentals search, the rental-manager page, and eventually the homepage itself (which rendered once, with only a sparse "Within BuyAbility" fragment extracted, before subsequent requests were denied outright). This looks like automated-traffic detection, not a one-off error. Per the directive's authorization boundary, I did not attempt to work around it (no header spoofing, no alternate path, no retry-until-it-works). This package is therefore built from **well-established public knowledge** about Zillow's product (the kind of information any informed researcher would already know from the product's public reputation and years of mainstream coverage), explicitly **not** from anything freshly observed this session — every claim below is labeled accordingly and should be treated as lower-confidence than the packages where I actually walked the live product.

## 2. Feature inventory **[GENERAL KNOWLEDGE — NOT OBSERVED THIS SESSION]**
- **Zestimate** — Zillow's proprietary automated home-value estimate, shown on nearly every for-sale and many off-market listings.
- **BuyAbility** — a personalized "how much home can you afford" estimate tied to a user's financial profile (the one fragment actually rendered this session, "Within BuyAbility," is consistent with this being a prominent homepage feature, which is the one piece of this package with partial direct confirmation).
- Rental listings alongside for-sale listings (unlike Apartments.com/Homes.com which are rental/sale-specialized under one CoStar umbrella, Zillow is a single brand covering both).
- **Zillow Rental Manager** — landlord-side tool for listing, applications, and (per public knowledge) tenant screening with background/credit checks, broadly analogous to Apartments.com's Rental Manager — **not independently confirmed this session** since the URL was blocked.
- Mortgage/financing tools and lender connections integrated into listings.
- Owned by **Zillow Group**, which also owns **Trulia** and **StreetEasy** (NYC-specific) — worth noting as further "same parent, multiple brands" structure, consistent with the CoStar pattern found with Homes.com/Apartments.com. **[GENERAL KNOWLEDGE]**

## 3. FairPath comparison
Given the access block, I'm not going to manufacture a detailed gap table from unverified assumptions. The one directionally useful point: if Zillow's tenant-screening tooling works similarly to Apartments.com's (criminal-history screening with no fair-chance mitigation — confirmed on Apartments.com this session), the same "FairPath already discloses screening policy per-listing" advantage likely applies here too. This is an **inference from a sibling competitor's confirmed pattern**, not a Zillow-specific finding, and should be verified directly once Zillow access is possible.

## 4. Recommendation
**Re-attempt this research with a different access path**, specifically: a real logged-in session (the founder or a team member with an existing Zillow account, used directly by a human, not by me) would very likely get past the automated-traffic block, since the denial pattern looks like bot-detection rather than a geo/content restriction. I should not be the one attempting workarounds. Flagging as a clean "needs a human assist" item rather than quietly giving up or fabricating findings.

## 5. Source links
- https://www.zillow.com/ — loaded once (sparse), then denied on repeat
- https://www.zillow.com/columbus-oh/rentals/ — denied
- https://www.zillow.com/rental-manager/ — denied

## 6. Status
**Incomplete — blocked.** Do not treat §2 as verified; it is general public knowledge only, explicitly flagged as such.
