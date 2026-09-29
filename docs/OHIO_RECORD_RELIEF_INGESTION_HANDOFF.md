# Ohio Record Relief candidate-data ingestion — handoff (Phase A-D result)

**Bottom line: no Ohio rule was imported this pass, and that is the correct, evidence-based outcome — not a
stall.** Two representative pathways were read in full and checked against the real schema and the real
importer. Both surfaced genuine `SCHEMA_LIMITATION`-class gaps that the candidate-data contract explicitly says
to stop on rather than paper over. One real, narrower gap (`court_discretion`) WAS found and safely closed. This
document is the Phase F record of what was done, what was found, and exactly what unblocks Ohio ingestion next.

## Files received

- `docs/research/record-relief/ohio/OHIO_CANDIDATE_PACKAGE_V1.md` (87,471 bytes) — original candidate research.
- `docs/research/record-relief/ohio/OHIO_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md` (95,331 bytes) — adversarial
  red-team review. Per the routing rule, V1.1 controls the candidate interpretation wherever it conflicts with
  V1. Both verified non-zero, readable, with the expected headings, before any of this work started.

Both files are explicitly marked `Production-Status: NOT_APPROVED`, `Auto-Publish: FORBIDDEN`,
`Human-Verification-Required: YES` in their own headers. Nothing in this pass changed that status.

## Phase A/B — what was read and why full normalization stopped where it did

The V1 package covers 12 Ohio relief pathways (adult conviction sealing/expungement, misdemeanor bail-forfeiture
relief, not-guilty/dismissal/no-bill relief, pardon-based sealing, firearm-law-change expungement,
trafficking-related conviction and nonconviction relief, prosecutor-initiated low-level drug relief, juvenile
sealing/expungement, and CQE) across roughly 2,900 lines of structured rule content, each carrying its own
statute citations, waiting-period variants, conditions, and a 5-tier automation classification
(`DETERMINISTIC` / `MEMBER_ASSERTED_FACT` / `CLASSIFICATION_REQUIRED` / `MANUAL_REVIEW_REQUIRED` /
`COURT_DISCRETION`) per condition. Two pathways were read in full as representative samples, cross-checked
against the red-team file's findings for the same statutes, and evaluated against the real
`record_relief_rules` schema and `scripts/lib/record-relief-importer.mjs`:

### Sample 1 — Adult Conviction Sealing (R.C. 2953.32)

This single statute decomposes into **at least four distinct waiting-period variants** depending on offense tier
(one/two F3 convictions: 3 years; F4/F5/misdemeanor: 1 year; R.C. 2921.43 offenses: 7 years; Chapter 2950
registration-related timing: 5 years from registration termination, not from any conviction-adjacent date). That
part fits the schema fine — each variant becomes its own `record_relief_rules` row with a distinct `rule_key`,
all citing the same statute, exactly as the schema already supports (confirmed no schema change needed for this
part).

**Real gap found:** every single variant carries `MANUAL_REVIEW_REQUIRED` conditions that have no representation
in the current engine at all — "F3 count and related-case analysis," "final discharge unclear," "classification
or sentence completion unclear," "Chapter 2950 termination/end-date evidence." The current
`manual_review_flags` mechanism is **not a generic, extensible list** — it is two hardcoded values
(`juvenile`, `out_of_state_conviction`), each wired to one specific `record_relief_cases` boolean column
(`is_juvenile`, `out_of_state_conviction`) in `evaluate_record_relief_case()`'s own logic
(`supabase/migrations/20261001170000_record_relief.sql`, confirmed by reading the function in full this pass).
Adding a new string like `'final_discharge_unclear'` to the CHECK constraint's allowed values would do **nothing
functionally** — the evaluation function has no branch that checks for it, and there is no case-level column to
carry the underlying fact. Real support requires, per new trigger type: a new `record_relief_cases` column (or a
generalized fact-store), an enum addition, and a new branch in the evaluation function. That is a legitimate,
non-trivial architecture change — not something to build hastily as a side effect of a data-import pass.

