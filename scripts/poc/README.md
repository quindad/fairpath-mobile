# Isolated POC scripts (DEV research)

Do **not** run alongside production Metro acceptance without coordination.

| Script | Purpose |
|--------|---------|
| `postgres-search-latency-probe.mjs` | Measures DEV `search_jobs` / `search_resources` RPC latency (anon-safe) |

Outputs: `postgres-search-latency-results.json` (local, may be gitignored).
