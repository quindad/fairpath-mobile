# Resource coverage matrix — Sprint 2 (evidence-backed)

**Generated:** 2026-10-27 (DEV read-only RPC + catalog audit)  
**DEV project:** `znvhmuhojvwvjzmaqwff`  
**Do not treat fixture titles as verified national programs.**

## Authoritative source catalog

| Metric | Value | Evidence |
|--------|------:|----------|
| Catalogued sources | **9** | `data/resource-sources/authoritative-catalog.json` |
| Ohio-priority sources | **3** | `ohio-211`, `ohiomeansjobs`, `odrc-reentry` |
| Seed fixture rows (local) | **70** | `supabase/seed/data/resources-fixtures.mjs` |

Dry-run ingestion: `node scripts/ingest-resource-sources-dry-run.mjs` → `data/resource-sources/last-dry-run.json`.

## DEV guest search (`search_resources`, ZIP 43215, 25 mi unless noted)

| Category | DEV total (43215) | Signal / Explore readiness | My Path |
|----------|------------------:|----------------------------|---------|
| Employment | 0 | RPC works; thin inventory | Save blocked if plan migration missing |
| Housing | 2 | Filter + detail routes exist | Same |
| Transportation | 1 | Relevance module + Columbus fixture | Same |
| Food | 1 | Explore tile + search | Same |
| Legal | 0 | Record Relief separate path | — |
| Reentry | 0 | Pathways partial | — |
| Veterans | 0 | `veterans.tsx` | — |
| Childcare | 0 | Thin-market CTAs | — |
| Crisis / DV | 0 | — | — |
| Education | 1 | — | — |
| Credit / money | 1 / 2 | Financial cards filtered in Signal when need ≠ money | — |
| Health | 0 | — | — |
| Homelessness | 0 | — | — |
| Entrepreneurship | 0 | `entrepreneurship/*` UI | — |

**Columbus transportation query:** 1 row — *Columbus Job Ride Program* (DEV fixture).  
**Broad search (43215, 50 mi, national):** **60** total rows reported by RPC (includes fixtures + any non-fixture DEV rows).

Machine-readable snapshot: `data/resource-sources/coverage-matrix-sprint2.json`  
Regenerate: `node scripts/resource-coverage-matrix-sprint2.mjs`

## QA gates

| Script | Result | Notes |
|--------|--------|-------|
| `node scripts/qa-dev-resources.mjs` | **19/20** | FAIL: unexpected non-`dev_fixture` provenance row on DEV |
| Resource Scout edge | Inventoried | See `qa-dev-edge-inventory-results.json` |

## Integration status

| Surface | Status | Blocker |
|---------|--------|---------|
| Explore search/filter | Implemented (unverified) | Thin categories; device UX |
| Signal multi-need | Code complete (`b27d471` + local nudge) | iPhone + gateway deploy if `_shared` changed |
| My Path saves | Partial | `20261026210000_member_opportunity_plan_items.sql` may be local-only vs DEV ledger |

## Phase next (no DB writes without approval)

1. Fix DEV provenance anomaly (identify non-fixture row; do not delete without operator review).
2. Add source adapters for Ohio 211 / OhioMeansJobs (API or curated CSV), normalize to existing import pipeline.
3. Small Columbus + Cleveland verified batch → dry-run → operator approval → DEV import.
4. Re-run `resource-coverage-matrix-sprint2.mjs` and `qa-dev-resources.mjs` after import.