Also confirmed in the red-team file: `COURT_DISCRETION` applies to every single variant of this rule
("rehabilitation" and "governmental interest" balancing findings, `RT-CONF-002`, already addressed this pass —
see below).

### Sample 2 — Not Guilty / Dismissal / No Bill Relief (R.C. 2953.33)

Simpler on its face (the "Not Guilty" and "Dismissal" waiting rules both have "None stated" waiting periods —
i.e., no calendar wait, just a disposition-date anchor and a no-pending-charges condition), so this was tried as
the more promising import candidate.

**Real gap found, and it is explicitly severity HIGH in the red-team file itself (`OH-RT-012`,
"V1 Must Change Before Candidate Ingestion: YES"):** R.C. 2953.33 supports both sealing and expungement as
statutorily distinct remedies with different conditions, and the red-team's corrected interpretation requires
tracking **three separate concepts** — `requested_relief` (what the person asked for), `statutory_relief_options`
(what the statute actually permits for this fact pattern), and `court_ordered_relief` (what the court actually
granted) — because "a record could be sealing-eligible but not expungement-eligible," and "the court's order may
grant only a subset of requested relief." The current schema's single `remedy` column per rule row can represent
"the statute allows X" (by having separate rule rows per remedy, which the schema already supports fine), but
`record_relief_cases`/`record_relief_evaluations` have no field for what the member actually requested versus
what a court actually ordered — that distinction lives only at the case/evaluation level, and doesn't exist
today. The red-team's own instruction is unambiguous: this specific pathway must not be ingested unchanged.

## Phase A/B — real gap found and closed this pass: `court_discretion`

One finding *was* narrow enough, well-defined enough, and explicitly named as a required field by the red-team
(`RT-CONF-002`, "Adult Court Discretion Is a Hard Boundary," CONFIRMED, engineering treatment: *"Require
`court_discretion: true`. Output `POTENTIALLY_ELIGIBLE` or `MANUAL_REVIEW_REQUIRED`. Do not output
`LEGALLY_ELIGIBLE` or `GUARANTEED_TO_BE_GRANTED`."*) to close safely in this pass:

- **`20261004130000_record_relief_court_discretion.sql`** — additive `court_discretion boolean not null default
  false` column on `record_relief_rules`, and `evaluate_record_relief_case()` updated to append an explicit
  `court_discretion` reason whenever the flag is set. Applied to DEV.
- Confirmed the evaluation engine already never outputs an unqualified "eligible" result for *any* rule —
  `potentially_eligible_now` already always carries "That is not a guarantee: a court decides." universally. So
  the hard safety requirement (never imply guaranteed eligibility) was already structurally satisfied; this
  column is for honest differentiation and future filtering/reporting, exactly matching the research's own named
  field.
- **A real near-miss caught while writing this migration**, worth recording: an early draft guessed the
  evaluation function's parameter name (`p_case_id`) and a materially different body. The real parameter is
  `p_case`, and several other details (the federal branch, the `any_rules` check, the `record_relief_active_rules`
  loop source) were also wrong in the guess. Caught before running anything by reading the actual current
  definition in full — this is exactly the discipline the standing "never guess a function body" rule exists for.
- New regression test in `scripts/test-local-relief.mjs` proves a `court_discretion=true` rule always carries the
  reason even when the outcome is `potentially_eligible_now`. 17/17 Record Relief tests passing (was 16/16).

## Phase C — importer dry-run result

No candidate JSON was run through `importBatch()` this pass, because neither representative pathway passed the
"does this faithfully fit the schema without losing meaning" bar — running a knowingly-incomplete candidate
through VALIDATE would either be rejected for a reason that doesn't reflect the real problem (missing
`manual_review_flags` values that don't exist yet), or would succeed while silently dropping the
requested/statutory/court-ordered distinction the red-team explicitly says is required. Both outcomes would be
worse than not importing at all. The importer's own protections (TEST/prod mismatch, duplicate detection,
overlapping-coverage detection, auto-publish prohibition, all-or-nothing batching, provenance requirements,
effective-date validation, form-scope validation) remain proven via the 16 adversarial fixture-based tests
already in `scripts/test-local-relief-importer.mjs` from the prior pass — nothing about that machinery needed to
change based on reading the real Ohio package.

