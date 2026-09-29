# FairPath Record Relief candidate data contract

The formal boundary between FairPath's Research/Data-Ops function (a researcher, a research agent — this
contract is deliberately not written around any specific tool) and Engineering. A submission is **candidate
data** until a human independently verifies it and promotes it to `status = 'verified'`. Nothing on this side of
the boundary can make candidate data become law by itself — see `scripts/lib/record-relief-importer.mjs`, which
implements this contract exactly and has no code path that can ever set `status = 'verified'`.

## Lifecycle

```
RESEARCHED  →  IMPORTED_DRAFT  →  VALIDATED  →  HUMAN_VERIFIED  →  PUBLISHED  →  STALE / SUPERSEDED
(external)     (importer inserts   (importer's    (a second person   (today:       (next_review_at passes,
                status='draft')     own report,     independently      verified IS   or a known law
                                    not a DB          re-checks the    published -    change - re-research,
                                    state)            source and       see note       new rule_version,
                                                       sets status=     below)         old row superseded)
                                                       'verified')
```

`RESEARCHED` and `VALIDATED` are not separate database states today — `RESEARCHED` is the input file itself
(never touches the database), and `VALIDATED` is the importer's own report (`VALID`/`WARNING`/`REJECTED`),
which is a return value, not a row. The database only ever sees `IMPORTED_DRAFT` (`status='draft'`) and
`HUMAN_VERIFIED`/`PUBLISHED` (`status='verified'`, today the same step — see `RECORD_RELIEF_DATA_OPERATIONS.md`
for why splitting those two was judged not worth the risk to the live evaluation engine this pass).

## Submission shape

One JSON object per rule/form/pathway, `kind` discriminated (`"rule"` / `"form"` / `"federal_pathway"`).
The canonical field-by-field shape for `kind: "rule"` and `kind: "form"` is documented in
`RECORD_RELIEF_DATA_OPERATIONS.md`'s "Canonical JSON shape" section — this contract references it rather than
duplicating it, so there is exactly one source of truth for the field list.

### Required for every rule

`kind`, `jurisdiction_code`, `rule_key`, `rule_version`, `remedy`, `title`, `applies_dispositions`,
`applies_offense_classes`, `waiting_anchor`, `source_authority`, `source_url`, `citation_text`, `effective_from`,
`researched_by`.

`source_url` and `citation_text` are required for every **production** submission (`data_origin` unset or
`"production"`); TEST fixtures (`data_origin: "dev_fixture"`) are exempt, matching the existing schema's own
constraint shape.

### Enums (submitting a value outside these lists is REJECTED, never coerced to the nearest valid value)

- `remedy`: `expungement | sealing | set_aside | certificate | automatic_clearing | other`
- `applies_dispositions` / excluded: subset of `conviction | dismissal | acquittal | deferred_adjudication | nolle_prosequi | arrest_no_charge`
- `applies_offense_classes` / excluded: subset of `traffic_infraction | misdemeanor | non_violent_felony | violent_felony | sex_offense | dui_dwi | other`
- `waiting_anchor`: `disposition_date | conviction_date | sentence_completion_date | supervision_completion_date | release_date | latest_completion`
- `source_authority`: `statute | court_rule | government_guidance | test_fixture`
- `manual_review_flags`: subset of `juvenile | out_of_state_conviction` — **if research identifies a manual-review
  trigger not on this list, the importer REJECTS the record and flags `SCHEMA_LIMITATION` rather than forcing it
  into an existing value.** This is a live, explicit gap: real research will very likely surface manual-review
  triggers this two-value list doesn't cover (e.g. "sealed record still visible to law enforcement", "conflicting
  appellate rulings in different districts"). Extending this enum is expected future work, gated on a real
  research package actually needing it — not built speculatively.
- `form_kind`: `official_form | instructions | fee_waiver_form`
- `scope` (forms only): `statewide | county | municipal | court_specific | other`. Non-statewide requires
  `scope_detail` naming the specific county/municipality/court — enforced by both the importer and a DB CHECK
  constraint (`record_relief_forms_scope_detail_required`), so a local form can never be silently presented as
  statewide by omission.

### Date formats

