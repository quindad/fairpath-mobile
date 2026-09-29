# Federal V1 → V1.1 discrepancy matrix

Built by reading both `FEDERAL_CANDIDATE_PACKAGE_V1.md` and `FEDERAL_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md` in full
from disk (not from prior chat summaries). Per the standing routing rule, **V1.1 controls the candidate
interpretation wherever it conflicts with V1** — but V1.1 controlling candidate-research reconciliation is not
human verification and is not production approval. Every row below still ends in `PUBLICATION BLOCKED: YES`.

13 distinct pathways identified in V1 (the "Fees" row in the table below is a cross-cutting correction, not a
14th pathway — corrected after building the normalized JSON and finding the count was actually 13). 16 numbered
red-team findings (4 CONFIRMED without correction,
12 CORRECTED/NARROWED, several BLOCKER severity) plus 3 additional CONFLICTING/AMBIGUOUS authority sections.

| # | Pathway | V1 claim (summary) | V1.1 finding | Status | Severity | Controlling interpretation | Automation class | Deterministic eval safe? | Member display safe? | Publication blocked? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Presidential Pardon | Pardon is clemency, not expungement; DOJ 5-year petition guidance | FED-RT-CONF-001 + FED-RT-001, FED-RT-002, FED-RT-003 | CONFIRMED core distinction; CORRECTED on waiting period and effect scope | BLOCKER (waiting period, jurisdiction subtype) | `pathway_type=pardon`; 5-year figure is `petition_guidance_milestone` not a legal eligibility date; jurisdiction subtype (US Code/D.C./CFR/UCMJ) required before routing; effect is grant-document-specific, never assume full relief | MANUAL_REVIEW_REQUIRED, EXECUTIVE_DISCRETION, CLASSIFICATION_REQUIRED | NO — informational only | YES, with mandatory hedged language | YES |
| 2 | Commutation of Sentence | Reduces sentence, doesn't erase conviction | FED-RT-CONF-002 | CONFIRMED | — | `pathway_type=commutation`; sentence status stored separately from conviction status; never implies innocence or civil-disability removal | MANUAL_REVIEW_REQUIRED, EXECUTIVE_DISCRETION | NO | YES, with hedged language | YES |
| 3 | Remission of Fine/Restitution | Executive relief for unpaid financial penalties | FED-RT-004 | CONFIRMED AND NARROWED | HIGH | `pathway_type=remission`; must separate fine/restitution/forfeiture/special-assessment, paid vs. unpaid; never infers refund of amounts already paid | MANUAL_REVIEW_REQUIRED, EXECUTIVE_DISCRETION | NO | YES, with hedged language | YES |
| 4 | Reprieve | Temporary delay of sentence enforcement | (not separately red-team-numbered; treated as part of clemency family) | LOW_CONFIDENCE_MANUAL_REVIEW (V1's own classification, unchallenged) | — | `pathway_type=reprieve`; never implies seal/expunge/vacate/dismiss | MANUAL_REVIEW_REQUIRED | NO | YES, minimal — manual legal review only | YES |
| 5 | Categorical Marijuana Pardon | Covers qualifying simple-possession offenses on/before 2023-12-22 | FED-RT-013 | CONFIRMED AND NARROWED | HIGH | `pathway_type=pardon`; requires exact code authority, conduct, date, jurisdiction subtype, citizenship/lawful-presence facts; output `POTENTIALLY_COVERED_BY_CATEGORICAL_PARDON_REVIEW`, never `EXPUNGED`/`SEALED`/`RECORD_CLEARED`; no keyword matching on "marijuana" | CLASSIFICATION_REQUIRED, MEMBER_ASSERTED_FACT, MANUAL_REVIEW_REQUIRED | NO | YES, with hedged language, never "expunged" | YES |
| 6 | 18 U.S.C. § 3607(a) Pre-Judgment Probation | Original-case disposition mechanism, not retroactive relief | FED-RT-CONF-... / FED-RT-005 | NARROWED | HIGH | `pathway_type=statutory_relief` (pre-judgment, not post-conviction); a member with an ordinary standing conviction must get `RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED`, never routed here | CLASSIFICATION_REQUIRED, COURT_DISCRETION, MANUAL_REVIEW_REQUIRED | NO | YES, narrow informational only | YES |
| 7 | 18 U.S.C. § 3607(c) Expungement | Court-ordered expungement for qualifying under-21 § 3607(a) recipients | FED-RT-CONF-003 + FED-RT-006, FED-RT-007 | CONFIRMED core rule; CORRECTED on procedure and record-effect scope | HIGH | `pathway_type=judicial_expungement`; real statutory expungement exists (disproves "federal convictions can never be expunged"), but requires verified § 3607(a) disposition + age<21 + court order; local federal-district procedure not established; DOJ nonpublic retained record persists | CLASSIFICATION_REQUIRED, MANUAL_REVIEW_REQUIRED, COURT_ORDER_REQUIRED | NO (no nationwide waiting-period/form to compute) | YES, with explicit "official records only, DOJ retains a nonpublic record" caveat | YES |
| 8 | 21 U.S.C. § 844a Civil-Penalty Expungement | 3-year statutory expungement after civil-penalty disposition | FED-RT-008, FED-RT-015 | CONFIRMED AND NARROWED | HIGH | `pathway_type=statutory_relief`; 3-year clock IS deterministic once assessment/disposition date + full conviction history are verified, but agency procedure/form/fee are NOT verified — no self-service filing guidance | DETERMINISTIC (arithmetic only), CLASSIFICATION_REQUIRED, MEMBER_ASSERTED_FACT, MANUAL_REVIEW_REQUIRED, AGENCY_DETERMINATION_REQUIRED | PARTIAL — date arithmetic only, never a full eligibility conclusion | YES, with agency-procedure-unverified caveat | YES |
| 9 | Federal Juvenile Record Confidentiality (§ 5038) | Confidentiality with authorized-disclosure exceptions | FED-RT-CONF-004 + FED-RT-009 | CONFIRMED; CORRECTED on applicability | HIGH | `pathway_type=other` (confidentiality is not expungement, not a "pathway type" in the pardon/statutory sense — see Schema Consequence); requires classifying `proceeding_type` (juvenile delinquency vs. adult prosecution) before ANY application; never applied to adult-prosecuted users | CLASSIFICATION_REQUIRED, MANUAL_REVIEW_REQUIRED | NO | YES, explicit "this is confidentiality, not expungement or destruction" | YES |
| 10 | Judicial Expungement/Sealing for Invalid/Unlawful Arrest or Conviction | Limited federal equitable jurisdiction, circuit-dependent | FED-RT-010 | CORRECTED FOR SCOPE AND CONFLICT | BLOCKER | No general nationwide rule exists in either direction — V1's circuit citations do NOT establish a usable nationwide rule. `circuit_law_required=true`, `federal_district_required=true`; default output `RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED` always | CONFLICTING_AUTHORITY, MANUAL_REVIEW_REQUIRED, CIRCUIT_LAW_REQUIRED | NO, absolutely not — must never produce a flat eligibility answer | YES, manual-review-only framing | YES |
| 11 | Vacatur, Correction, Resentencing, Invalid-Conviction Relief | Taxonomy/referral node, not a general rule | FED-RT-011 | CONFIRMED AS BOUNDARY; UNSUPPORTED FOR GENERAL RULE | HIGH | Remains a referral taxonomy node only — never a self-service filing pathway; separate future research package required per mechanism (§ 2255, Rule 35, Rule 36, compassionate release, appeal reversal are all legally distinct) | UNSUPPORTED, MANUAL_REVIEW_REQUIRED | NO | YES, referral-only, no eligibility claim of any kind | YES |
| 12 | Firearm Disability Relief (18 U.S.C. § 925(c)) | Statutory AG-application route; operational availability unverified | FED-RT-012 | NARROWED | BLOCKER | Statute exists; agency processing/appropriations/current form are NOT verified. `self_service_filing_permitted=false`; never implies restored firearm rights; not record clearing | LOW_CONFIDENCE_MANUAL_REVIEW, AGENCY_DETERMINATION_REQUIRED | NO | YES, explicit "not currently verified as operational" | YES |
| 13 | Federal Youth Corrections Act Set-Aside (historical) | Repealed 1987-01-01 | FED-RT-016 | CONFIRMED AND NARROWED | MEDIUM | `pathway_type=other`, `status=HISTORICAL_ONLY`; never offered as current relief; preserved only for members presenting historical certificates | MANUAL_REVIEW_REQUIRED | NO | YES, explicitly labeled historical/repealed | YES |
| 14 | Fees (cross-cutting) | "No fee identified" across several pathways | FED-RT-014 | CONFIRMED AND NARROWED | MEDIUM | `NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE` must never serialize to `$0`/`FREE`/`NO_FEE_GUARANTEED` | — | N/A | YES, exact source-qualified wording only | YES |

## Cross-cutting corrections applying to every pathway above

- **Jurisdiction subtype is mandatory, never inferred.** United States Code / D.C. Code / Code of Federal
  Regulations / Uniform Code of Military Justice must be explicit; unknown subtype routes to
  `MANUAL_REVIEW_REQUIRED`, never a default guess. (FED-RT-002, BLOCKER)
- **Record effect is pathway-specific and grant/order-specific, never generic.** No candidate rule may output a
  bare "record cleared" — private background-check database effect defaults to `UNKNOWN_NOT_PROMISED` unless a
  specific source supports otherwise.
- **"No fee identified" is not "free."** Applies to every pathway with a fee field.
- **All 14 pathways remain outside the deterministic waiting-period calculator** — confirmed by reading the real
  evaluation engine (`evaluate_record_relief_case()` in `20261001170000_record_relief.sql`): federal cases are
  already routed to a `federal_separate` outcome that never runs the state calculator, and federal pathways are
  already pure informational reference data listed alongside that outcome, never a computed eligibility result.
  **This means the single most dangerous failure mode the red-team warns against — the engine computing a false
  "ELIGIBLE" for a discretionary or circuit-dependent federal question — was already structurally impossible
  before this pathway even existed.** The real work this pass was making sure the DATA MODEL (jurisdiction
  subtype, pathway type, effect profile) matches that safety, not the evaluation logic itself.

## Schema consequence summary

Two real gaps found and closed this pass (see the migration commit for detail):
`record_relief_federal_pathways.jurisdiction_subtype` (new column) and wiring `pathway_type`/`effect_summary`/
`rights_not_restored` (added in a prior pass, never actually read by the member-facing query until now) into
`get_record_relief_case_detail()`. No other schema changes were required — the existing `record_relief_rules`
architecture was never going to be asked to represent federal pathways (they were already correctly modeled as a
separate table with a separate evaluation branch), so the "don't force federal into the state-rule shape" concern
was already satisfied by the pre-existing design, not something this pass had to build from scratch.

## Not built this pass, and why

`§ 5038` juvenile confidentiality doesn't cleanly fit any existing `pathway_type` value (it's neither a form of
clemency nor a form of expungement — it's an access-control rule). Rather than force it into `judicial_expungement`
or invent a narrow one-off enum value for a single pathway, it's normalized as `pathway_type=other` with its real
distinction carried entirely in `effect_summary`/`rights_not_restored` free text. If a second jurisdiction's
research surfaces the same "confidentiality, not expungement" shape, that's the trigger to add a dedicated enum
value — not guessed at from one federal pathway alone.
