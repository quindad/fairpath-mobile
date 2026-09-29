# Record Relief data operations — how a legal-data researcher populates real rules

For a future FairPath legal-data researcher (or Sterling, until one exists). Nothing here makes a legal judgment —
this describes process and tooling only.

## Schema audit result

Checked `record_relief_rules`/`record_relief_federal_pathways`/`record_relief_forms` against the full field list a
real production legal-rule needs. Found and closed (`20261003160000_record_relief_review_metadata.sql`) three
real gaps: no `next_review_at` (staleness was only a derived 1-year UI warning, never a queryable target date), no
reviewer identity anywhere (`researched_by`/`reviewed_by`, both opaque identifiers, never raw names), and no
staff-only `staff_notes` field distinct from the member-facing `summary`. Everything else on the requested list —
jurisdiction, jurisdiction level, official authority, source URL, citation, effective/expiration dates, version,
last-reviewed, verification state, offense classification, disposition, waiting-period basis, fines/restitution/
pending-charge/conviction-count rules, exclusions, filing venue/fee, required documents, official forms with their
own URL/revision/verification, and manual-review triggers — was already real and present.

**`staff_notes` is privacy-sensitive and must never be selected into a member-facing response.** No current client
code does this. If a future screen ever needs case data, select columns explicitly — never `select('*')` — on
`record_relief_rules`.

## The verification lifecycle — current state, honestly

The schema's actual `status` enum today is `draft` → `verified` → `superseded` → `retired` (4 states). Sterling's
request described a richer 8-stage lifecycle (draft/researched/review_required/verified/published/stale/
superseded/retired). **That richer lifecycle was NOT implemented this pass** — changing a CHECK constraint enum
that the live evaluation engine gates on (`rr_rules_read_verified` RLS policy: `status = 'verified'`) is a
higher-risk change than I was willing to make under time pressure without being able to exhaustively re-test
every downstream consumer. What exists today is a real 2-gate boundary that already satisfies the core safety
requirement — **a rule existing does not make it visible: only `status = 'verified'` rows are ever read by a
member, enforced by RLS, not application code, verified this session across TEST-C's stale-rule case and TEST-D's
no-rule case.**

**Recommended future work, not done tonight:** split `draft` into `draft`/`researched`/`review_required` for a
real multi-person review workflow (right now `draft` covers all pre-verification work with no way to distinguish
"nobody has looked at this yet" from "a second reviewer is checking it"), and add a `published` state distinct
from `verified` if FairPath ever wants a verified-but-not-yet-live staging step. Use `next_review_at` (added this
pass) to drive an explicit staleness view, separate from the derived 1-year warning that already exists.

## What a researcher actually does today, step by step

1. **Research.** Find the jurisdiction's actual statute/court rule for a given remedy (expungement, sealing, set-
   aside, etc.) from an official `.gov` or official court source. Never a third-party blog, never an AI-generated
   summary treated as authority.
2. **Draft.** Insert a `record_relief_rules` row with `status = 'draft'`, filling every field the statute actually
   specifies. Leave `last_verified_at` null — the schema itself refuses `status = 'verified'` with a null
   `last_verified_at` (existing CHECK constraint). Set `researched_by` to your own opaque identifier. Use
   `staff_notes` for anything that needs a second reviewer's attention (ambiguous wording, a provision you're
   unsure how to encode, a conflicting secondary source).
3. **Second review.** A second person reads the draft against the same official source independently, not just
   proofreading the first person's summary. Sets `reviewed_by`.
4. **Verify.** Only after independent second review, update `status = 'verified'` and set `last_verified_at` to
   today and `next_review_at` to a reasonable future check-in date (the schema doesn't prescribe an interval —
   fast-changing jurisdictions need shorter intervals than stable ones).
5. **Publish.** Today, `verified` IS published (RLS gates directly on it) — there is no separate publish step.
   Members can see it the moment it's verified.
