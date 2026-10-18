# Explore & unified discovery E2E (039–042)

**Automated:** `npm run test:explore`, `npm run test:jobs`, `npm run test:housing`, `npm run test:resources`.

## Explore tab

1. Bottom nav **Explore** → `/explore` with sectioned cards (Work/housing, Learn, Pathways, Support).
2. Each **Available** card opens a real route; **Planned** cards stay disabled.
3. Deep links from Explore match the same screens as Home quick links (jobs, housing, Signal, etc.).

## Unified discovery patterns

| Surface | Search | Map | Guest OK |
| --- | --- | --- | --- |
| `/find-jobs` | `search_jobs` RPC, infinite scroll | LIST/MAP + pins | Yes |
| `/find-housing` | `search_housing` RPC | LIST/MAP + pins | Yes |
| `/resources` | Server search / needs resolution | N/A | Yes |

## Manual QA (042)

- Phone + web: Explore scroll, tap targets, themed tokens on `/explore`.
- Map: pin select → open detail on iOS/Android and web fallbacks.
