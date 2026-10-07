# Experian — discovery questions for the upcoming demo

Nothing about Experian is integrated into FairPath Staffing or any employment workflow. An adapter slot exists
(`src/core/staffing/experian-adapter.ts`) that exposes no employment-screening surface by design — a test fails if
it ever gains an export matching `screen`, `hire`, `reject`, `employment`, or `background`. This document lists what
needs to be answered before any real integration is written.

## Questions to answer during the demo

1. **Exact product.** Which specific Experian product is this — credit data, identity verification, income/employment
   verification, fraud/risk, something else? Get the exact product name.
2. **Permitted purpose.** What is Experian's stated permitted purpose for this product? Employment screening has its
   own FCRA-governed permissible purpose category — do not assume a product licensed for one purpose (e.g. consumer
   credit marketing) extends to employment use.
3. **Consumer vs. business data.** Is this consumer data (about an individual) or business data (about a company)?
4. **Employment-use restrictions.** Does Experian's agreement explicitly permit use in employment decisions? If not,
   this product must never touch staffing or hiring, regardless of what FairPath Industries' broader Experian access
   covers.
5. **Consent requirements.** What consent or authorization does Experian require from the individual before FairPath
   can request their data?
6. **API availability.** Is there a documented, versioned API? Request the actual technical specification — do not
   proceed from a sales deck.
7. **Sandbox.** Is a sandbox/test environment available, separate from production data?
8. **Authentication.** What authentication model does the API use (API key, OAuth, mutual TLS, something else)?
9. **Webhook/event support.** Does Experian push events, or is this poll-only? If webhooks exist, request the actual
   payload schema — do not guess at it the way `foxhire-adapter.ts` and `checkr-adapter.ts` deliberately avoid
   guessing at FoxHire's and Checkr's.
10. **Pricing model.** Per-pull, subscription, tiered? This affects whether a use case is commercially viable at all.
11. **Retention requirements.** How long is FairPath required (or permitted) to retain any data pulled from Experian?
12. **Deletion requirements.** What is the process for deleting a member's Experian-sourced data on request (ties
    into the Privacy Center deletion-request flow already built in `src/core/privacy/privacy-center.ts`)?
13. **Dispute obligations.** If this product falls under FCRA, what are FairPath's obligations when a consumer
    disputes information sourced from Experian?
14. **FCRA implications.** Confirm explicitly whether FCRA applies to this specific product and use case. If it does,
    the same consent-before-request, human-review, no-auto-decision rules already built for Checkr
    (`src/core/staffing/checkr-adapter.ts`) will need to apply here too, and that work has not been duplicated or
    started for Experian.

## What happens after the demo

Once these are answered, the founder maps the exact product to the exact FairPath workflow it belongs in (most
likely Credit Studio, given FairPath's existing credit-report work in `src/core/credit/`, not staffing/employment).
Only then does `experian-adapter.ts` gain a real interface, matching the same adapter-plus-DEV-mock pattern used for
FoxHire and Checkr. Until that mapping exists, this module stays a placeholder.
