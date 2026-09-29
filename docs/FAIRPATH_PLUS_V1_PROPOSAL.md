# FairPath+ V1 proposal — what could legitimately become a benefit

A design memo, not an implementation. Nothing here should be built unless a choice below is obvious and low-risk
— the goal tonight is clarity, not forced monetization. See `docs/FAIRPATH_PLUS_CURRENT_VALUE.md` for the honest
baseline this builds on: two live benefits today (Marketplace 7-claim quota, FastTrack discount), no purchase
path exists on either platform.

## FREE FOREVER CORE — never paywall these

Everything that helps someone survive, find work, find housing, or clear their record must stay free. This is
the actual reentry mission and the reason FairPath exists:
- Job search, job detail, Easy Apply, application tracking
- Housing search, Standard Apply, application tracking
- Resources search (food, shelter, ID, transportation, urgent needs)
- Opportunity Profile (all 8 sections)
- Record Relief case tracking, eligibility checks, document generation, filing packets
- Credit Builder core workflow (upload, review, dispute building, letters)
- FairPath AI's deterministic guidance
- Resume Studio — at least one working resume, PDF/DOCX export
- Meetings tracking
- Document generation and My Documents for anything produced by the free features above
- Account, privacy, and Early Access enrollment itself

Putting any of these behind a paywall would be putting essential reentry infrastructure behind a paywall for
people who are often in genuine financial crisis. Not appropriate at any point, not just V1.

## FAIRPATH+ VALUE — candidates worth considering, evaluated honestly

| Candidate | Ethically appropriate? | Technically possible now? | Business-sensible? | Verdict |
|---|---|---|---|---|
| Resume Studio beyond the 20-resume limit (already exists as a hard cap: `RESUME_LIMIT`) | Yes — one good resume is the free-tier promise; more resumes is a power-user convenience, not survival | Yes, the limit is already a single constant to raise for FairPath+ | Plausible — cheap to build, real utility for someone job-hunting broadly | **Worth considering** |
| Advanced document conveniences (e.g. combined multi-document ZIP downloads, which already exist for Record Relief packets — extending the pattern elsewhere) | Yes | Partially — the document engine already supports this; would need per-module wiring | Weak — thin, easy to overstate | **Marginal, low priority** |
| Priority/faster document generation | No meaningful technical difference exists (`render-document` has no queue to jump), so this would be fake scarcity | N/A | N/A | **Not appropriate** — would require inventing a delay for free users, which is manipulative |
| Enhanced Home/Me alerts (e.g. more granular notification categories once push exists) | Yes, if the underlying notifications are genuinely more useful, not just unlocked | No — push isn't wired yet; nothing to gate | Wait until the notification system itself exists | **Defer** — premature to design against a system that doesn't send anything yet |
| Advanced application tracking / organization (e.g. notes on applications, custom tags, saved search alerts) | Yes — this is closer to a "power tool" than a survival need | Partially — `saved_housing_searches` already exists as infrastructure; job-side equivalent would need building | Plausible — genuinely differentiates without hurting the free tier | **Worth considering, needs scoping** |
| Credit workflow conveniences (e.g. more than N tracked disputes, or export formats beyond what free gets) | Careful — credit repair is also often urgent, not a luxury. A hard cap on NUMBER of disputes could hurt someone with a genuinely inaccurate report with many errors | Yes, technically trivial to cap | Risky — this is the closest candidate to "paywalling essential reentry help" | **Not appropriate to cap by count.** A format/convenience difference (e.g. combined dispute-packet ZIP vs one-by-one) could be fine; capping the number of disputes someone can pursue is not |
| Premium automation (mentioned in existing Home copy, "unlock more automation and guided tools") | Depends entirely on what it means — currently means nothing (flagged in the value doc) | No — nothing built | N/A until defined | **Fix the copy or define the feature before this ships to anyone** |

## INSTITUTION-SPONSORED BENEFITS — unchanged, already real

Correctional-transition grants (90 days, verified identity, one per account) are a separate, already-working
category — not something to redesign here. Institution/nonprofit sponsor grant types exist in the schema
(`entitlement_grants.source_type`) but have no issuance flow built yet; out of scope for this memo.

## EARLY ACCESS PROMOTIONAL BENEFITS — the 60-day grant, now proven working

The mechanism is real and now DEV-verified end to end this session (including a real bug fix). What it currently
*grants* is whatever FairPath+ is worth at the time — which is the actual reason this memo exists. Recommendation:
do not expand marketing of the 60-day benefit until at least one of the "worth considering" rows above ships, so
the promise matches the product.

## DO NOT PAYWALL — explicit list, not to be revisited casually

Anything in "FREE FOREVER CORE" above, plus: number of credit disputes pursued, access to Record Relief case
tracking or document generation, Opportunity Profile completeness, Early Access enrollment itself, and the core
FairPath AI guidance. If a future session proposes paywalling any of these, that proposal should have to argue
against this memo explicitly, not just against silence.

## Recommendation

The two lowest-risk, most defensible additions if FairPath+ needs more V1 substance before wider marketing:
1. **Raise the Resume Studio cap for FairPath+ members** (e.g. free stays at a smaller number, FairPath+ gets the
   current 20 or higher) — cheapest to build, doesn't touch anything survival-critical, and Resume Studio is
   explicitly a "build more opportunity" tool rather than a crisis tool.
2. **Fix or define the "unlock more automation and guided tools" copy** — this is nearly free (a copy change or a
   small scoping decision) and closes a real trust gap: right now the app makes a promise on Home that nothing
   backs.

Both are small enough to implement without Sterling's input if he wants to greenlight them later; neither was
implemented tonight since "obvious and low-risk" is Sterling's own bar to clear, not mine to assume.
