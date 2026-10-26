# FairPath open-source technology blueprint

**Status:** Research + architecture (2026-10-26)  
**Branch:** `development/mobile-v1-completion` · **Baseline commit:** `3dc4e45`  
**DEV:** `znvhmuhojvwvjzmaqwff` · **Do not replace verified Signal 2.0 / My Path / credit / RLS stack.**

## Executive summary

FairPath already runs a **Supabase-centric** opportunity platform: PostgreSQL `search_jobs` / `search_housing` / `search_resources` (FTS + geo), **`fairpath-ai-gateway`** (auth + tool RPCs, no model spend), **`runSignalCall`** credit workflows, **`resource-scout-worker`** + `data/resource-sources/authoritative-catalog.json`, Record Relief jurisdiction engine, and Expo **`expo-location`** geocoding.

Open-source expansion should **augment** that spine—not fork a second member database or bypass RLS/credits.

**Five highest-value integrations (ranked):**

1. **changedetection.io** (or equivalent) → feed **human-reviewed** resource freshness pipeline (extends existing scout worker + catalog).
2. **Meilisearch** (optional) → secondary search index synced from Postgres for typo-tolerant discovery **behind Edge Functions** (only if PostgreSQL latency/relevance gaps justify ops cost).
3. **Private inference (Ollama / LocalAI)** → optional **adapter hop** in `ai-gateway` for non-sensitive fallback text (not eligibility/legal); keep gateway + `spend_ai_credits` mandatory.
4. **Metabase** (or Supabase Dashboard + SQL) → partner/ops analytics on **read-only** views—not a second CRM of record.
5. **Stirling-PDF + OCR stack (Tesseract / docTR via worker)** → Record Relief **document prep** only; rules engine stays deterministic.

**Rejected as primary platform replacements:** Baserow/Appsmith as member SoT, scraping-to-publish without review, LLM-driven Record Relief eligibility, replacing `fairpath-ai-gateway` with LangChain-style agent runtimes on device.

## Preserved baseline (do not destabilize)

| System | Location / proof |
|--------|------------------|
| Signal gateway + tools | `supabase/functions/fairpath-ai-gateway`, DEV QA PASSED |
| Credit auth order | `runSignalCall` → `getUser()` then `spend_ai_credits` (`bf177c7`) |
| Search RPCs | Migrations `search_jobs`, `search_resources` (`websearch_to_tsquery`, ZIP radius) |
| My Path cloud | `member_opportunity_plan_items` + `member-opportunity-plan-service.ts` |
| Location | `expo-location`, `member-search-location.ts`, gateway ZIP echo |
| Regression | 122/122 tests, TypeScript clean |
| iPhone gate | Build `e52815e1` — **physical acceptance pending** (`docs/DEV_IPHONE_JOURNEY_RESULTS.md`) |

## Target architecture (integration rule)

```text
Mobile (Expo) ──JWT──► Supabase Edge (fairpath-ai-gateway, Signal workflows)
                              │
                              ├──► PostgreSQL (RLS, RPC search, credits, resources)
                              ├──► [optional] Meilisearch (service role indexer only)
                              ├──► [optional] Ollama/LocalAI (VPC, no member PII in prompts without policy)
                              └──► [optional] changedetection / workers ──► review queue ──► published resources
```

**Hard rules:**

- Members never call Meilisearch/Ollama directly.
- No auto-publish of benefits/legal/housing claims from scrapers.
- Record Relief: OCR/PDF may **extract text**; **eligibility** remains `record_relief_*` engine + staff review.

## Phase summaries

### Phase 2 — Signal intelligence

- **Today:** Gateway uses **regex/heuristic** intent (`classifyIntent`, `planTools` in `fairpath-ai-gateway/index.ts`); credit workflows use **Anthropic adapter** when `ANTHROPIC_API_KEY` set, else honest fallback.
- **Ollama / LocalAI:** Suitable for **draft copy**, query expansion, and **routing hints** at low volume. Not a free lunch: GPU RAM (7B–8B ≈ 8–16 GB VRAM), cold start, ops labor. At **1k MAU**, hosted small model API may cost **less** than 24/7 GPU unless batching heavy workloads.
- **Recommendation:** Add **`provider: 'ollama'`** as optional second hop in `gateway.ts` **after** credit spend, for **non-sensitive** workflows only; keep gateway orchestration. Prototype: compare latency/quality vs fallback (no production keys required for baseline).

