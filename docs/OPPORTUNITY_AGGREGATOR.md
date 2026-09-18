# FairPath Opportunity Aggregator

FairPath treats outside inventory as licensed provider data, not scraped content.

Pipeline:

Provider adapter -> raw snapshot -> normalization -> deduplication -> permitted evidence extraction -> deterministic compatibility rules -> AI explanation/ranking -> FairPath discovery UI.

## Source contract
Every provider is registered in `opportunity_sources`. A source stays `pending_approval` or `planned` until FairPath has valid access and terms. `ai_processing_allowed` must be explicitly true before source content is sent through AI extraction.

## User-facing lanes
- All Jobs / All Housing: all active inventory FairPath is permitted to display.
- FairPath Matches: profile-aware ranking using verified requirements and known user facts.
- Verified Second-Chance: only where explicit evidence or FairPath partner verification exists.
- Needs Additional Review: potentially compatible, but FairPath does not have enough verified information to make a stronger statement.

AI never converts missing background-policy information into a claim that an opportunity is felony-friendly. Hard restrictions come from versioned rules and verified provider data.

## Provider adapters
Adapters normalize provider-specific fields into the canonical FairPath models. API keys and feed credentials belong server-side only. Ingestion should run through server-side functions/background jobs, never directly from the mobile client.

## Deduplication
Prefer provider external IDs within a source. Cross-source duplicates should later use normalized company/property identity, title/address, location, canonical URL and content fingerprints. Keep source attribution and original URLs even when records are merged.

## Housing media
The canonical housing model supports photos, video, floor plans and virtual/3D tour URLs when the provider license permits FairPath to display them.

## Next connection step
When a provider approves access, implement its adapter, store credentials as server-side secrets, activate the source, and run a small verified ingestion before scheduling recurring syncs.
