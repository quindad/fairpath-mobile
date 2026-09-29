# Record Relief autonomous legal-change monitor — architecture

The end-to-end future automation, with **NOW** vs **FUTURE** labeled at every stage. Nothing here should be read
as already running — this document exists so the schema built this session (`legal_source_registry` and
friends) is built against the real eventual shape of the system, not a guess.

```
SCHEDULER
  → SOURCE FETCH
  → SNAPSHOT
  → HASH/DIFF
  → CHANGE CANDIDATE
  → AI RESEARCH
  → AI RED TEAM
  → NORMALIZATION
  → SCHEMA VALIDATION
  → AUTOMATED TESTS
  → HUMAN REVIEW
  → APPROVAL
  → EFFECTIVE-DATE SCHEDULING
  → PUBLICATION
  → IMPACT ANALYSIS
  → OPTIONAL MEMBER RE-CHECK NOTIFICATION
```

## NOW (built this session, real, tested)

| Stage | What exists |
|---|---|
| Source registry | `legal_source_registry` — one row per monitored source (statute page, court rule, agency guidance, form), with `priority`, `check_frequency`, `parser_type`, `content_hash`/`etag`/`last_modified` fields ready to receive a real fetcher's output. Empty today — no sources are actually registered yet. |
| Snapshot storage | `legal_source_snapshots` — schema ready to store a fetch's outcome (`success`/`not_modified`/`http_error_404`/`http_error_403`/`http_error_other`/`redirect`/`timeout`/`extraction_failed`/`source_disappeared`) and a content excerpt for diffing. No fetcher writes to it yet. |
| Change candidates | `legal_change_candidates` — schema ready to record a detected hash change with the full classification vocabulary (`no_legal_change` through `unknown_needs_review`). Classification defaults to `unknown_needs_review` and nothing in the schema can auto-advance it — a website changing is recorded as a SOURCE fact only. |
| Candidate staging | `legal_rule_candidates` — the actual `RESEARCHED → NORMALIZED → NEEDS_REVIEW → VERIFIED → REJECTED/PROMOTED` lifecycle, physically separate from `record_relief_rules`, zero member read access at the grant level (not just RLS). |
| Promotion | `promote_legal_rule_candidate()` — the one and only path from staging into the live rules table, requires `lifecycle_state = 'verified'` and `schema_blocked = false`, always inserts `status = 'draft'`, never `'verified'`. |
| Publication gate | Already existed, re-confirmed unchanged: `rr_rules_read_verified` RLS policy, `status = 'verified'` only. |
| Effective-date scheduling | Already existed, re-confirmed this session: `record_relief_active_rules()` filters `effective_from <= current_date`, so an approved-but-future-dated row is server-side invisible until its date arrives — **no scheduled job, no person flipping a switch at midnight, this is already deterministic.** |
| Superseding without destroying history | Already existed: `rule_key` + `rule_version` unique, evaluations snapshot `rule_id`/`rule_key`/`rule_version` at evaluation time, `rule_stale`/`superseded` flags. Re-verified this session, not rebuilt. |
| Impact analysis | `record_relief_rule_impact(rule_key, rule_version)` — a real, working query answering "how many stored, non-superseded evaluations used this exact rule version" — built on data that already existed (no new columns needed). Service-role only; this is the backend contract for the "POTENTIALLY AFFECTED CASES: 184" style Admin display, not the display itself. |
| Federal pathway typing | `record_relief_federal_pathways.pathway_type` enum + `effect_summary`/`rights_not_restored` — pardon/commutation/remission/reprieve/judicial expungement/statutory relief/firearm-rights restoration are now structurally distinct, not naming convention. |
| Staleness | Already existed (`next_review_at`, the 1-year derived warning) — this session audited it against the nationwide requirement and found it adequate for the PUBLISHED-rule staleness question. The SOURCE-monitoring staleness question (`legal_source_registry.check_frequency` vs `last_checked_at`) is new schema this session but has no computation wired to it yet — see FUTURE. |
| Re-evaluation without rewriting history | Already existed: `evaluate_record_relief_case()` always creates a NEW evaluation row and marks prior ones `superseded`, never mutates a past evaluation. A member's historical result is permanent; only a fresh `RE-CHECK` action produces a new one under the currently published rule. |

