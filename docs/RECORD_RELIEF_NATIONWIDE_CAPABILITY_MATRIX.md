# Record Relief nationwide capability matrix

Read against the real schema (`supabase/migrations/20261001170000_record_relief.sql` and the
`court_discretion` addition from earlier this session), the real evaluation engine
(`evaluate_record_relief_case`), the real importer (`scripts/lib/record-relief-importer.mjs`), and the real
candidate-data contract (`RECORD_RELIEF_CANDIDATE_DATA_CONTRACT.md`), before any schema change for the
nationwide rollout. Only genuine gaps get new schema — nothing here is added because a research field merely
exists.

| Capability | Current representation | Adequate? | Gap | Action |
|---|---|---|---|---|
| Multiple pathways per jurisdiction | `rule_key` + `rule_version`, one row per pathway variant, many rows per `jurisdiction_code` | Yes | — | None |
| State vs federal jurisdiction type | `record_relief_jurisdictions.kind` (`state/district/territory/federal/test`); federal routed to a **separate** table (`record_relief_federal_pathways`) and a separate evaluation branch (`jurisdiction_code = 'US-FED'` never touches the state calculator) | Yes — federal was never modeled as a fake state | — | None |
| Automatic vs petition relief | **Not represented** | No | Real gap | Additive enum column, see below |
| Mandatory vs discretionary relief | `court_discretion boolean` (added this session) distinguishes "court must still decide" from a clean statutory entitlement | Yes | — | None |
| Multiple offense classes | `applies_offense_classes text[]` / `excluded_offense_classes text[]` | Yes | — | None |
| Nested exclusions | Flat exclusion array today; no exclusion-of-an-exclusion representable | Partial | Real but narrow gap — no concrete research case has needed it yet | Defer until a real package needs it (matches the standing "don't guess ahead of real research" discipline) |
| Multiple waiting periods per statute | Each variant is its own row (confirmed this session reading Ohio's 4-tier R.C. 2953.32 sealing) | Yes | — | None |
| Clock-start event | `waiting_anchor` enum (6 values) | Yes for the anchors seen so far | — | None |
| Sentence-component completion | `sentence_completion_date`/`supervision_completion_date`/`release_date` on cases, `latest_completion` anchor | Yes | — | None |
| Fines / fees / restitution | `requires_fines_paid`/`requires_restitution_paid` booleans + `fees jsonb` | Yes | — | None |
| Pending charges | `requires_no_pending_charges` + `pending_charges` on cases | Yes | — | None |
| Conviction-count limitations | `max_other_convictions` | Yes | — | None |
| Multiple-case / related-case logic (e.g. Ohio's F3-count rule) | **Not represented** — no way to say "count these two convictions as one" or "aggregate across cases" | No | Real, confirmed gap (found reading Ohio research this session) | Not built — no concrete second jurisdiction has confirmed the exact shape needed yet; tracked as an open architecture question, not guessed at |
| Court discretion | `court_discretion boolean` (this session) | Yes | — | None |
| Prosecutor consent required | **Not represented** | No | Real gap | Generalize via the manual-review-trigger mechanism below, not a dedicated column (see finding from the Ohio pass: manual-review triggers need to be generic, not hardcoded) |
| Victim objection | **Not represented** | No | Real gap | Same as above |
| Local vs statewide rules | Rules are always jurisdiction-level (state/federal), never county/court-specific | Adequate for now | No confirmed research case needs a county-level RULE (only county-level FORMS, already solved) | Defer |
| Local vs statewide forms | `record_relief_forms.scope`/`scope_detail` (this session) | Yes | — | None |
| effective_from / effective_to | Both exist, CHECK-constrained (`effective_to >= effective_from`) | Yes | — | None |
| Future-effective laws | `effective_from` can be set ahead; `record_relief_active_rules()` already filters `effective_from <= current_date` — a future-dated verified row is invisible until its date arrives, automatically, server-side | Yes | — | None — this already IS the "approve now, go live later, no one has to flip a switch" mechanic the directive asks for |
| Superseded versions | `status = 'superseded'`, `rule_key`+`rule_version` unique, `record_relief_active_rules()` always picks the newest verified version in-window | Yes | — | None |
| Stale rules | `last_verified_at` + derived 1-year warning; `next_review_at` (prior session) | Yes | — | None |
| Citations | `citation_text` required | Yes | — | None |
| Multiple source authorities | `source_authority` enum (`statute/court_rule/government_guidance/test_fixture`) | Yes | — | None |
| Official source URLs | `source_url` required, importer validates `.gov`/court domain | Yes | — | None |
| Forms / revisions / fees | `record_relief_forms` (revision, effective_date, official_source_url) + `fees jsonb` on rules | Yes | — | None |
| Effect of relief (rights restored / not restored) | **Not represented at all** | No | Real, significant gap — directly named by the directive (pardon ≠ expungement, firearm rights ≠ expungement) | New: `record_relief_federal_pathways.pathway_type` enum + `effect_summary`/`rights_not_restored` text fields |
| Member-facing disclaimers | Already universal and hedged (`evaluate_record_relief_case` never emits an unqualified "eligible") | Yes | — | None |
| Candidate → review → published lifecycle | `draft → verified → superseded → retired` on the LIVE table, gated by RLS (`status='verified'` only); importer can only ever write `draft`, never `verified` | Adequate as the **verification/publication** boundary, but has no separate staging space upstream of `draft` for raw research | Real gap: nothing today models "research received" or "normalized" or "needs review" as distinct from "sitting in the live table as an unpublished draft" — that's a weaker isolation guarantee than "never reads from the same table at all" | New, fully separate staging schema (below) — raw/normalized/needs-review candidates never live in `record_relief_rules` at all until a deliberate promotion step |

## New schema this pass (all additive, all local-tested before DEV)

1. **`record_relief_federal_pathways.pathway_type`** — enum (`pardon`, `commutation`, `remission`, `reprieve`,
   `judicial_expungement`, `statutory_relief`, `firearm_rights_restoration`, `other`), plus `effect_summary` and
   `rights_not_restored` text fields, so "pardon ≠ expungement ≠ firearm-rights-restoration" is a structural fact,
   not a naming convention. `is_general_expungement` stays (used today), not removed.
2. **Legal source monitoring registry** (`legal_source_registry`, `legal_source_snapshots`,
   `legal_change_candidates`) — entirely new, entirely separate from the live rules table. This is the
   DISCOVERY/MONITORING layer, not the publication layer.
3. **Staging space for raw research** (`legal_rule_candidates`) — where `RESEARCHED`/`NORMALIZED`/`NEEDS_REVIEW`
   candidates actually live, physically separate from `record_relief_rules`. A `promote_legal_rule_candidate()`
   function is the ONLY path from here into `record_relief_rules` (as `status='draft'`, exactly like the existing
   importer), and it requires the candidate to already be `NEEDS_REVIEW` or later — never `RESEARCHED` alone.
4. **Impact analysis** — a read-only RPC answering "how many stored evaluations used a since-superseded rule,"
   built on data that already exists (`record_relief_evaluations.rule_key`/`rule_version`/`superseded`) — no new
   columns needed, this was already representable and just needed a query.

## What is explicitly NOT built this pass (documented, deferred)

Distributed crawler/fetcher, browser automation, an AI research orchestration service, the Admin Legal Review UI,
Slack/email escalation, and large-scale scheduler infrastructure. See `RECORD_RELIEF_AUTONOMOUS_MONITOR.md` for
the documented future shape of each.