6. **Monitor.** When `next_review_at` passes, or a known law change happens, re-research and create a NEW row
   with an incremented `rule_version` (never edit a verified row in place — `rule_key`+`rule_version` is unique,
   and the evaluation engine's history log already depends on rule versions being immutable once evaluated
   against).
7. **Supersede.** When the new version is verified, set the OLD version's `status = 'superseded'`. The evaluation
   engine already correctly picks only the newest verified version whose effective window covers today
   (`record_relief_active_rules()`), and already flags `rule_changed` in a case's history when the rule backing
   an old evaluation gets superseded (verified in this project's engine tests).
8. **Retire.** If a remedy is repealed entirely (no replacement rule), set `status = 'retired'`. A retired rule is
   never evaluated (same RLS gate as draft/superseded — only `verified` rows are read).

## TEST vs. real data — how they stay separate

Already enforced at the database level, not just convention: `data_origin` (`production`/`dev_fixture`) and
`fixture_set` are linked by a CHECK constraint (`(data_origin = 'dev_fixture') = (fixture_set is not null)`) — a
row cannot claim to be a dev fixture without a fixture_set, and cannot have a fixture_set without claiming to be
one. `record_relief_jurisdictions.kind` has an explicit `'test'` value distinct from `'state'`/`'district'`/
`'territory'`/`'federal'`. The seed script's own dev-target guard additionally refuses to run at all outside a
confirmed DEV target. A researcher entering real data should never set `data_origin = 'dev_fixture'`, and the
existing constraint makes that combination structurally impossible to get backwards by accident.

## Structured import format — concrete design (not yet implemented as code)

Not implemented as executable code this pass (a shell-tooling outage made that unsafe to attempt blind), but
specified concretely enough to build directly from. This is the exact contract, field by field, matching what
already exists in `record_relief_rules` plus the metadata added this session.

### Canonical JSON shape (one rule)

```json
{
  "kind": "rule",
  "jurisdiction_code": "OH",
  "rule_key": "oh-misdemeanor-expungement",
  "rule_version": 1,
  "remedy": "expungement",
  "title": "Misdemeanor expungement",
  "summary": "Member-facing plain-language explanation.",
  "applies_dispositions": ["conviction"],
  "applies_offense_classes": ["misdemeanor"],
  "excluded_offense_classes": ["dui_dwi"],
  "waiting_years": 3, "waiting_months": 0, "waiting_days": 0,
  "waiting_anchor": "sentence_completion_date",
  "requires_fines_paid": true,
  "requires_restitution_paid": false,
  "requires_no_pending_charges": true,
  "max_other_convictions": 1,
  "manual_review_flags": ["juvenile", "out_of_state_conviction"],
  "fees": { "court_fee_cents": 5000, "fee_waiver_available": true },
  "filing": { "court_type": "Court of Common Pleas", "where_text": "...", "instructions_text": "..." },
  "required_documents": [{ "key": "id", "label": "Government ID" }],
  "steps": [{ "key": "gather", "title": "Gather your documents" }],
  "form_keys": ["oh-petition-expungement"],
  "source_authority": "statute",
  "source_url": "https://codes.ohio.gov/...",
  "citation_text": "Ohio Rev. Code § 2953.32",
  "effective_from": "2024-01-01",
  "effective_to": null,
  "researched_by": "researcher-opaque-id-1",
  "next_review_at": "2027-01-01",
  "staff_notes": "Optional internal notes; never member-facing."
}
```

A second `"kind": "form"` shape mirrors `record_relief_forms`' columns; a third `"kind": "federal_pathway"`
mirrors `record_relief_federal_pathways`. All three share the same importer and validation pipeline described
below — the importer dispatches on `kind`.

### Importer modes

- **VALIDATE** — checks the input against every rule below, returns `VALID` / `WARNING` / `REJECTED` with a
  reasoned message per field. Touches no database rows.
- **DRY RUN** — VALIDATE, plus shows exactly what row would be inserted/would conflict, still touches nothing.
- **IMPORT** — only runs if VALIDATE returned `VALID` (warnings may be allowed through with an explicit
  `--allow-warnings` flag; `REJECTED` never proceeds under any flag). Inserts as `status = 'draft'` ALWAYS —
  the importer can never set `verified` itself, no matter what the input claims; that stays a deliberate, separate
  step a human takes through the review process.

### Validation rules (REJECTED conditions — any one fails the whole batch, nothing partially imports)

| Check | Rejection condition |
|---|---|
| Jurisdiction exists | `jurisdiction_code` not found in `record_relief_jurisdictions` |
| Jurisdiction kind matches intent | Importing a `kind: 'rule'` with `data_origin: 'production'` intent against a jurisdiction whose `kind = 'test'` (or vice versa) — this is the exact "TEST/real mismatch" Sterling named |
| Official source present | `source_url` missing or empty for a production import (TEST fixtures are exempt, matching existing schema behavior) |
| Source URL well-formed | `source_url` fails a strict URL parse, or isn't `https://`, or isn't a `.gov`/known-official-court domain for a first pass (a stricter allowlist is a P2 refinement, not required for V1 rejection) |
| Citation present | `citation_text` empty for a production import |
| Effective date sane | `effective_from` unparseable, or more than 1 year in the future (a rule can't take effect before it's actually adopted; a modest future-dated grace window is fine, an absurd one is a data-entry error) |
| Waiting period sane | Any of `waiting_years`/`waiting_months`/`waiting_days` negative, or all three simultaneously implying a period the schema's own CHECK bounds already reject (`waiting_years` outside 0-50, etc.) — the importer should catch this BEFORE the database does, with a human-readable message instead of a raw constraint-violation error |
| Disposition/offense values valid | Any value outside the existing enum arrays (`applies_dispositions`, `applies_offense_classes`, `excluded_offense_classes`) |
| Conviction bounds sane | `max_other_convictions` negative or absurdly large (matches the existing 0-50 CHECK) |
| Fee sane | `fees.court_fee_cents` negative |
| Duplicate active version | An existing `(rule_key, rule_version)` pair already exists (matches the schema's own UNIQUE constraint — again, the importer should give a clear message instead of surfacing a raw constraint error) |
| Duplicate active rule for the same coverage | A different `rule_key` already covers the same `(jurisdiction_code, remedy, applies_offense_classes)` combination with an overlapping effective window and `status = 'verified'` — this is a process-level check the database schema does NOT enforce alone (two different rules could otherwise both claim to be the current answer for the same case) |
| Official form without provenance | A `kind: 'form'` import with `kind: 'official_form'` but missing `official_source_url`/`revision`/`effective_date` — this exactly matches the existing DB CHECK (`kind <> 'official_form' or status <> 'verified' or (...)`), surfaced earlier and more clearly by the importer |
| Second-reviewer distinct from researcher | For any import attempting to set `reviewed_by`, it must differ from `researched_by` — the database can't enforce this alone (both are just opaque text columns), so the importer must |
| next_review_at after last_verified_at | If both are present, `next_review_at` must be later — a database CHECK doesn't exist for this today, so the importer is the only enforcement point until one is added |

### WARNING conditions (importer proceeds only with an explicit override flag)

- `next_review_at` more than 3 years out (unusually long for a legal-data recheck interval — not wrong, but
  worth a human's attention).
- `manual_review_flags` empty AND the offense/disposition combination looks unusual (e.g. `sex_offense` with no
  flags) — the importer can suggest but never force a flag, since that's a legal judgment call, not the
  importer's to make.
- `staff_notes` empty on a first-time import — not required, but a second reviewer likely wants SOME context.

### What the importer must NEVER do

- Never set `status = 'verified'` itself.
- Never guess a missing required field from an LLM or any inference — every required field must come from the
  input file, or the row is rejected.
- Never partially import a batch — if importing 10 rules and row 7 fails validation, 0 rows are written, not 6.
- Never overwrite an existing `verified` row — a new version is always a NEW row with an incremented
  `rule_version`, never an in-place edit (matches the existing immutability the evaluation history already
  depends on).
