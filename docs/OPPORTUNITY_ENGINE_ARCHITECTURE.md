# FairPath Opportunity Engine — Architecture

## Purpose

Connect **member need → understanding → multiple real sources → ranked options → supported action → status tracking** without duplicating Marketplace, Resources, or Community Exchange.

## Layers

| Layer | Module | Role |
|-------|--------|------|
| Intent | `src/core/opportunity/intent-parser.ts` | Deterministic multi-need parsing, urgency, transport constraints |
| Model | `src/core/opportunity/needs-model.ts` | Structured needs + location (no silent income/household inference) |
| Sources | `orchestrator.ts` | Adapters: `search_resources`, `loadMarketplace`, food rescue filter, growth routes |
| Quality | `dedupe.ts`, `ranking.ts` | Collapse duplicates; explainable scores (urgency, freshness, transport) |
| Actions | `types.ts`, `OpportunityResultsList.tsx` | Real routes: resource detail, market item, call, web, post request |
| Plan | `plan-store.ts` | Device-local unresolved/exploring items (My Path); not a second task platform |
| Referrals | `referral-service.ts` + draft SQL | Member-initiated referral **requests** (Partner inbox still required) |

## Entry points (single Home surface)

- `CommunityHelpPanel` → `/community/help-now` (I need help / grow / can help links)
- `/community/help-now` — confirm interpreted needs, then orchestrated search
- Request detail reuses orchestrator for multi-source results

## Source failure isolation

Each adapter catches errors; `sourceErrors` surfaces partial failure without emptying other results.

## Migration gates (unchanged)

1. `20261021180000_community_help_exchange_DRAFT.sql`
2. `20261021190000_profiles_professional_network_DRAFT.sql`
3. `20261021150000_canonical_justice_reconciliation_DRAFT.sql`
4. **New:** `20261021185000_member_resource_referral_DRAFT.sql`

## Partner / Admin handoff

- **Partner:** Read `member_resource_referral_requests` for orgs tied to resources; accept/decline → map to CRM when authorized.
- **Admin:** Existing resource moderation + marketplace reports; no new dashboard in this pass.
