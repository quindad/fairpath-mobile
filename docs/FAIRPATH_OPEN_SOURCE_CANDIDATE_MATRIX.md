# FairPath open-source candidate matrix

**Evaluated:** 32 · **Top tier:** 20 ranked below · **Verified:** project homepages/repos (2026-10-26).  
**Legend — Integration:** L low · M medium · H high · **Priority:** P0 critical path · P1 high · P2 later · P3 watch · **Reject**

| Rank | Project | License | Maturity | FairPath gain | Duplicates | Integr. | Priority |
|-----:|---------|---------|----------|---------------|------------|-------|----------|
| 1 | [changedetection.io](https://github.com/dgtlmoon/changedetection.io) | Apache-2.0 | Active | URL monitoring for Resource Center sources | Partial: scout worker | M | P0 |
| 2 | [Meilisearch](https://github.com/meilisearch/meilisearch) | MIT | Active | Typo-tolerant jobs/resources index | `search_*` RPC FTS | M | P1 |
| 3 | [Ollama](https://github.com/ollama/ollama) | MIT | Active | Private LLM for Signal fallback/explanations | Anthropic adapter | M | P1 |
| 4 | [LocalAI](https://github.com/mudler/LocalAI) | MIT | Active | OpenAI-compatible local inference | Ollama (pick one) | M | P2 |
| 5 | [Metabase](https://github.com/metabase/metabase) | AGPL-3.0 | Active | Partner/ops dashboards | Supabase dashboard | L | P1 |
| 6 | [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | Apache-2.0 | Active | RR PDF merge/split pre-OCR | render-document partial | M | P1 |
| 7 | [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | GPL-3.0 | Active | Document archive/OCR pipeline | Credit/RR uploads | H | P2 |
| 8 | [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) | Apache-2.0 | Mature | Scanned doc text extraction | Cloud OCR future | M | P1 |
| 9 | [Nominatim](https://github.com/osm-search/Nominatim) | GPL-2.0 (data ODbL) | Mature | Geocode/reverse (server) | expo-location device | M | P2 |
| 10 | [OpenRouteService](https://github.com/GIScience/openrouteservice) | GPL-3.0 | Active | Routes, isochrones for transport | ZIP radius only today | M | P2 |
| 11 | [GraphHopper](https://github.com/graphhopper/graphhopper) | Apache-2.0 | Active | Routing engine self-host | ORS overlap | M | P3 |
| 12 | [Activepieces](https://github.com/activepieces/activepieces) | MIT | Active | Visual automation for ingest | Supabase cron | M | P2 |
| 13 | [Kestra](https://github.com/kestra-io/kestra) | Apache-2.0 | Active | Data/orchestration pipelines | Activepieces overlap | H | P3 |
| 14 | [Huginn](https://github.com/huginn/huginn) | MIT | Mature | Agent-based monitors | changedetection | M | P3 |
| 15 | [Appsmith](https://github.com/appsmithorg/appsmith) | Apache-2.0 | Active | Internal partner admin UI | fairpath-partner app | M | P2 |
| 16 | [Baserow](https://github.com/baserow/baserow) | MIT | Active | Spreadsheet CRM | **Reject as SoT** | H | Reject |
| 17 | [InvenTree](https://github.com/inventree/InvenTree) | MIT | Active | Food Rescue / inventory SKUs | marketplace tables | H | P3 |
| 18 | [PostHog](https://github.com/PostHog/posthog) | MIT | Active | Product analytics (self-host) | product-events stub | M | P2 |
| 19 | [Plausible](https://github.com/plausible/analytics) | AGPL-3.0 | Active | Privacy-friendly web analytics | PostHog overlap | L | P3 |
| 20 | [Uptime Kuma](https://github.com/louislam/uptime-kuma) | MIT | Active | Edge/API uptime | Supabase metrics | L | P2 |
| — | [Typesense](https://github.com/typesense/typesense) | GPL-3.0 | Active | Search alternative to Meili | Meilisearch | M | P2 |
| — | [SearXNG](https://github.com/searxng/searxng) | AGPL-3.0 | Active | Meta-search (not catalog) | Resource Center | L | Reject |
| — | [Langfuse](https://github.com/langfuse/langfuse) | MIT | Active | LLM tracing for Signal | gateway telemetry | L | P2 |
| — | [Dify](https://github.com/langgenius/dify) | Apache-2.0 | Active | Agent workflows | **Replace gateway** | H | Reject |
| — | [Flowise](https://github.com/FlowiseAI/Flowise) | Apache-2.0 | Active | Visual LLM chains | gateway | H | Reject |
| — | [Open WebUI](https://github.com/open-webui/open-webui) | BSD-3 | Active | Chat UI for Ollama | FairPath Signal UI | H | Reject |
| — | [Vaultwarden](https://github.com/dani-garcia/vaultwarden) | AGPL-3.0 | Active | Secrets for ops | EAS/Supabase secrets | L | P3 |
| — | [MinIO](https://github.com/minio/minio) | AGPL-3.0 | Active | Object storage | Supabase Storage | M | P3 |
| — | [Gotenberg](https://github.com/gotenberg/gotenberg) | MIT | Active | PDF generation API | render-document | M | P2 |
| — | [Moodle](https://github.com/moodle/moodle) | GPL-3.0 | Mature | Full LMS | FairPath Academy | H | P3 |
| — | [Canvas LMS](https://github.com/instructure/canvas-lms) | AGPL-3.0 | Mature | LMS | Academy | H | Reject |
| — | [Nextcloud](https://github.com/nextcloud/server) | AGPL-3.0 | Active | File/collab | Supabase storage | H | Reject |
| — | [Mattermost](https://github.com/mattermost/mattermost) | AGPL-3.0 | Active | Team chat | notifications | H | P3 |
| — | [ntfy](https://github.com/binwiederhier/ntfy) | Apache-2.0 | Active | Push alerts for ops | Expo notifications | L | P3 |

## Top 20 — detail cards (abbreviated)

Each candidate: **API** (REST/HTTP typical), **infra** (Docker), **security** (self-host + auth), **cost** = infra + labor (no fabricated dollar totals).

### 1 changedetection.io — P0

- **Gain:** Steps 1–4 of resource intelligence (monitor, diff, broken links).
- **Integration:** Webhook → Supabase Edge `resource-scout-worker` or new `resource-change-ingest` (service role); human queue unchanged.
- **Exclude:** Auto-publish scraped HTML as verified resources.

### 2 Meilisearch — P1

- **Gain:** Typo tolerance, faster faceted browse at scale.
- **Benchmark:** DEV Postgres probe p50 **~118–145 ms** for 20-row RPC (`scripts/poc/postgres-search-latency-results.json`)—adequate at current scale; revisit at **10k+ MAU** or relevance complaints.
- **Integration:** Nightly/hourly indexer from Postgres; search Edge Function dual-read or Meili-only for guest browse.

### 3 Ollama — P1

- **Gain:** DEV/staging inference without Anthropic spend; offline demos.
- **Compare LocalAI:** Ollama simpler ops; LocalAI broader model formats—**choose one** standard.
- **Integration:** New adapter in `run.ts` / `gateway.ts`; VPC endpoint; no PII in prompts without redaction.

### 4–20

See blueprint phases; **Baserow/Dify/Flowise/Open WebUI** rejected as duplicate control planes.

## Explicit exclusions

| Technology | Reason |
|------------|--------|
| Baserow as CRM SoT | Conflicts with Supabase RLS member truth |
| Dify / Flowise agents | Bypass credit + gateway governance |
| SearXNG for Resource Center | Not authoritative program data |
| Replace PostgreSQL search entirely | RLS + proven RPC contracts |

## Prototype measurements

| Test | Outcome |
|------|---------|
| `postgres-search-latency-probe.mjs` | DEV: `search_resources` p50 **118 ms**, p95 **349 ms**; `search_jobs` p50 **145 ms** (query `warehouse`, 0 rows) |

Meilisearch A/B **not run** (no indexer on Mini PC per mission constraints).