ISO `YYYY-MM-DD` only. `effective_from` more than 1 year in the future is REJECTED (a rule can't take effect
before it's adopted; a modest future-dated grace window is fine, an absurd one is a data-entry error).
`next_review_at` must be after `last_verified_at` when both are present, and more than 3 years out is a WARNING,
not a rejection.

### Source / provenance requirements

A `source_url` alone never establishes authority — **the importer validates structure (well-formed, `https://`,
a `.gov` or court domain), a human independently verifies the content is correct.** These are different jobs and
the importer only claims to do the first one. `citation_text` (the actual statute/rule citation, e.g. "Ohio Rev.
Code § 2953.32") is required separately from the URL for the same reason: a link can rot or point to the wrong
subsection; the citation is what a second human actually checks.

### Manual-review / court-discretion representation

The importer preserves `manual_review_flags` and `staff_notes` exactly as submitted — never drops, summarizes,
or "resolves" them. There is deliberately no single `court_discretion` enum value in the current schema; that
concept is represented today through the combination of `manual_review_flags` (a rule-level signal something
needs a human) and the evaluation engine's `manual_review` outcome (a case-level result — see
`RECORD_RELIEF_CANDIDATE_DATA_CONTRACT.md`'s sibling doc, `RECORD_RELIEF_DATA_OPERATIONS.md`, and the evaluation
function itself). **This is adequate today because nothing in the current rule set needs a finer distinction
than "human review required" — if real research surfaces a case where `manual_review` and true judicial
discretion need to be told apart in the member-facing result (e.g. "FairPath's rule engine has enough
information, but the ultimate grant is still up to the judge" vs. "FairPath doesn't have enough information to
say"), that's a real future schema addition, not something to force into the current two-outcome model.**

### Unknown / ambiguous data handling

Any field not in the canonical shape is REJECTED (`scripts/lib/record-relief-importer.mjs`'s
`rejectUnknownFields`) — never silently dropped, never coerced. If research cannot fit the production schema
without losing meaning, **the correct researcher action is to flag `SCHEMA_LIMITATION` in the submission notes
and stop**, not to simplify the law to fit the importer. The importer's own validation report always names the
exact field and reason for every rejection — never a generic "invalid data" message.

## Example packages

**VALID** — every required field present, enums valid, source is a `.gov` URL, dates sane, no duplicate
`(rule_key, rule_version)`, no overlapping active coverage. Imports as `status='draft'`.

**INVALID** — e.g. `remedy: "pardon_me_please"` (not a real enum value), or `effective_from` missing. REJECTED,
whole batch blocked, nothing written.

**AMBIGUOUS** — e.g. a rule whose waiting period genuinely depends on a formula the current rigid
`waiting_years`/`waiting_months`/`waiting_days` + single `waiting_anchor` columns cannot express (a real,
anticipated future gap — see `RECORD_RELIEF_DATA_OPERATIONS.md`'s schema audit). The correct researcher action:
submit `manual_review_flags` covering it if possible, or flag `SCHEMA_LIMITATION` and describe the actual formula
in `staff_notes` for an engineer to evaluate — never approximate it into the existing single-anchor model.

**SCHEMA_LIMITATION** — the submission itself says so explicitly (a `staff_notes` field starting with
`SCHEMA_LIMITATION:` followed by a description). The importer does not have special handling for this today
beyond preserving the note verbatim (unknown-field rejection would fire if a dedicated field were invented
without updating the schema first) — a real `SCHEMA_LIMITATION` marker deserves its own tracked field once a real
research package actually produces one; not built speculatively against a hypothetical shape.

## What Research/Data-Ops must never do

Set `status`, `data_origin` for anything other than `dev_fixture` during testing, or any DB-internal field not
in the canonical shape — the importer rejects any attempt (`status` and similar are simply not in the allowed
field set, so submitting one is an unknown-field rejection, not a special "nice try" case). Trust a source
because it merely has a URL. Force an ambiguous legal fact into the nearest enum value to make the importer
succeed.

## What Engineering guarantees in return

Every VALID or WARNING-with-override submission either imports cleanly as an inert `draft` row nobody but staff
can see, or is REJECTED with a specific, actionable reason — never a raw database error, never a partial import,
never silent data loss of a `manual_review_flags`/`staff_notes` value the researcher actually set.