## FUTURE (documented, deliberately not built this session)

| Stage | What it needs | Why deferred |
|---|---|---|
| Scheduler | A real cron/worker process calling into the fetch pipeline on each source's `check_frequency` | Infrastructure, not schema — would need a hosting decision (Supabase Edge Function cron, external worker) outside tonight's scope |
| Source fetch | An actual HTTP fetcher per `parser_type` (html/pdf/api), writing real rows into `legal_source_snapshots` | Needs real network fetch code + a decision on where it runs (not safe to build blind without testing against real government sites) |
| Hash/diff | Content-hash comparison logic (fetch → normalize → hash → compare to `legal_source_registry.content_hash`) | Straightforward once fetch exists; the SCHEMA already has everywhere this would write to |
| AI research / AI red-team | An orchestrated call to a research agent (Perplexity or equivalent) per detected change candidate, producing the same package shape as a manual research request | This session's manual Ohio + upcoming Federal packages ARE this stage today, done by a human-directed request, not an autonomous trigger |
| Monitoring staleness computation | A scheduled check comparing `legal_source_registry.last_checked_at` against `check_frequency`'s window, marking a `monitoring_status` STALE — explicitly NOT unpublishing the rule, just surfacing it | Schema has the raw fields (`last_checked_at`, `check_frequency`); the derived STALE computation and its own status column are not built - straightforward addition once a real fetcher exists to make `last_checked_at` meaningful |
| Automated fixture testing on candidate change | Requiring `CLEARLY_ELIGIBLE`/`CLEARLY_WAITING`/`CLEARLY_EXCLUDED`/`MISSING_INFORMATION`/`COURT_DISCRETION`/boundary-date (day-before/exact/day-after) fixtures before a candidate can reach `NEEDS_REVIEW` | A real, valuable near-term addition — not built this session because no second real package (Federal) has landed yet to prove the fixture shape against a genuinely different jurisdiction from Ohio |
| Member re-check notification | `RULE VERSION UPDATED → identify affected cases (already possible via `record_relief_rule_impact`) → queue re-evaluation availability → member RE-CHECK → new evaluation` | The identify-affected-cases half already works today. The notification half needs the `notification_deliveries` producer wiring (see `NOTIFICATION_EVENT_RECONCILIATION.md`) and an explicit product/legal decision on when it's appropriate to tell a member their case may have changed - not an engineering-only decision |
| Admin Legal Data Review Queue UI | A screen listing `legal_review_queue` rows with jurisdiction/pathway/detected change/diff/research package/red-team findings/schema warnings/tests/reviewer/decision/notes/approval/publication schedule, with APPROVE/REJECT/REQUEST MORE RESEARCH/MARK NO LEGAL CHANGE actions | Explicitly out of scope for Mobile closure — this document is the backend contract that UI will eventually read from (`legal_review_queue` + `legal_change_candidates` + `legal_rule_candidates`), no UI work done |
| 52-jurisdiction coverage dashboard | Backend contract exists (every field named in the capability matrix is derivable from `legal_source_registry` + `record_relief_rules` + `legal_rule_candidates` joined by jurisdiction), no query or UI built | Same reason — Admin UI is out of scope tonight |
| Distributed crawler / browser automation farm | Real infrastructure for fetching hundreds of government sites reliably at scale | Explicitly named as something not to build tonight if it would derail Mobile closure — it would |

## The trust boundary, restated plainly

Automation may watch, research, compare, normalize, schema-validate, and test. **A human must authorize legal
publication.** Every stage above the "HUMAN REVIEW" line in the pipeline diagram can eventually run without a
person in the loop. Nothing below "APPROVAL" ever will, by design — `promote_legal_rule_candidate()` requires a
distinct `reviewed_by` identity already, and publication (`status = 'verified'` on `record_relief_rules`) is a
separate, still entirely manual act that this schema does not touch or automate.
