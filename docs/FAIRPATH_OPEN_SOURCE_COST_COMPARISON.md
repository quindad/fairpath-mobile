# FairPath open-source cost comparison

**Illustrative models only** — use for direction, not budgeting sign-off. Labor = ongoing engineering + on-call.

## Workload assumptions

| MAU | Signal gateway calls/mo | Credit LLM calls/mo | Search queries/mo | Storage |
|----:|------------------------:|----------------------:|------------------:|--------:|
| 1,000 | ~5k | ~2k | ~30k | &lt;100 GB |
| 10,000 | ~50k | ~20k | ~300k | ~500 GB |
| 100,000 | ~500k | ~200k | ~3M | multi-TB |

Credit LLM = workflows using `runSignalCall`; gateway orchestration = **no** model spend today.

## Model A — Current hosted (baseline)

| Component | Provider | Notes |
|-----------|----------|--------|
| Database, auth, RLS, Edge | Supabase Pro/Team | DEV `znvhmuhojvwvjzmaqwff` |
| Mobile builds | EAS | Free tier + Apple dev account |
| Maps (Android) | Google Maps Platform | Optional key |
| AI (when enabled) | Anthropic API | Per-token |
| Geocoding | Device `expo-location` | No server geocode bill |
| Search | PostgreSQL FTS | Included in Supabase |
| Monitoring | Supabase + manual QA | |

**1k MAU:** Lowest ops labor; AI cost **scales with usage** if Anthropic enabled.  
**10k MAU:** Supabase compute + connection pool upgrades likely.  
**100k MAU:** Dedicated compute, read replicas, Edge concurrency planning.

## Model B — Hybrid (recommended path)

Keep **Supabase SoT**; add OSS where margin is clear:

| Add-on | When economical | Cost driver |
|--------|-----------------|-------------|
| changedetection.io | Resource ops &gt; ~50 monitored URLs | Small VPS ~$5–20/mo + engineer review time |
| Meilisearch | p95 search &gt; 300 ms or poor relevance at scale | 2–4 GB RAM VM or Meili Cloud |
| Ollama (single GPU) | &gt; ~10k credit LLM calls/mo **and** stable GPU ops | GPU VPS $50–400/mo + labor |
| Metabase | Partner reporting needs | 2 GB RAM VM or Metabase Cloud |
| Stirling-PDF worker | RR upload volume | Sidecar container |

**1k MAU:** **Stay Model A**; run changedetection only if catalog monitoring is priority. Local GPU **not** cheaper than sparse API at this tier.  
**10k MAU:** Hybrid wins for **search index + monitoring**; evaluate Ollama if AI spend &gt; ~$300/mo sustained.  
**100k MAU:** Meilisearch cluster + dedicated inference pool; still keep Postgres authoritative.

## Model C — Mostly self-hosted

Self-host Postgres, object storage, search, inference, PDF, monitoring.

| Risk | Impact |
|------|--------|
| RLS/Edge parity | Must re-implement Supabase security model |
| Mobile auth | Rebuild JWT/session |
| Labor | 1–2 FTE platform minimum |

**Not recommended** for FairPath near-term: destroys verified Signal/My Path/credit integration. Revisit only for **cost-at-scale** study after 100k MAU with measured Supabase invoice.

## AI inference economics (qualitative)

| Approach | 1k MAU | 10k MAU | 100k MAU |
|----------|--------|---------|----------|
| No provider key (today) | $0 API, fallback UX | Same | Same |
| Anthropic API | Low $ | Moderate $ | High $, needs budgets |
| Ollama 7B on GPU | **Higher** fixed cost than API at 1k | Break-even zone | Can win if utilization high |
| LocalAI multi-model | Same as Ollama + ops complexity | Same | Same |

**Rule:** Do not assume local is cheaper until **monthly API bill &gt; GPU + on-call** for **actual** credit-call volume.

## Geocoding / routing

| Service | Cost | FairPath use |
|---------|------|--------------|
| expo-location | Free on device | Keep |
| Nominatim public | Rate-limited | Dev only |
| Self-host Nominatim | Disk + RAM heavy | National scale |
| ORS / GraphHopper API | Freemium tiers | Transport enrichment |

## Summary recommendation

| MAU | Recommended model |
|-----|-------------------|
| 1,000 | **A** + changedetection POC |
| 10,000 | **B** (Postgres + Meili + monitoring) |
| 100,000 | **B** scaling out; **C** only for non-core read replicas |
