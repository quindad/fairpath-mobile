# FairPath+ — what it actually gives a member today

Built from reading the current code only — no historical plans, no old pricing docs, no ideas. If this looks thin,
that's the honest state, not an editing choice.

## LIVE + WORKING (a member with FairPath+ active gets this right now)

1. **Marketplace claim quota: 7/month instead of 1/month.** Server-enforced (`quota.plan==='fairpath_plus'` gates
   the limit in `request_marketplace_claim`; the client shows `CLAIM_LIMIT_REACHED` with the free-tier message
   otherwise). Real, working, verified this project's earlier sessions.
2. **A Housing FastTrack discount.** `quote_housing_fasttrack()` is server-evaluated and returns a real
   `discount_cents` for FairPath+ members, shown in the FastTrack checkout screen. Real, working. (FastTrack
   itself is a paid add-on separate from FairPath+ — the discount is the FairPath+ benefit, not the product.)

That's the complete list of concrete, server-enforced, currently-functioning benefits.

## BUILT BUT NOT CONNECTED

- **The Early Access 60-day grant.** The entitlement-issuance mechanism is real and proven (`activate_coverage_market`
  reuses `entitlement_grants`, idempotent, tested), but until a real market is actually activated on DEV or
  production, no member has ever received this grant outside a local test. The mechanism works; it has never
  fired for a real member.
- **Purchasing FairPath+ at all.** `billing-provider.ts` is explicit: on iOS/Android, `getBillingProvider()`
  always returns a `NotConfiguredProvider` — `purchasePlus()` returns `not_configured` with the message "FairPath+
  purchases through [App Store/Google Play] are not connected in this build yet. Nothing was charged." **There is
  currently no way for a member to buy FairPath+ at all.** The only way to have it today is a server-issued grant
  (correctional transition, promo, admin grant, or the new early-access-market source) — FairPath+ is entirely
  gift/grant-based right now, not a purchasable subscription.

## PLANNED / ASPIRATIONAL COPY (not backed by a specific built feature)

- Home's FairPath+ card says "Unlock more automation and guided tools." I could not find a specific feature this
  copy refers to — no automation or guided-tool gate anywhere else in the codebase is conditioned on FairPath+
  status. This reads as placeholder/aspirational marketing copy, not a description of something real. Flagging
  for a copy decision: either name the specific thing it unlocks, or soften the claim.

## OLD/STALE REQUIREMENT OR REMOVED/UNKNOWN

None found — I did not find contradictory old pricing docs or removed-feature references in the current
codebase to flag here. (If one exists outside the repo, e.g. in a pitch deck, I have no visibility into it.)

## Recommendation

If FairPath+ is going to be marketed with a "60 days free" campaign, it currently offers a real member two things:
a Marketplace claim bump (useful, but Marketplace is a secondary feature) and a FastTrack discount (useful only to
someone actively applying to FastTrack-enabled housing). Neither is a strong enough standalone hook to justify
"free access to FairPath+" as headline campaign language on its own — a member who reads "FairPath+" and expects
something transformative will be let down by "7 Marketplace claims a month."

Before marketing the 60-day benefit at any real volume, the minimum bar should be: (1) fix or remove the
"unlock more automation and guided tools" claim so nothing overstates what's live, and (2) decide whether at
least one more concrete, valuable benefit should exist before launch — options already discussed conversationally
this project (priority document generation, priority Resume Studio features, etc.) were never built and would
need explicit scoping, not assumed. I am not recommending any of those be built reflexively just to pad the
campaign — that decision belongs to Sterling, made with this honest baseline in hand, not before it.