## Phase D — can the engine represent these categories safely?

Per pathway, based on the two read in full plus the classification taxonomy read for all twelve:

| Pathway | Can the engine represent it today? |
|---|---|
| Adult conviction sealing | **Partially.** Waiting-period arithmetic and statute-tier variants: yes. Manual-review triggers beyond juvenile/out-of-state: no — needs the generic fact-and-trigger architecture described above. Court discretion: yes, as of this pass. |
| Adult conviction expungement | Same shape as sealing (same statute family) — same partial answer. |
| Misdemeanor bail-forfeiture relief | Not read in full this pass. Likely needs the same manual-review-trigger generalization (agreement-fact verification was flagged in the red-team's executive summary). |
| Not-guilty / dismissal / no-bill relief | **No**, per the red-team's own explicit instruction (`OH-RT-012`) — requires the requested/statutory/court-ordered relief distinction to exist first. |
| Pardon-based sealing | Not read in full. Red-team flags a similar "must verify the official grant, not an informal assertion" concern (`OH-RT-013`) — likely needs a document-verification concept the schema doesn't have. |
| Firearm-law-change expungement | Not read this pass. |
| Trafficking-related conviction/nonconviction relief | Not read this pass. Red-team's executive summary flags "two separate statutory routes with different predicates and proof standards" — likely needs the same relief-tracking generalization as `OH-RT-012`. |
| Prosecutor-initiated low-level drug relief | Not read this pass. Red-team flags a subject-offense/subject-offender pairing requirement in its executive summary. |
| Juvenile sealing/expungement | Not read this pass. Red-team explicitly flags that the two routes "require separate statute/version/effective-date objects" and "must not be collapsed into one six-month waiting-period path" — likely needs to be modeled as genuinely separate rules, not a single juvenile flag (which the schema already supports structurally, just not yet done). |
| CQE | Not read this pass. Red-team flags an unsupported-requirement risk and an unverified current form. |

**Honest summary for Sterling:** the engine's core mechanics (versioned rules, waiting-period arithmetic,
exclusions, staleness, provenance, the newly-added court-discretion flag) are sound and were not found wanting
by real research. What's missing is breadth in two specific places: (1) a generalized manual-review-trigger
mechanism (today: 2 hardcoded triggers; Ohio alone plausibly needs 6-10+), and (2) a way to track
requested-vs-statutory-vs-court-ordered relief at the case/evaluation level, not just a single remedy per rule.
Neither is a rewrite — both are additive — but neither should be built by guessing at Ohio's exact needs from
one research pass. The right next step is scoping those two additions deliberately, informed by reading the
remaining 8-10 pathways this handoff didn't get to.

## Phase E — member safety verification

No Ohio candidate data was imported, so there is nothing new to leak — the existing publication gate
(`rr_rules_read_verified` RLS policy: `status = 'verified'` only, confirmed unchanged this pass) continues to
apply exactly as it did before this handoff. This was re-confirmed, not re-built.

## What remains before Ohio can become VERIFIED

1. Read the remaining 8-10 pathways in the V1/V1.1 files with the same rigor as the two samples here.
2. Deliberately scope and build the generalized manual-review-trigger mechanism (new case columns, enum,
   evaluation branches) — informed by the *complete* list of triggers across all 12 pathways, not just the two
   read so far.
3. Deliberately scope and build the requested/statutory/court-ordered relief tracking `OH-RT-012` requires.
4. Only then normalize supported pathways into candidate JSON, dry-run, import as `draft`, and route through
   independent second-person human verification exactly as `RECORD_RELIEF_DATA_OPERATIONS.md` already describes.
5. Ohio remains `draft`/unverified/not member-facing until that full process completes — nothing here changes
   that boundary or shortens it.

## Tests executed this pass

`test-local-relief.mjs` (17/17, +1), full offline suite (47/47). No new importer-specific tests were needed
since no candidate was actually run through the importer — the 16 adversarial importer tests from the prior pass
remain the current coverage for that machinery.
