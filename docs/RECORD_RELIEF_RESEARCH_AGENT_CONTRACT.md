# Record Relief research agent contract

The permanent interface between a research process (Perplexity, a future automated agent, or a human FairPath
researcher — this contract is deliberately tool-agnostic) and FairPath Engineering. Read this alongside
`RECORD_RELIEF_CANDIDATE_DATA_CONTRACT.md` (the field-by-field JSON shape) — this document covers process,
files, and directory convention; that one covers the data shape itself.

## Directory convention

```
docs/research/record-relief/
  national/
    NATIONAL_RECORD_RELIEF_RESEARCH_MANIFEST.md
  federal/
    FEDERAL_CANDIDATE_PACKAGE_V1.md
    FEDERAL_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md
    FEDERAL_CANDIDATE_NORMALIZED.json      (produced by engineering, not research - see below)
    FEDERAL_IMPORT_REPORT.md               (produced by engineering, not research - see below)
  alabama/
    ALABAMA_CANDIDATE_PACKAGE_V1.md
    ALABAMA_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md
    ...
  ohio/
    OHIO_CANDIDATE_PACKAGE_V1.md
    OHIO_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md
  ...
  wyoming/
  district-of-columbia/
```

One directory per jurisdiction, named in lowercase-kebab-case matching the jurisdiction's common name (not its
`record_relief_jurisdictions.code`, which stays the engineering-internal identifier). `federal/` and `national/`
are siblings of the state directories, not children of any state.

**Hard rule: files are never overwritten in place.** V1 stays even after V1.1 exists. A red-team report is never
overwritten by a later normalized JSON. Each new version gets its own filename
(`_V1`, `_V1_1_RED_TEAM`, `_V2` if a full re-research happens later). This preserves the raw research trail
permanently, independent of whatever the database ends up doing with it.

## What a research package must contain

- `<JURISDICTION>_CANDIDATE_PACKAGE_V<N>.md` — the primary research artifact. Markdown, human-readable, with the
  structured per-pathway sections already demonstrated in the Ohio package (rule identifier, jurisdiction,
  research version, effective dates, primary authority citations, official source URLs, retrieved/verified
  dates, confidence, waiting-period rules with clock-start events, conditions, automation classification per
  condition, known ambiguities).
- `<JURISDICTION>_CANDIDATE_PACKAGE_V<N>_RED_TEAM.md` — an adversarial second pass over the same package,
  produced separately, that CONFIRMS, CORRECTS, NARROWS, or flags AMBIGUOUS/CONFLICTING/UNSUPPORTED/REQUIRES
  MANUAL REVIEW for every claim in the primary package it reviews, with its own citations. **The red-team
  report controls the candidate interpretation wherever it conflicts with the primary package** — this is a
  standing rule, not per-request.

## Required metadata (every package header)

`Package-Type`, `Jurisdiction`, `Jurisdiction-Code` (the `record_relief_jurisdictions.code` this maps to, e.g.
`US-OH`, `US-FED` — never invent a new code), `Version`, `Production-Status` (always `NOT_APPROVED` from
research — research never sets its own approval status), `Auto-Publish` (always `FORBIDDEN`),
`Human-Verification-Required` (always `YES`), `Research-Status`, `Research-Date`, `Last-Verified-Date`,
`Source-Standard`, `Default-Member-Facing-Outcome` (always a hedged value — `POTENTIALLY_ELIGIBLE`, never
`ELIGIBLE`), `Prohibited-Member-Facing-Outcomes` (must always list at minimum `LEGALLY_ELIGIBLE`,
`GUARANTEED_TO_BE_GRANTED`, `RECORD_ERASED_EVERYWHERE`).

## Source hierarchy (what counts as authority)

1. **Primary statute** — the actual codified law (e.g. Ohio Revised Code, a state's own statutes-at-large).
2. **Primary court** — court rules, published opinions directly interpreting the relief mechanism.
3. **Primary agency** — the administering agency's official guidance (a state AG, a state court administrator,
   BCI, DOJ pardon attorney, etc.) — supports process/forms/administrative detail, not statutory eligibility
   rules where a primary statute exists and conflicts.
4. **Primary form** — an official government-hosted form itself.
5. **Secondary research** — legal-aid explainers, bar association guides, news coverage. May help LOCATE
   primary authority. Never candidate rule authority on its own where primary authority exists or could be
   found.