### Phase 3 — Resource Center automation

- **Today:** `resource-scout-worker`, `resource_scout_invoke_worker`, `authoritative-catalog.json`, dry-run `scripts/ingest-resource-sources-dry-run.mjs`.
- **changedetection.io** (MIT): monitor URLs, diff HTML, webhooks—fits **steps 1–4** (monitor, detect change, broken links). Pair with existing **moderation** (`community_contributions`, staff review)—steps 7–9.
- **Activepieces / Kestra / Huginn:** orchestration layers; use **one** if scout cron outgrows Supabase cron—avoid three overlapping schedulers.

### Phase 4 — Record Relief

- **Stirling-PDF** (Apache-2.0): merge/split/rotate—good for member uploads **before** OCR.
- **Paperless-ngx** (GPL-3.0): strong DMS; **license** requires careful SaaS use; prefer **worker integration** not full DMS fork for mobile app.
- **OCR:** Tesseract (Apache-2.0) or cloud OCR later; align with existing `extract-record-relief-case` / credit extraction boundaries.

### Phase 5 — Location

- **Keep** `expo-location` on device for permission UX.
- **Nominatim** (ODbL): self-host or public instance policy; attribution required; rate limits on public API.
- **OpenRouteService / GraphHopper:** routing matrices for “transportation near me” **enrichment** (travel time sort)—call from Edge with API keys, cache results; do **not** replace ZIP-radius RPC until benchmarks show gain.

### Phase 6 — Partner Command Center

- **Supabase remains SoT.** Partner app exists (`quindad-fairpath-partner` per docs).
- **Metabase** (AGPL): BI on read replica; **Appsmith** (Apache-2.0): internal admin UI over Supabase API—avoid duplicating member PII in Baserow.

### Phase 7 — Community Exchange / inventory

- **InvenTree** (MIT): warehouse-style; only if Food Rescue / marketplace needs **SKU-level** stock beyond current FairPath tables.

### Phase 8 — Cost models

See **`docs/FAIRPATH_OPEN_SOURCE_COST_COMPARISON.md`**. Self-host wins at **sustained high AI + search volume**; hybrid wins for **10k MAU** with managed Postgres + selective OSS.

### Phase 9 — Prototypes (isolated)

| POC | Result |
|-----|--------|
| Postgres search latency | `scripts/poc/postgres-search-latency-probe.mjs` — DEV p50 ~118–145 ms (see results JSON) |
| Resource monitor design | Documented pipeline in roadmap; no changedetection.io on Mini PC |
| Local inference | **Not installed** on Mini PC (resource guard); architecture slot documented |

### Phase 10 — iPhone acceptance gate

**Release blocker:** physical checklist in `docs/DEV_IPHONE_SIGNAL_MY_PATH_CHECKLIST.md`. Open-source work **must not** stop Metro `:8083` or replace build `e52815e1` until device sign-off recorded.

## License & security cross-cutting

- Prefer **MIT/Apache-2.0** for embedded services; **AGPL/GPL** (Metabase, Paperless) → legal review before multi-tenant SaaS.
- All new services: private network, no public anon admin, secrets in Supabase/EAS—not repo.
- Agent research docs are **proposals** until DEV prototype + regression green.

## Related deliverables

- `docs/FAIRPATH_OPEN_SOURCE_CANDIDATE_MATRIX.md` — 32 candidates, top 20 ranked  
- `docs/FAIRPATH_OPEN_SOURCE_COST_COMPARISON.md` — hosted vs hybrid vs self-host  
- `docs/FAIRPATH_OPEN_SOURCE_IMPLEMENTATION_ROADMAP.md` — 30/60/90 days  
- `docs/FAIRPATH_ECC_ENGINEERING_EVALUATION.md` — Cursor + Claude Code tooling  
