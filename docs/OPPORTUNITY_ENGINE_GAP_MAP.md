# Opportunity Engine — Gap Map (Phase 1)

**Baseline:** Community Exchange local foundation (85/85 mobile tests). Community SQL draft **not** on shared DEV.

## What smart-help already does

| Capability | Status |
|------------|--------|
| Single category → resource slug + marketplace category hints | Yes (`matchHintsForCategory`) |
| Marketplace ranking by category/state/food rescue | Yes (`rankMarketplaceForNeed`) |
| Request detail loads **one** resource category + **one** marketplace category sequentially | Partial |
| Graceful RPC missing (pre-migration) | Yes (`communityHelpBackendReady`) |

## Gaps (before this mission)

| Question | Answer |
|----------|--------|
| Multiple needs in one sentence? | **No** — single `community_help_requests.category` |
| Concurrent multi-source query? | **Partial** — `Promise.all` on 2 sources only, not food-rescue split |
| Deduplicate overlaps? | **No** |
| Active vs stale resources? | **Partial** — `freshness` on resources not surfaced on request detail |
| Transportation constraints? | **No** |
| Missing location permission? | **Partial** — manual city/state only; no geo prompt handling |
| Unverified vs confirmed availability? | **No** — labels not standardized |
| Valid next actions? | **Partial** — view routes only |
| Track assistance received? | **Partial** — request fulfilled RPC; no unified plan |
| Source failure recovery? | **Partial** — per-source `.catch(() => [])` |
| Works without AI? | **Yes** — no AI required today |

## Addressed in Opportunity Engine pass (local)

- Deterministic multi-need parsing + member confirmation
- Orchestrator: parallel Resource + Marketplace + Food Rescue adapters
- Explainable ranking, dedupe, availability confidence, fallbacks
- `/community/help-now` single entry (extends CommunityHelpPanel — no second Home search)
- My Path opportunity plan (device store + server summaries where available)
- Member referral **draft** migration + local SQL harness (Partner UI still out of repo)

## Still gated / out of scope

- Shared DEV community + referral migrations (approval required)
- Partner inbox for member referrals (repo not in workspace)
- Admin moderation extensions (repo not in workspace)
- QR pickup, geospatial radius, AI interpretation (optional future)