Local (county/municipal/court-specific) sources are never treated as statewide authority, and must be labeled
as local in the package (mirrors `record_relief_forms.scope`/`scope_detail` in the schema).

## Confidence labels

Use the existing vocabulary already demonstrated in the Ohio package (e.g.
`HIGH_FOR_STATUTORY_TEXT_MEDIUM_FOR_CASE_APPLICATION`) — a compound label naming what part of the claim is
solid versus uncertain, never a single flat "confidence: high/medium/low" that hides which specific part is
shaky.

## Automation classification (required per condition, not per pathway)

Every condition within a pathway must be tagged with one or more of: `DETERMINISTIC`, `MEMBER_ASSERTED_FACT`,
`CLASSIFICATION_REQUIRED`, `MANUAL_REVIEW_REQUIRED`, `COURT_DISCRETION` — exactly the taxonomy already used in
the Ohio package and read into the engine's `court_discretion` field this session. A pathway with ANY
`COURT_DISCRETION` condition must set `court_discretion: true` in its eventual candidate JSON (see the
candidate-data contract).

## Schema-gap reporting

If a legal distinction cannot be represented without losing meaning, the package must say so explicitly —
`SCHEMA_LIMITATION: <description>` — rather than force it into the nearest existing field. Two known,
already-confirmed gap categories from the Ohio pass (see `RECORD_RELIEF_NATIONWIDE_CAPABILITY_MATRIX.md`):
multi-case/related-conviction aggregation logic, and non-hardcoded manual-review triggers beyond
`juvenile`/`out_of_state_conviction`. Naming one of these (or a new one) is not a failure — it's the correct
outcome, and it routes the candidate to `schema_blocked = true` in staging rather than a forced, inaccurate
import.

## Effective-date handling

`effective_from` in ISO format, required. `effective_from` more than 1 year in the future is rejected by the
importer as an implausible data-entry error — a genuinely passed-but-not-yet-effective law (e.g. approved
September 2026, effective January 2027) is exactly the shape the engine already supports natively (see
"future-effective laws" in the capability matrix) and should just be submitted with its real future date, well
within a year, not worked around.

## Provenance requirements

Every non-TEST candidate needs: `source_authority`, `source_url` (`.gov` or an official court domain — the
importer structurally rejects anything else), `citation_text` (the actual statute/rule citation, never just the
URL), `Retrieved-Date`, `Last-Verified-Date`, and a named `researched_by` identifier. A second, distinct
`reviewed_by` identity is required before anything can be promoted — a candidate can never verify itself (this
is a database-enforced CHECK, not just a convention).

## What research must NEVER do

Set `status: verified` or any equivalent publication field — that field does not exist in the candidate JSON
shape at all; submitting one is an unknown-field rejection. Claim a source establishes authority merely because
it has a URL. Simplify an ambiguous, conflicting, or unsupported legal question to make an import succeed —
flag it (`AMBIGUOUS`, `CONFLICTING`, `UNSUPPORTED`, `REQUIRES MANUAL REVIEW`, `SCHEMA_LIMITATION`) instead.
Collapse legally distinct relief mechanisms into one label — a pardon is not an expungement, firearm-rights
restoration is not a pardon, commutation is not a pardon, sealing is not destruction. Federal packages
specifically must tag each pathway's `pathway_type` from the schema's own enum
(`pardon`/`commutation`/`remission`/`reprieve`/`judicial_expungement`/`statutory_relief`/
`firearm_rights_restoration`/`other`) rather than calling everything "expungement."

## What happens after a package lands

Per `docs/OHIO_RECORD_RELIEF_INGESTION_HANDOFF.md`'s established pattern: Engineering reads both files in full,
builds a discrepancy matrix (V1 claim → V1.1 finding → disposition), normalizes what's supported into the
candidate-data-contract JSON shape, stages it in `legal_rule_candidates` (never directly in
`record_relief_rules`), runs it through the importer's validation, and documents the result in an
`_IMPORT_REPORT.md` alongside the source files. Nothing here is automatic — every step is a deliberate
engineering action, logged, reviewable, and reversible up until a human explicitly flips a promoted row's
`status` to `verified`.
