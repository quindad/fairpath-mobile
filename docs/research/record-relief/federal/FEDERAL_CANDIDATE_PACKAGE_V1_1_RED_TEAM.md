DOCUMENT — FEDERAL_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md

```markdown
FEDERAL RECORD RELIEF — CANDIDATE PACKAGE V1.1 RED-TEAM REVIEW

Package-Type: CANDIDATE_RESEARCH_RED_TEAM
Jurisdiction: Federal
Jurisdiction-Code: US-FED
Version: 1.1
Supersedes-For-Conflict-Purposes: 1.0
Production-Status: NOT_APPROVED
Auto-Publish: FORBIDDEN
Human-Verification-Required: YES
Research-Status: ADVERSARIAL_CANDIDATE_RESEARCH_REVIEW
Research-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Controlling-Candidate-Conflict-Rule: V1_1_CONTROLS_FOR_CANDIDATE_RESEARCH_CONFLICT_RESOLUTION_ONLY
Publication-Authority: NONE
Candidate-Package-Under-Review: FEDERAL_CANDIDATE_PACKAGE_V1.md

# Purpose

This document is the independent adversarial review of `FEDERAL_CANDIDATE_PACKAGE_V1.md`.

It does not convert federal candidate research into production law. It does not authorize FairPath publication, automated eligibility decisions, filing guidance, form linking, or member-facing legal conclusions.

If V1 and V1.1 conflict:

- V1.1 controls for candidate-research conflict resolution.
- V1 remains preserved as historical candidate research evidence.
- V1.1 does not itself establish verified law.
- All federal rules remain subject to engineering validation, source validation, stale-rule review, human legal-data verification, and publication-gate approval.

# Executive Red-Team Findings

Federal Candidate Package V1 correctly recognized that federal record relief cannot be modeled as a state-style generic expungement system. The package appropriately separated presidential pardon, commutation, remission, statutory drug-possession expungement, federal juvenile confidentiality, judicial expungement limits, firearm-disability relief, and invalid-conviction relief.

However, V1 contains material risks if imported without the V1.1 corrections.

The most significant findings are:

- DOJ’s five-year pardon timing is clemency petition guidance, not a state-style statutory expungement waiting period or a guarantee of pardon eligibility.
- Federal, D.C. Code, Uniform Code of Military Justice, and Code of Federal Regulations matters must not be collapsed into a single “federal conviction” category.
- A pardon’s effects are grant-document-specific; the engine must not assume every pardon remits all sentence components, restitution, fines, or disabilities.
- Commutation and remission must remain distinct from pardon, expungement, sealing, invalidation, and firearm restoration.
- 18 U.S.C. § 3607(a) is an original case disposition mechanism, not a routine retrospective post-conviction record-clearing remedy.
- 18 U.S.C. § 3607(c) is a narrow statutory expungement route and requires court-specific procedure research after identifying the relevant federal district.
- 21 U.S.C. § 844a is a civil-penalty pathway, not a general criminal conviction pathway, and the present agency application workflow is not verified.
- Federal juvenile confidentiality under 18 U.S.C. § 5038 does not apply automatically to every person who was under 18 in a federal case; the proceeding type must be classified.
- No national automated rule can safely determine judicial expungement/sealing availability because federal jurisdiction and precedent vary by circuit, district, legal basis, and procedural posture.
- 18 U.S.C. § 925(c) is firearm-disability relief, not record clearing. Current operational availability, forms, agency procedure, and appropriations implementation were not verified.
- The categorical marijuana pardon is not expungement and must be matched to code, conduct, date, jurisdiction, and citizenship/lawful-presence facts.
- “No fee identified” must not become “guaranteed free.”
- Historical Federal Youth Corrections Act set-aside relief is repealed and cannot be offered as current relief.
- Federal record effects must be pathway-specific and order-specific. FairPath must not promise deletion from private background-check databases, PACER, FBI, DOJ, court, state, or other systems absent specific authority.

# Red-Team Status Definitions

## CONFIRMED

The V1 claim is supported by current official primary authority as stated.

## CORRECTED

The V1 claim was materially inaccurate, incomplete, or unsafe and must be changed.

## NARROWED

The V1 claim was directionally correct but must be limited to its actual legal scope.

## AMBIGUOUS

Primary authority does not clearly resolve the operational question in a way safe for deterministic implementation.

## CONFLICTING

Authority differs by circuit, federal district, legal question, agency implementation, statutory version, or source hierarchy.

## UNSUPPORTED

The candidate package does not contain enough official authority to create a general rule.

## REQUIRES MANUAL REVIEW

The pathway requires individual legal, factual, procedural, jurisdictional, executive, agency, or court review.

# V1 Claims Confirmed

## FED-RT-CONF-001 — Presidential Pardon Is Not Expungement

V1 Claim/Rule Being Reviewed:
- A presidential pardon is executive clemency and does not erase or expunge a conviction.

Red-Team Finding:
- CONFIRMED.

Primary Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Official Sources:
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960581/dl

Supporting Official Material:
- DOJ pardon application materials state that pardon cannot erase or expunge conviction.
- DOJ FAQ distinguishes pardon from commutation and describes pardon as forgiveness.

Corrected Candidate Interpretation:
- A presidential pardon must have:
  - `pathway_type: executive_clemency_pardon`
  - `record_effect_profile: pardon_not_expungement`
  - `court_order_required_for_expungement_effect: false`
  - `private_background_database_effect: unknown_not_promised`

Why It Matters to Eligibility Engine:
- FairPath must not tell a member that a pardon clears, destroys, seals, or removes conviction records from court, DOJ, FBI, PACER, state, private, or other databases.

Recommended Engineering Treatment:
- Do not map pardon to generic `expungement`.
- Do not map pardon to generic `record_cleared`.
- Require grant document/proclamation before recording any pardon outcome.
- Preserve conditions and warrant-specific scope.

Automation Classification:
- MANUAL_REVIEW_REQUIRED.
- EXECUTIVE_DISCRETION.
- CLASSIFICATION_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- NO for core distinction.
- YES if any generic “record cleared” or “record erased” effect can be generated.

## FED-RT-CONF-002 — Commutation Does Not Change Conviction Status

V1 Claim/Rule Being Reviewed:
- Commutation reduces sentence but does not change fact of conviction, establish innocence, or remove civil disabilities.

Red-Team Finding:
- CONFIRMED.

Primary Authority:
- U.S. Department of Justice, Office of the Pardon Attorney FAQ.

Official Source URL:
- https://www.justice.gov/pardon/frequently-asked-questions

Supporting Official Material:
- DOJ describes commutation as reduction of sentence.
- DOJ states commutation does not change fact of conviction, imply innocence, or remove civil disabilities.

Corrected Candidate Interpretation:
- `pathway_type: executive_clemency_sentence_reduction`
- `record_effect_profile: conviction_remains`
- `sentence_effect_profile: grant_document_specific`
- `civil_disability_effect: not_automatically_removed`

Why It Matters to Eligibility Engine:
- A sentence reduction cannot be transformed into record clearing, pardon, innocence, eligibility for state relief, or general rights restoration.

Recommended Engineering Treatment:
- Store sentence status separately from conviction status.
- Prohibit automatic record-effect updates based solely on commutation.

Automation Classification:
- MANUAL_REVIEW_REQUIRED.
- EXECUTIVE_DISCRETION.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- NO for core distinction.
- YES if implementation does not separate sentence and conviction status.

## FED-RT-CONF-003 — 18 U.S.C. § 3607(c) Is a Narrow Federal Statutory Expungement Path

V1 Claim/Rule Being Reviewed:
- 18 U.S.C. § 3607(c) provides expungement for a qualifying person under age 21 at time of offense who received § 3607(a) disposition for qualifying § 844 offense.

Red-Team Finding:
- CONFIRMED.

Primary Authority:
- 18 U.S.C. § 3607(b)-(c).

Official Source URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Supporting Official Material:
- § 3607(c) applies to person found guilty of offense under 21 U.S.C. § 844, who was less than 21 at time of offense, and who received § 3607(a) disposition.
- Court shall enter expungement order upon qualifying application.
- § 3607(b) preserves nonpublic DOJ record for later § 3607 eligibility determinations.

Corrected Candidate Interpretation:
- This is not a general federal drug-expungement pathway.
- It requires:
  - exact § 844 offense;
  - verified § 3607(a) disposition;
  - age under 21 at offense;
  - application;
  - court order.
- It has an express retained nonpublic DOJ record exception.

Why It Matters to Eligibility Engine:
- The pathway disproves broad claims that federal convictions can never be expunged.
- It cannot be broadened to general federal possession, state possession, marijuana, drug convictions, or ordinary federal convictions.

Recommended Engineering Treatment:
- Require official case order and federal district identification.
- Do not calculate a generalized federal drug-expungement result.
- Store statutory record effect separately from private/background effect.

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.
- COURT_ORDER_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- NO for core rule.
- YES if district-specific procedure/form fields are treated as known.

## FED-RT-CONF-004 — Federal Juvenile Confidentiality Is Not General Expungement

V1 Claim/Rule Being Reviewed:
- Federal juvenile records are safeguarded under 18 U.S.C. § 5038 and subject to statutory authorized disclosures.

Red-Team Finding:
- CONFIRMED.

Primary Authority:
- 18 U.S.C. § 5038.

Official Source URL:
- https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim

Supporting Official Material:
- Records must be safeguarded from disclosure to unauthorized persons.
- Statute lists authorized releases.
- Unless otherwise authorized, information cannot be released in response to employment, license, bonding, civil-right, or privilege request, and the response should not differ from that for person never involved in delinquency proceeding.

Corrected Candidate Interpretation:
- `pathway_type: statutory_record_confidentiality`
- `record_effect_profile: confidentiality_with_authorized_disclosure_exceptions`
- `expungement_effect: false`
- `record_destruction_effect: not_established`

Why It Matters to Eligibility Engine:
- FairPath must not promise record destruction, universal secrecy, or expungement.

Recommended Engineering Treatment:
- Model access restrictions and recipient exceptions.
- Do not use generic “sealed” or “expunged” field.

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.
- ENGINE_SCHEMA_GAP.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- NO for core rule.
- YES if juvenile proceeding classification is not required.

# V1 Claims Corrected or Narrowed

## Finding ID: FED-RT-001

Severity:
- BLOCKER.

V1 Claim/Rule Being Reviewed:
- V1 presented a five-year waiting period for presidential pardon after release from confinement, or after conviction if no prison sentence was imposed.

V1 Status:
- NARROWED.

Red-Team Finding:
- DOJ describes this as clemency petition guidance under its rules and process, not as a general criminal-record-relief statutory waiting period or a guarantee of substantive clemency eligibility.

Primary Authority:
- DOJ Legal Authority Governing Executive Clemency.
- DOJ Pardon Information and Instructions.

Official Source URLs:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/file/898541/dl
- https://www.justice.gov/pardon/help-me-choose-old

Relevant Official Language:
- DOJ states no petition for pardon should be filed until expiration of at least five years after release from confinement or, if no prison sentence was imposed, after the relevant post-conviction event described in DOJ guidance.
- DOJ also states generally no petition should be submitted by a person on probation, parole, or supervised release.

Effective-Date Issue:
- DOJ forms and clemency guidance can change without statutory amendment.
- This is a current process/guidance rule, not a state-style conviction-expungement statute.

Corrected Candidate Interpretation:
- Use:
  - `petition_guidance_milestone`
  - `guidance_source`
  - `guidance_version_date`
  - `supervision_status`
  - `executive_discretion`
- Do not use:
  - `statutory_expungement_waiting_period`
  - `legal_eligibility_date`
  - `guaranteed_filing_date`

Candidate Formula:

```text
PARDON_GUIDANCE_MILESTONE =
VERIFIED_RELEASE_FROM_CONFINEMENT_DATE + 5 YEARS

OR, IF_NO_PRISON_SENTENCE_AND_CURRENT_DOJ_GUIDANCE_APPLIES:

GUIDANCE_SPECIFIED_POST_CONVICTION_EVENT + 5 YEARS
```

Why Difference Matters to Eligibility Engine:
- A date calculation could be mistaken for legal entitlement, clemency qualification, or record-clearing eligibility.
- DOJ guidance should not be flattened into a definitive eligibility decision.

Recommended Engineering Treatment:
- Output only:
  - `MAY_MEET_CURRENT_DOJ_PARDON_PETITION_GUIDANCE_BASED_ON_REPORTED_FACTS`
  - `MANUAL_REVIEW_REQUIRED`
- Require active DOJ source validation before display.
- Preserve release-date evidence status.

Automation Classification:
- DETERMINISTIC only for arithmetic after verified date.
- MEMBER_ASSERTED_FACT.
- MANUAL_REVIEW_REQUIRED.
- EXECUTIVE_DISCRETION.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-002

Severity:
- BLOCKER.

V1 Claim/Rule Being Reviewed:
- V1 grouped federal, D.C. Code, and military convictions within federal clemency discussion.

V1 Status:
- NARROWED.

Red-Team Finding:
- Federal United States Code, D.C. Code, Code of Federal Regulations, and military cases must be distinct jurisdiction subclasses. They can share presidential clemency authority in some contexts but have different court systems, records, procedures, legal labels, and possible collateral consequences.

Primary Authority:
- DOJ Help Me Choose.
- DOJ Pardon Application.
- DOJ Legal Authority Governing Executive Clemency.

Official Source URLs:
- https://www.justice.gov/pardon/help-me-choose-old
- https://www.justice.gov/pardon/file/960581/dl
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Supporting Official Material:
- DOJ states President can grant pardon to person convicted in United States District Court, Superior Court of District of Columbia, or military court-martial.
- DOJ distinguishes federal offense clemency and cannot grant clemency for state/local offenses.

Corrected Candidate Interpretation:
- Require:
  - `offense_jurisdiction_type: UNITED_STATES_CODE`
  - `offense_jurisdiction_type: DISTRICT_OF_COLUMBIA_CODE`
  - `offense_jurisdiction_type: CODE_OF_FEDERAL_REGULATIONS`
  - `offense_jurisdiction_type: UNIFORM_CODE_OF_MILITARY_JUSTICE`
  - `offense_jurisdiction_type: UNKNOWN`

Why Difference Matters to Eligibility Engine:
- D.C. Superior Court is not a United States district court.
- Military court-martial record systems and procedures differ.
- Categorical marijuana pardon has its own federal/D.C./CFR scope.
- State convictions cannot be routed to presidential clemency as federal cases.

Recommended Engineering Treatment:
- Do not use one generic `federal_conviction` field.
- Require jurisdiction subtype before route selection.
- Unknown subtype returns `MANUAL_REVIEW_REQUIRED`.

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-003

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 stated that a presidential pardon may remove unpaid or unserved portions of sentence remaining at time of grant.

V1 Status:
- NARROWED.

Red-Team Finding:
- DOJ FAQ describes possible pardon effects, but the specific clemency warrant or proclamation controls actual scope. FairPath must not assume every pardon remits every remaining fine, restitution obligation, forfeiture, supervision condition, or other sentence component.

Primary Authority:
- DOJ Office of the Pardon Attorney FAQ.
- Individual clemency warrants/proclamations.

Official Source URL:
- https://www.justice.gov/pardon/frequently-asked-questions

Corrected Candidate Interpretation:
- `pardon_effect_scope: grant_document_specific`
- `pardon_conditions: review_grant_document`
- `financial_remission: not_assumed`
- `supervision_effect: not_assumed`
- `record_effect: not_expungement`

Why Difference Matters to Eligibility Engine:
- Clemency can be conditional, partial, offense-specific, sentence-specific, or otherwise tailored.
- A wrong interpretation could cause a member to stop complying with court/agency obligations.

Recommended Engineering Treatment:
- Require official warrant/proclamation before recording relief effect.
- Human reviewer must interpret grant document.
- Do not calculate financial or supervision relief automatically.

Automation Classification:
- MANUAL_REVIEW_REQUIRED.
- EXECUTIVE_DISCRETION.
- ENGINE_SCHEMA_GAP.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-004

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 described remission as executive relief for unpaid federal criminal fine or restitution.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- Remission can concern unpaid financial penalties, but the candidate package must not merge fine, restitution, forfeiture, special assessment, paid amount, unpaid amount, and grant-specific relief.

Primary Authority:
- DOJ Office of the Pardon Attorney FAQ.
- Commutation Instructions.
- DOJ Legal Authority Governing Executive Clemency.

Official Source URLs:
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960571/dl
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Supporting Official Material:
- DOJ states President may commute or reduce sentence including authority to remit/reduce fine or restitution order not already paid.
- DOJ FAQ says remission applies only to portion not already paid and does not result in refund.

Corrected Candidate Interpretation:
- Financial remission must represent separately:
  - `fine_total`
  - `fine_paid`
  - `fine_unpaid`
  - `restitution_total`
  - `restitution_paid`
  - `restitution_unpaid`
  - `forfeiture_status`
  - `special_assessment_status`
  - `grant_document_scope`
- Do not infer refund.
- Do not infer record effect.

Why Difference Matters to Eligibility Engine:
- Different financial obligations can have different enforcement, victim, collection, and legal consequences.

Recommended Engineering Treatment:
- Manual review only.
- No automated dollar calculation.
- No claim that filing/remission resolves all financial obligations.

Automation Classification:
- MANUAL_REVIEW_REQUIRED.
- EXECUTIVE_DISCRETION.
- ENGINE_SCHEMA_GAP.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-005

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 identified 18 U.S.C. § 3607(a) special probation as a federal relief pathway.

V1 Status:
- NARROWED.

Red-Team Finding:
- § 3607(a) is an original, pre-judgment case disposition mechanism. It is not a general retroactive post-conviction remedy for someone who has already received a standard judgment of conviction.

Primary Authority:
- 18 U.S.C. § 3607(a).

Official Source URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Supporting Statutory Requirements:
- Person is found guilty of qualifying offense under 21 U.S.C. § 844.
- Before commission of offense, person has not been convicted of federal or state controlled-substance law violation.
- Person has not previously been subject to § 3607(a) disposition.
- Court may, with person’s consent, place person on probation without entering judgment of conviction.

Corrected Candidate Interpretation:
- `case_stage: original_pre_judgment_disposition`
- `post_conviction_application_path: false`
- `member_output_if_standard_judgment_exists: RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED`

Why Difference Matters to Eligibility Engine:
- A person with an ordinary federal conviction must not be told they can seek § 3607(a) after sentence completion.

Recommended Engineering Treatment:
- Do not surface as a conventional FairPath post-conviction pathway.
- Use only where official case disposition identifies § 3607(a).

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MEMBER_ASSERTED_FACT for history only if documents unavailable.
- MANUAL_REVIEW_REQUIRED.
- COURT_DISCRETION.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-006

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 stated that § 3607(c) can be applied for after qualifying disposition and that court-specific procedure is required.

V1 Status:
- AMBIGUOUS / REQUIRES MANUAL REVIEW.

Red-Team Finding:
- The statute establishes substantive conditions and a mandatory order after qualifying application, but V1 did not identify a uniform federal judiciary filing form, motion procedure, service rule, fee, hearing practice, or docketing practice.

Primary Authority:
- 18 U.S.C. § 3607(c).

Official Source URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Corrected Candidate Interpretation:
- `procedure_status: RELEVANT_FEDERAL_DISTRICT_COURT_LOCAL_PROCEDURE_REQUIRED`
- `nationwide_form_status: NOT_IDENTIFIED`
- `nationwide_fee_status: UNKNOWN_VERIFY_RELEVANT_FEDERAL_COURT`
- `hearing_requirement: NOT_VERIFIED_NATIONWIDE`

Why Difference Matters to Eligibility Engine:
- A member could be directed to an incorrect district, wrong form, or nonexistent federal filing procedure.

Recommended Engineering Treatment:
- Resolve actual sentencing/district court.
- Research local rules and clerk procedure before any filing guidance.
- Do not present self-service form link.

Automation Classification:
- MANUAL_REVIEW_REQUIRED.
- LOCAL_OFFICIAL_PROCEDURE.
- COURT_ORDER_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-007

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 described § 3607(c) expungement as removal from official records except for nonpublic DOJ record.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- The statutory record effect is strong but remains bounded by statute. FairPath must not extend it to private background-check databases, cached material, press accounts, state data copies, all federal agency systems, or all public indexing systems without specific authority.

Primary Authority:
- 18 U.S.C. § 3607(b)-(c).

Official Source URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Corrected Candidate Interpretation:
- `effect_scope: official_records_as_statute_specifies`
- `retained_nonpublic_DOJ_record: true`
- `private_background_database_effect: UNKNOWN_NOT_PROMISED`
- `court_order_required: true`
- `record_holder_updates: NOT_ASSUMED_BEYOND_STATUTORY_ORDER`

Why Difference Matters to Eligibility Engine:
- “All records erased” could be materially false.

Recommended Engineering Treatment:
- Pathway-specific effect profile.
- No generic deletion statement.
- Preserve statutory retained-record exception.

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.
- COURT_ORDER_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-008

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 identified 21 U.S.C. § 844a expungement as a civil controlled-substance penalty pathway.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- The statutory pathway exists, but V1 does not establish a current official agency form, filing address, implementing regulation, responsible DOJ component, fee, or application workflow.

Primary Authority:
- 21 U.S.C. § 844a(j).

Official Source URL:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Corrected Candidate Interpretation:
- `statutory_pathway_exists: true`
- `official_agency_procedure_status: NOT_VERIFIED`
- `official_form_status: NOT_VERIFIED`
- `fee_status: UNKNOWN_VERIFY_AGENCY_PROCEDURE`
- `self_service_filing_permitted: false`

Why Difference Matters to Eligibility Engine:
- Statutory relief does not prove an active standardized agency filing channel.

Recommended Engineering Treatment:
- Referral/manual review only.
- Do not produce filing address, form, fee, or timeline.
- Do not associate with general federal conviction expungement.

Automation Classification:
- DETERMINISTIC only for three-year arithmetic after verified civil-penalty event.
- CLASSIFICATION_REQUIRED.
- MEMBER_ASSERTED_FACT.
- MANUAL_REVIEW_REQUIRED.
- AGENCY_DETERMINATION_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-009

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 stated federal juvenile confidentiality may apply to adult user with federal juvenile record.

V1 Status:
- NARROWED.

Red-Team Finding:
- A person who was under 18 during federal case may have been prosecuted as an adult rather than handled through a federal juvenile delinquency proceeding. § 5038 must not be applied without classifying proceeding type.

Primary Authority:
- 18 U.S.C. § 5038.
- 18 U.S.C. Chapter 403.

Official Source URL:
- https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim

Corrected Candidate Interpretation:
- Require:
  - `proceeding_type: FEDERAL_JUVENILE_DELINQUENCY`
  - `proceeding_type: FEDERAL_ADULT_PROSECUTION`
  - `proceeding_type: UNKNOWN`
- Do not apply § 5038 confidentiality to adult prosecution without additional authority.

Why Difference Matters to Eligibility Engine:
- Incorrectly applying juvenile confidentiality could disclose inaccurate legal rights or access restrictions.

Recommended Engineering Treatment:
- Manual review for all adult users presenting federal juvenile-history question.
- Require official docket/order/proceeding classification.

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-010

Severity:
- BLOCKER.

V1 Claim/Rule Being Reviewed:
- V1 described limited judicial expungement/sealing based on invalidity or unlawfulness and cited First, Third, Seventh, and Eleventh Circuit decisions plus a district court order.

V1 Status:
- CORRECTED FOR SCOPE AND CONFLICT.

Red-Team Finding:
- The cited decisions do not create a nationwide rule. Judicial authority depends on federal circuit, federal district, legal basis, posture, record type, validity challenge, and local law/procedure.
- The candidate package may safely state only that this research did not identify a general nationwide federal equitable-expungement rule for lawful convictions and that numerous federal courts have recognized jurisdictional limits.
- The package may not state that federal judicial expungement is always unavailable.
- The package may not state that federal courts universally retain inherent equitable expungement authority.

Primary Authority:
- First Circuit official opinion:
  https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf
- Third Circuit official opinion:
  https://www2.ca3.uscourts.gov/opinarch/053425p.pdf
- Eleventh Circuit official opinion:
  https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf
- Seventh Circuit official opinion:
  https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0
- Southern District of West Virginia official order:
  https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf

Corrected Candidate Interpretation:
- `national_rule: NO_GENERAL_NATIONWIDE_FEDERAL_EQUITABLE_EXPUNGEMENT_RULE_VERIFIED`
- `circuit_law_required: true`
- `federal_district_required: true`
- `legal_basis_required: true`
- `default_member_output: RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED`

Why Difference Matters to Eligibility Engine:
- Jurisdictional questions cannot be modeled as a flat federal yes/no eligibility rule.
- A broad automated claim could improperly advise members to file or tell them no relief exists.

Recommended Engineering Treatment:
- Treat all judicial equitable-expungement/sealing requests as manual review.
- Require:
  - Circuit.
  - District.
  - Record type.
  - Arrest/conviction status.
  - Validity challenge.
  - Relevant order.
  - Appellate posture.
  - Local rule status.
- Do not provide national form or motion.

Automation Classification:
- CONFLICTING_AUTHORITY.
- MANUAL_REVIEW_REQUIRED.
- ENGINE_SCHEMA_GAP.
- CIRCUIT_LAW_REQUIRED.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-011

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 listed vacatur, correction, resentencing, or invalid-conviction relief as a distinct non-general pathway.

V1 Status:
- CONFIRMED AS BOUNDARY; UNSUPPORTED FOR GENERAL RULE.

Red-Team Finding:
- V1 appropriately did not create a generalized substantive rule. However, the taxonomy node must not become a candidate self-service pathway.

Primary Authority:
- Specific mechanisms were not researched in V1 to support a general federal rule.

Corrected Candidate Interpretation:
- `status: UNSUPPORTED_FOR_GENERAL_RULE`
- `self_service_eligibility: false`
- `default_member_output: RULE_NOT_VERIFIED`
- `manual_review_required: true`

Why Difference Matters to Eligibility Engine:
- Vacatur, reversal, § 2255 relief, Rule 35 correction, Rule 36 correction, resentencing, compassionate release, appeal reversal, and other remedies are legally distinct.

Recommended Engineering Treatment:
- Keep as referral/taxonomy node only.
- Require separate future research package per post-conviction mechanism before candidate-rule creation.

Automation Classification:
- UNSUPPORTED.
- MANUAL_REVIEW_REQUIRED.
- ENGINE_SCHEMA_GAP.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- NO if unsupported status is preserved.
- YES if any interface treats it as a filing pathway.

## Finding ID: FED-RT-012

Severity:
- BLOCKER.

V1 Claim/Rule Being Reviewed:
- V1 identified 18 U.S.C. § 925(c) federal firearm disability relief and stated operational availability was unverified.

V1 Status:
- NARROWED.

Red-Team Finding:
- The statutory text establishes a federal firearm-disability relief route, but statutory existence does not establish current agency processing availability, appropriations availability, active application form, or feasible judicial-review path.

Primary Authority:
- 18 U.S.C. § 925(c).

Official Source URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim

Corrected Candidate Interpretation:
- `statutory_pathway_exists: true`
- `operational_availability: NOT_VERIFIED`
- `agency_processing_status: NOT_VERIFIED`
- `current_form_status: NOT_VERIFIED`
- `fee_status: FEE_UNKNOWN`
- `self_service_filing_permitted: false`
- `record_clearing_effect: false`
- `member_output: RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED`

Why Difference Matters to Eligibility Engine:
- A person may rely on a statutory path that is not currently available in a usable administrative form.
- Firearm disability relief is not expungement, sealing, pardon, or general restoration of all civil rights.

Recommended Engineering Treatment:
- Do not enable direct application.
- Do not promise firearms restoration.
- Do not map outcome to criminal record.
- Require current official agency verification before any workflow.

Automation Classification:
- LOW_CONFIDENCE_MANUAL_REVIEW.
- AGENCY_DETERMINATION_REQUIRED.
- ENGINE_SCHEMA_GAP.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-013

Severity:
- HIGH.

V1 Claim/Rule Being Reviewed:
- V1 stated categorical marijuana pardon potentially covers qualifying simple possession, attempted possession, or use of marijuana offenses on or before December 22, 2023.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- The DOJ certificate application supports the stated scope, but it must be applied only after exact code, conduct, date, jurisdiction, and citizenship/lawful-presence facts are verified.
- It cannot be inferred from a charge label such as “marijuana” or “cannabis.”

Primary Authority:
- DOJ Application for Certificate of Pardon.
- DOJ official marijuana pardon certificate announcement.
- DOJ official statement on 2022 proclamation.
- DOJ pardon certificate material regarding 2022 and 2023 proclamations.

Official URLs:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5
- https://www.justice.gov/archives/opa/pr/justice-department-announces-application-form-marijuana-pardon-certificates
- https://www.justice.gov/archives/opa/pr/justice-department-statement-president-s-announcements-regarding-simple-possession-marijuana
- https://www.justice.gov/pardon/media/1398856/dl?inline

Corrected Candidate Interpretation:
- Required facts:
  - Exact code authority.
  - Exact offense conduct.
  - Offense/charge/conviction date.
  - On or before December 22, 2023.
  - Federal, D.C. Code, or CFR jurisdiction.
  - U.S. citizen or lawfully present at offense.
  - Official record evidence.
- Candidate outcome:
  - `POTENTIALLY_COVERED_BY_CATEGORICAL_PARDON_REVIEW`
  - Not `EXPUNGED`.
  - Not `SEALED`.
  - Not `RECORD_CLEARED`.

Why Difference Matters to Eligibility Engine:
- Distribution, manufacturing, cultivation, trafficking, possession with intent, state offenses, and post-cutoff offenses may not fall within the current described scope.

Recommended Engineering Treatment:
- No keyword matching.
- Certificate workflow only after current-form and required-fact verification.
- Preserve proclamation/version date.

Automation Classification:
- CLASSIFICATION_REQUIRED.
- MEMBER_ASSERTED_FACT.
- MANUAL_REVIEW_REQUIRED.
- EXECUTIVE_CLEMENCY.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-014

Severity:
- MEDIUM.

V1 Claim/Rule Being Reviewed:
- V1 stated that no fee was identified in retrieved official clemency guidance for pardon, commutation, remission, or marijuana certificate process.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- “No fee identified in retrieved official guidance” cannot be converted to permanent $0 or “free” guarantee.

Primary Authority:
- DOJ clemency forms and guidance.

Official URLs:
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/file/960581/dl
- https://www.justice.gov/pardon/file/960571/dl
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Corrected Candidate Interpretation:
- Fee status:
  - `NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE`
- Do not display:
  - `$0`
  - `FREE`
  - `NO_FEE_GUARANTEED`

Why Difference Matters to Eligibility Engine:
- Process fees, document costs, and official procedures may change.

Recommended Engineering Treatment:
- Retain source and retrieval date.
- Revalidate before fee display.
- Distinguish no-fee-identified from statutory no-fee.

Automation Classification:
- MANUAL_REVIEW_REQUIRED for current procedure verification.

Automatic Publication Must Be Blocked:
- NO for candidate research.
- YES for member-facing fee guarantee without current validation.

V1 Must Change Before Candidate Ingestion:
- NO if source-qualified wording is retained.
- YES if null/no-fee data serializes to zero.

## Finding ID: FED-RT-015

Severity:
- MEDIUM.

V1 Claim/Rule Being Reviewed:
- V1 stated § 844a requires no federal or state controlled-substance conviction as statute provides.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- This requires complete cross-jurisdiction history. A member’s entered history may be incomplete.

Primary Authority:
- 21 U.S.C. § 844a(j).

Official Source URL:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Corrected Candidate Interpretation:
- Required fields:
  - `federal_controlled_substance_history_status`
  - `state_controlled_substance_history_status`
  - `history_source_status`
  - `prior_844a_assessment_status`
- Unknown history results in manual review.

Why Difference Matters to Eligibility Engine:
- A state controlled-substance conviction can affect the federal statutory pathway.

Recommended Engineering Treatment:
- Do not make positive eligibility determination from self-report alone.
- Preserve history-verification status.

Automation Classification:
- MEMBER_ASSERTED_FACT.
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.

Automatic Publication Must Be Blocked:
- YES for any member-specific eligibility result.

V1 Must Change Before Candidate Ingestion:
- YES.

## Finding ID: FED-RT-016

Severity:
- MEDIUM.

V1 Claim/Rule Being Reviewed:
- V1 identified Federal Youth Corrections Act set-aside as historical and repealed effective January 1, 1987.

V1 Status:
- CONFIRMED AND NARROWED.

Red-Team Finding:
- The mechanism must remain historical only. It cannot be offered as a current general application pathway.

Primary Authority:
- Historical 18 U.S.C. § 5021 source.

Official Source URL:
- https://uscode.house.gov/view.xhtml;jsessionid=99193D587D9C9A87F8FAD4220D006DE5?req=granuleid:USC-1994-title18-part4&saved=%7CZ3JhbnVsZWlkOlVTQy0xOTk0LXRpdGxlMTgtcGFydDQtZnJvbnQ=%7C%7C0%7Cfalse%7C1994&edition=1994

Corrected Candidate Interpretation:
- `status: HISTORICAL_ONLY`
- `current_application_pathway: false`
- `manual_review_required: true`

Why Difference Matters to Eligibility Engine:
- Repealed historical statute cannot be presented as current relief.

Recommended Engineering Treatment:
- Retain only for historical document/record interpretation.
- Require official historical sentence/certificate documents.

Automation Classification:
- MANUAL_REVIEW_REQUIRED.
- ENGINE_SCHEMA_GAP.

Automatic Publication Must Be Blocked:
- YES.

V1 Must Change Before Candidate Ingestion:
- NO if historical-only status remains.
- YES if ordinary user pathway display is possible.

# Conflicting or Ambiguous Authority

## Federal Judicial Equitable Expungement

Status:
- CONFLICTING_AUTHORITY.
- CIRCUIT_LAW_REQUIRED.
- MANUAL_REVIEW_REQUIRED.
- ENGINE_SCHEMA_GAP.

Issue:
- Official federal appellate and district court decisions demonstrate significant limits on federal equitable-expungement jurisdiction, especially for lawful convictions not challenged as invalid.
- The reviewed authorities do not justify one nationwide deterministic rule.

Official Sources:
- First Circuit:
  https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf
- Third Circuit:
  https://www2.ca3.uscourts.gov/opinarch/053425p.pdf
- Eleventh Circuit:
  https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf
- Seventh Circuit:
  https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0
- Southern District of West Virginia:
  https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf

Controlling Candidate Interpretation:
- No general nationwide federal equitable-expungement rule is verified.
- No general nationwide statement that federal judicial expungement is impossible is verified.
- Each motion requires circuit, district, legal-basis, record-type, and procedural analysis.

Required Member-Facing Output:
- RULE_NOT_VERIFIED.
- MANUAL_REVIEW_REQUIRED.

## 18 U.S.C. § 925(c) Operational Availability

Status:
- AMBIGUOUS.
- OPERATIONAL_AVAILABILITY_NOT_VERIFIED.
- MANUAL_REVIEW_REQUIRED.

Issue:
- The statutory route exists, but this package does not verify active agency processing, congressional appropriations effect, official application form, filing destination, fee, or current agency policy.

Official Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim

Controlling Candidate Interpretation:
- Statute exists.
- Self-service operational workflow is not verified.
- Do not offer form, promise agency consideration, or claim restored firearm rights.

## 21 U.S.C. § 844a Procedure

Status:
- AMBIGUOUS.
- OFFICIAL_AGENCY_PROCEDURE_NOT_VERIFIED.
- MANUAL_REVIEW_REQUIRED.

Issue:
- Statute contains expungement conditions, but no current official application form, filing route, responsible component, fee, or procedure was identified.

Official Authority:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Controlling Candidate Interpretation:
- Preserve statute as candidate research.
- No direct filing workflow.
- No generic “apply to DOJ” instructions.

## Federal Record Effects

Status:
- AMBIGUOUS.
- ENGINE_SCHEMA_GAP.

Issue:
- Different custodians may include federal court, DOJ, FBI, probation, arresting agency, BOP, state court, state repository, and private background-check companies.
- No source reviewed supports generic deletion from private databases.

Controlling Candidate Interpretation:
- Record effect must be:
  - pathway-specific;
  - order-specific;
  - custodian-specific where source supports it.
- Private background database effect remains unknown unless separately sourced.

# Waiting-Period Verification

## Presidential Pardon Guidance

Authority:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/file/898541/dl
- https://www.justice.gov/pardon/help-me-choose-old

Verified:
- DOJ guidance identifies a five-year pardon petition waiting period after release from confinement.
- DOJ guidance identifies a five-year period after the relevant post-conviction event if no prison sentence was imposed.
- DOJ generally advises against filing while on probation, parole, or supervised release.

Red-Team Treatment:
- Petition-guidance milestone only.
- Not a statutory expungement waiting period.
- Not a legal entitlement.
- Not a guarantee of executive clemency.

## 18 U.S.C. § 3607(c)

Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Verified:
- No additional numerical post-disposition waiting period is stated in § 3607(c).
- Path depends on prior § 3607(a) disposition and age under 21 at offense.

Red-Team Treatment:
- Do not invent one-year, five-year, sentence-completion, or final-discharge waiting period.
- Federal district local procedure must be verified.

## 21 U.S.C. § 844a

Authority:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Verified:
- Three-year statutory period.
- Conditions include paid assessment, compliance with Attorney General conditions, no relevant federal/state controlled-substance conviction, and drug-free test as statute provides.

Red-Team Treatment:
- Clock must be tied to civil-penalty disposition/proceeding as statute specifies.
- Do not calculate from criminal conviction date.

## Categorical Marijuana Pardon

Authority:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Verified:
- Official current DOJ application describes qualifying offenses on or before December 22, 2023.

Red-Team Treatment:
- This is a proclamation scope cutoff, not a waiting period.
- Do not apply to offenses after cutoff.

# Offense and Eligibility Exclusion Verification

## 18 U.S.C. § 3607(a)

Verified Required Conditions:
- Exact qualifying 21 U.S.C. § 844 offense.
- No prior federal or state controlled-substance conviction before offense.
- No prior § 3607(a) disposition.
- Person consent.
- Court decision in original case.

Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Red-Team Boundary:
- This is not a generic first-offender program for all federal offenses.
- This is not ordinary post-conviction relief.

## 18 U.S.C. § 3607(c)

Verified Required Conditions:
- Qualifying § 844 offense.
- Qualifying § 3607(a) disposition.
- Under 21 at offense.
- Application.
- Court order.

Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Red-Team Boundary:
- Not available merely because person had a federal simple-possession conviction.
- Do not infer § 3607(a) from dismissal, probation, diversion, or lack of incarceration without official order.

## 21 U.S.C. § 844a

Verified Required Conditions:
- Civil penalty assessment under § 844a.
- No prior § 844a assessment.
- Assessment paid.
- Conditions complied with.
- No federal or state controlled-substance conviction as statute provides.
- Drug-test agreement and drug-free result.

Authority:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Red-Team Boundary:
- Not a general criminal case expungement route.

## Categorical Marijuana Pardon

Verified Required Conditions:
- Qualifying federal, D.C., or CFR offense.
- Simple possession, attempted possession, or use of marijuana.
- Offense/charge/conviction on or before December 22, 2023.
- U.S. citizen or lawfully present at time of offense.

Authority:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Red-Team Boundary:
- Do not infer coverage from any cannabis or marijuana label.
- State/local cases are not included under current DOJ description.
- Distribution, trafficking, manufacturing, cultivation, and possession-with-intent require separate review and must not be presumed covered.

# Sentence Completion / Fines / Restitution Verification

## Presidential Pardon

Authorities:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960581/dl

Verified:
- DOJ petition guidance focuses on release from confinement or relevant post-conviction event if no prison.
- DOJ generally advises against filing while on probation, parole, or supervised release.

Red-Team Boundary:
- A pardon’s actual effect on unpaid sentence components requires warrant/proclamation review.
- Do not assume all restitution, fines, forfeitures, supervision, or disabilities are removed.

## Commutation / Remission

Authorities:
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960571/dl

Verified:
- Commutation can reduce sentence.
- Remission can reduce unpaid fine or restitution.
- Amount already paid is not refunded according to DOJ official materials.

Red-Team Boundary:
- Fine, restitution, forfeiture, special assessment, and other financial obligations must be distinct.
- Actual grant scope controls.

## 21 U.S.C. § 844a

Authority:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Verified:
- Assessment payment and compliance with Attorney General conditions are statutory conditions.
- Drug testing and drug-free result are statutory conditions.

Red-Team Boundary:
- Payment, conditions, test, and history require documentation.
- Do not rely solely on member self-report.

# Conviction-Count / Multiple-Case Verification

## § 3607 Prior Drug History

Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Verified:
- § 3607(a) requires no prior federal or state controlled-substance conviction and no prior § 3607(a) disposition.

Red-Team Boundary:
- Complete federal and state controlled-substance history is required.
- Flat user-entered history is not sufficient for definitive screening.

## § 844a Prior Assessment and Drug History

Authority:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Verified:
- No prior § 844a civil penalty assessment.
- No federal or state controlled-substance conviction as statute provides.

Red-Team Boundary:
- Cross-jurisdiction history and civil penalty history are required.

# Filing Procedure Verification

## Presidential Pardon / Commutation / Remission / Reprieve

Authorities:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/file/960581/dl
- https://www.justice.gov/pardon/file/960571/dl

Verified:
- Executive clemency petitions are processed through the Office of the Pardon Attorney.
- Military procedures can differ.
- Pardon and commutation are separate application paths.

Red-Team Boundary:
- Revalidate current form, guidance, and workflow before member link.
- Do not assume federal/D.C./military routing is identical.

## 18 U.S.C. § 3607(c)

Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Verified:
- Court shall enter expungement order upon qualifying application.

Not Verified:
- Nationwide form.
- Nationwide motion caption/procedure.
- Nationwide filing fee.
- Nationwide service requirement.
- Nationwide hearing practice.
- Nationwide clerk instructions.

Red-Team Treatment:
- Relevant federal district court must be resolved.
- Local official procedure research required before form/process display.

## 21 U.S.C. § 844a

Authority:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Verified:
- Statute provides application to Attorney General.

Not Verified:
- Current form.
- Filing address.
- Responsible DOJ component.
- Fee.
- Documentary checklist.
- Agency workflow.

Red-Team Treatment:
- No self-service filing instruction.

## 18 U.S.C. § 925(c)

Authority:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim

Verified:
- Statute describes Attorney General application and judicial review after denial.

Not Verified:
- Current agency processing.
- Current form.
- Current fee.
- Current application route.
- Current appropriations/implementation status.

Red-Team Treatment:
- Manual-review only.
- No member-facing filing workflow.

# Fees Verification

## Presidential Pardon

Official Sources:
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/file/960581/dl

Finding:
- No fee identified in retrieved official guidance.

Corrected Candidate Fee Value:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

Prohibited Fee Value:
- $0 guaranteed.
- Permanently free.

## Commutation / Remission

Official Sources:
- https://www.justice.gov/pardon/file/960571/dl
- https://www.justice.gov/pardon/apply-clemency

Finding:
- No fee identified in retrieved official guidance.

Corrected Candidate Fee Value:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

## Categorical Marijuana Pardon Certificate

Official Source:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Finding:
- No fee identified in retrieved official application.

Corrected Candidate Fee Value:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

## 18 U.S.C. § 3607(c)

Finding:
- No nationwide fee stated in statute.

Corrected Candidate Fee Value:
- UNKNOWN_VERIFY_RELEVANT_FEDERAL_COURT.

## 21 U.S.C. § 844a

Finding:
- No fee identified in retrieved statute.

Corrected Candidate Fee Value:
- UNKNOWN_VERIFY_AGENCY_PROCEDURE.

## 18 U.S.C. § 925(c)

Finding:
- Current fee not verified.

Corrected Candidate Fee Value:
- FEE_UNKNOWN.

# Forms Verification

## Pardon Application

Form Name:
- Application for Pardon After Completion of Sentence.

Official URL:
- https://www.justice.gov/pardon/file/960581/dl

Status:
- Official form.

Red-Team Requirement:
- Verify active version and instructions before member-facing link.

## Commutation Instructions / Application Process

Form Name:
- Commutation Instructions.

Official URL:
- https://www.justice.gov/pardon/file/960571/dl

Status:
- Official DOJ material.

Red-Team Requirement:
- Verify active version and current process before member-facing link.

## Marijuana Pardon Certificate Application

Form Name:
- Application for Certificate of Pardon.

Official URL:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Status:
- Official DOJ web form.

Red-Team Requirement:
- Validate active form and proclamation scope before direct use.

## 18 U.S.C. § 3607(c) Form

Status:
- No universal federal form identified.

Required Candidate Status:
- LOCAL_FEDERAL_COURT_PROCEDURE_REQUIRED.

## 21 U.S.C. § 844a Form

Status:
- Official current form not verified.

Required Candidate Status:
- OFFICIAL_AGENCY_PROCEDURE_NOT_VERIFIED.

## 18 U.S.C. § 925(c) Form

Status:
- Current official form not verified.

Required Candidate Status:
- FORM_NOT_VERIFIED.
- OPERATIONAL_AVAILABILITY_NOT_VERIFIED.

# Effective-Date and Versioning Risks

## United States Code

Risk:
- United States Code preliminary-edition page currency can vary by section.
- Enacted federal legislation may require review before code-page updates are reflected.

Required Source Metadata:
- Statute.
- Subsection.
- U.S. Code edition.
- Text currency date shown.
- Retrieval date.
- Source snapshot/hash.
- Enacted-legislation check date.
- Candidate staleness status.

Examples:
- 18 U.S.C. § 3607 page showed laws in effect on September 8, 2026.
- 18 U.S.C. § 925 page showed laws in effect on September 12, 2026.

Official URLs:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim

## DOJ Guidance and Forms

Risk:
- Pardon, commutation, remission, and certificate forms/processes may change through DOJ policy, form revision, regulation, or executive action.

Required Monitoring:
- Office of the Pardon Attorney pages.
- Apply for Clemency page.
- Legal authority page.
- FAQ.
- Form URLs.
- Executive proclamation announcements.

## Presidential Proclamations

Risk:
- Categorical pardon coverage is proclamation-specific.
- Scope can depend on:
  - offense date;
  - code authority;
  - conduct;
  - jurisdiction;
  - citizenship/lawful-presence;
  - proclamation version.

Required Treatment:
- Future proclamation must be stored as separate candidate rule/version.
- Do not silently broaden prior proclamation rule.

## Federal Circuit and District Court Precedent

Risk:
- Judicial expungement authority can change through appellate opinions and district court decisions.
- Circuit law is not a nationwide federal rule.

Required Treatment:
- Track circuit.
- Track district.
- Track case citation and decision date.
- Mark candidate judicial-expungement rule POSSIBLY_STALE after relevant appellate decision.

# Source and Provenance Problems

## Missing Normalized Constitution Source

Finding:
- V1 relied on Article II clemency power but did not include a normalized official Constitution URL.

Severity:
- MEDIUM.

Status:
- SOURCE_PROVENANCE_GAP.

Correction:
- Add official U.S. government Constitution source URL during source normalization.
- DOJ legal authority page supports operational clemency guidance but does not replace Constitution citation for underlying power.

Engineering Treatment:
- Candidate rule can retain constitutional citation.
- Source completeness status must be `INCOMPLETE_PRIMARY_URL_PENDING`.

Automatic Publication Must Be Blocked:
- YES if clemency rule lacks complete primary authority/provenance.

## Federal Circuit Precedent Scope

Finding:
- V1 cited official opinions but did not require each decision’s circuit/district scope metadata.

Severity:
- BLOCKER for judicial-expungement functionality.

Correction:
- Each precedent record must include:
  - circuit;
  - court;
  - citation;
  - decision date;
  - legal question;
  - holding scope;
  - binding status;
  - target-district applicability;
  - source URL;
  - retrieval date.

Automatic Publication Must Be Blocked:
- YES.

## Agency Procedure Gaps

Finding:
- V1 identified statutory § 844a and § 925(c) pathways but lacks verified active agency forms and workflow.

Severity:
- HIGH.

Correction:
- Preserve as statutory-research nodes.
- Block direct filing guidance.
- Require separate official-agency procedure research package.

Automatic Publication Must Be Blocked:
- YES.

# Items Requiring Human Verification

The following require human/legal or official-procedure verification before any individualized federal guidance:

- Exact offense jurisdiction:
  - United States Code.
  - D.C. Code.
  - Code of Federal Regulations.
  - Uniform Code of Military Justice.
- Exact offense statute and subsection.
- Offense conduct.
- Offense date.
- Charge/disposition/judgment status.
- Age at offense.
- Federal district.
- Federal circuit.
- § 3607(a) disposition order.
- Whether judgment of conviction was entered.
- Complete federal and state controlled-substance history.
- § 844a civil penalty assessment record.
- § 844a payment status.
- § 844a conditions and compliance.
- § 844a drug-test status.
- Official pardon, commutation, remission, reprieve, or proclamation document.
- Clemency conditions.
- Actual effect of clemency warrant.
- Current DOJ form/workflow.
- Local federal district court procedure for § 3607(c).
- Federal juvenile proceeding versus adult prosecution.
- Judicial-expungement legal basis.
- Current § 925(c) operational availability.
- Current § 925(c) form and fee.
- Categorical marijuana pardon conduct, date, code, jurisdiction, citizenship/lawful-presence, and record evidence.
- Record custodian involved.
- Any request involving private background-check company correction/deletion.
- Any mixed state/federal/D.C./military case history.

# Importer and Engineering Recommendations

## Required Jurisdiction Subtypes

- UNITED_STATES_CODE.
- DISTRICT_OF_COLUMBIA_CODE.
- CODE_OF_FEDERAL_REGULATIONS.
- UNIFORM_CODE_OF_MILITARY_JUSTICE.
- FEDERAL_JUVENILE_DELINQUENCY.
- FEDERAL_ADULT_PROSECUTION.
- UNKNOWN_FEDERAL_RELATED_JURISDICTION.

## Required Relief Types

- executive_clemency_pardon.
- executive_clemency_commutation.
- executive_clemency_remission.
- executive_clemency_reprieve.
- executive_clemency_categorical_pardon.
- executive_clemency_certificate.
- statutory_pre_judgment_disposition.
- statutory_judicial_expungement.
- statutory_administrative_expungement.
- juvenile_record_confidentiality.
- limited_judicial_invalidity_based_relief.
- invalid_conviction_post_conviction_relief.
- firearm_disability_relief.
- historical_repealed_mechanism.

## Required Candidate Statuses

- CANDIDATE_RESEARCH.
- HIGH_CONFIDENCE_CANDIDATE.
- MEDIUM_CONFIDENCE_CANDIDATE.
- LOW_CONFIDENCE_MANUAL_REVIEW.
- CONFLICTING_AUTHORITY.
- ENGINE_SCHEMA_GAP.
- FUTURE_EFFECTIVE.
- UNSUPPORTED.
- HISTORICAL_ONLY.
- RULE_NOT_VERIFIED.
- FORM_NOT_VERIFIED.
- FEE_UNKNOWN.
- OFFICIAL_AGENCY_PROCEDURE_NOT_VERIFIED.
- OPERATIONAL_AVAILABILITY_NOT_VERIFIED.
- LOCAL_FEDERAL_COURT_PROCEDURE_REQUIRED.
- CIRCUIT_LAW_REQUIRED.
- COURT_ORDER_REQUIRED.
- AGENCY_DETERMINATION_REQUIRED.
- EXECUTIVE_DISCRETION.
- POSSIBLY_STALE.

## Required Record-Effect Profiles

- pardon_not_expungement.
- commutation_sentence_reduction_only.
- remission_financial_relief_only.
- reprieve_temporary_sentence_delay.
- categorical_pardon_not_expungement.
- statutory_expungement_with_nonpublic_DOJ_retention.
- civil_penalty_expungement_with_nonpublic_DOJ_retention.
- juvenile_confidentiality_with_authorized_disclosure_exceptions.
- judicial_record_effect_unknown_until_order.
- firearm_disability_relief_not_record_clearing.
- private_database_effect_unknown.

## Required Date / Event Capabilities

- Release from confinement.
- Conviction date.
- Sentencing date.
- Supervision status.
- Age at offense.
- Civil penalty assessment date.
- Civil penalty finality/disposition date.
- Proclamation cutoff date.
- Clemency grant date.
- Court order date.
- Effective date of statute/proclamation/form.
- Statute version/retrieval date.

## Required Evidence Statuses

- member_asserted.
- official_document_verified.
- court_record_verified.
- agency_record_verified.
- human_reviewer_accepted.
- source_conflict.
- unknown.

## Required Output Restrictions

Do not output:
- FEDERAL_CONVICTION_CAN_NEVER_BE_EXPUNGED.
- FEDERAL_PARDON_ERASES_RECORD.
- COMMUTATION_ERASES_RECORD.
- FIREARM_RELIEF_ERASES_RECORD.
- FEDERAL_RECORD_CLEARED.
- ELIGIBLE.
- GUARANTEED.
- FREE.
- FORM_AVAILABLE unless direct official current form verified.

Default output where federal pathway remains unresolved:
- RULE_NOT_VERIFIED.
- MORE_INFORMATION_NEEDED.
- MANUAL_REVIEW_REQUIRED.
- POTENTIALLY_COVERED_BY_CATEGORICAL_PARDON_REVIEW.
- MAY_MEET_CURRENT_DOJ_PETITION_GUIDANCE_BASED_ON_REPORTED_FACTS.

# Publication-Blocking Issues

Automatic publication must remain blocked if any of the following apply:

- V1.1 changes are not incorporated.
- Federal jurisdiction subtype is unknown.
- Exact offense statute/subsection is unknown.
- Member seeks general federal conviction expungement.
- Judicial-expungement request lacks circuit, district, legal basis, and case posture.
- § 3607(a) disposition is not verified.
- § 3607(c) age at offense is not verified.
- § 3607(c) relevant federal district procedure is not verified.
- § 844a civil-penalty assessment/payment/condition history is not verified.
- § 844a agency procedure is not verified.
- Pardon, commutation, remission, or reprieve grant is not supported by official grant document.
- Categorical marijuana pardon facts are incomplete.
- Federal juvenile proceeding type is unclear.
- § 925(c) current operational availability is not verified.
- Form, fee, or local federal procedure is not verified.
- Record-effect claim exceeds official source.
- Any source has changed and candidate rule is marked POSSIBLY_STALE.
- Source provenance is incomplete.
- Conflicting circuit authority exists without human legal review.

# Final Candidate Change Log from V1 → V1.1

```json
{
  "changeset_id": "FAIRPATH-FEDERAL-CANDIDATE-V1.1-REDTEAM",
  "base_package": "FEDERAL_CANDIDATE_PACKAGE_V1",
  "status": "required_before_candidate_ingestion",
  "controlling_rule": "V1.1 controls only for candidate-research conflict resolution and does not authorize production publication",
  "changes": [
    {
      "change_id": "FED-V11-001",
      "action": "narrow",
      "target": "US-FED-CLEMENCY-PRESIDENTIAL-PARDON.waiting_period",
      "original_v1_position": "Five-year pardon waiting period.",
      "v1_1_candidate_correction": {
        "field_name": "petition_guidance_milestone",
        "not_a_field": "statutory_record_relief_eligibility",
        "authority": "DOJ Legal Authority Governing Executive Clemency",
        "source_urls": [
          "[https://www.justice.gov/pardon/legal-authority-governing-executive-clemency](https://www.justice.gov/pardon/legal-authority-governing-executive-clemency)",
          "[https://www.justice.gov/pardon/file/898541/dl](https://www.justice.gov/pardon/file/898541/dl)"
        ],
        "member_output": "MAY_MEET_CURRENT_DOJ_PARDON_PETITION_GUIDANCE_BASED_ON_REPORTED_FACTS"
      }
    },
    {
      "change_id": "FED-V11-002",
      "action": "add",
      "target": "all_federal_clemency_pathways",
      "original_v1_position": "Federal, D.C., and military cases noted together.",
      "v1_1_candidate_correction": {
        "required_jurisdiction_subtypes": [
          "UNITED_STATES_CODE",
          "DISTRICT_OF_COLUMBIA_CODE",
          "UNIFORM_CODE_OF_MILITARY_JUSTICE",
          "CODE_OF_FEDERAL_REGULATIONS"
        ],
        "default_when_unknown": "MANUAL_REVIEW_REQUIRED",
        "authority_urls": [
          "[https://www.justice.gov/pardon/help-me-choose-old](https://www.justice.gov/pardon/help-me-choose-old)",
          "[https://www.justice.gov/pardon/file/960581/dl](https://www.justice.gov/pardon/file/960581/dl)"
        ]
      }
    },
    {
      "change_id": "FED-V11-003",
      "action": "add",
      "target": "US-FED-CLEMENCY-PRESIDENTIAL-PARDON.record_effect",
      "original_v1_position": "Pardon may remove remaining sentence components.",
      "v1_1_candidate_correction": {
        "grant_scope": "clemency_warrant_or_proclamation_specific",
        "do_not_assume": [
          "all_financial_penalties_remitted",
          "all_supervision_ended",
          "all_civil_disabilities_removed",
          "record_expunged",
          "record_sealed",
          "private_background_records_deleted"
        ],
        "authority_url": "[https://www.justice.gov/pardon/frequently-asked-questions](https://www.justice.gov/pardon/frequently-asked-questions)"
      }
    },
    {
      "change_id": "FED-V11-004",
      "action": "add",
      "target": "US-FED-CLEMENCY-REMISSION",
      "original_v1_position": "Remission described generally for unpaid fine/restitution.",
      "v1_1_candidate_correction": {
        "financial_obligation_categories": [
          "fine",
          "restitution",
          "forfeiture",
          "special_assessment",
          "paid_amount",
          "unpaid_amount"
        ],
        "grant_scope": "clemency_warrant_specific",
        "refund_of_paid_amounts": "not_supported_by_retrieved_DOJ_guidance",
        "authority_urls": [
          "[https://www.justice.gov/pardon/frequently-asked-questions](https://www.justice.gov/pardon/frequently-asked-questions)",
          "[https://www.justice.gov/pardon/file/960571/dl](https://www.justice.gov/pardon/file/960571/dl)"
        ]
      }
    },
    {
      "change_id": "FED-V11-005",
      "action": "narrow",
      "target": "US-FED-18USC3607-PREJUDGMENT-PROBATION",
      "original_v1_position": "Candidate relief pathway.",
      "v1_1_candidate_correction": {
        "case_stage": "original_pre_judgment_disposition",
        "not_general_post_conviction_relief": true,
        "member_output_if_standard_judgment_exists": "RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED",
        "authority_url": "[https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim)"
      }
    },
    {
      "change_id": "FED-V11-006",
      "action": "add",
      "target": "US-FED-18USC3607-EXPUNGEMENT.procedure",
      "original_v1_position": "Court-specific procedure required.",
      "v1_1_candidate_correction": {
        "procedure_status": "RELEVANT_FEDERAL_DISTRICT_COURT_LOCAL_PROCEDURE_REQUIRED",
        "nationwide_form_status": "NOT_IDENTIFIED",
        "nationwide_fee_status": "UNKNOWN_VERIFY_RELEVANT_FEDERAL_COURT",
        "nationwide_hearing_requirement": "NOT_VERIFIED",
        "authority_url": "[https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim)"
      }
    },
    {
      "change_id": "FED-V11-007",
      "action": "narrow",
      "target": "US-FED-18USC3607-EXPUNGEMENT.record_effect",
      "original_v1_position": "Expungement from official records except nonpublic DOJ record.",
      "v1_1_candidate_correction": {
        "effect_scope": "official_records_as_statute_specifies",
        "retained_nonpublic_DOJ_record": true,
        "private_background_database_effect": "UNKNOWN_NOT_PROMISED",
        "court_order_required": true,
        "authority_url": "[https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim)"
      }
    },
    {
      "change_id": "FED-V11-008",
      "action": "add",
      "target": "US-FED-21USC844A-CIVIL-PENALTY-EXPUNGEMENT",
      "original_v1_position": "Statutory pathway with no verified agency procedure.",
      "v1_1_candidate_correction": {
        "official_agency_procedure_status": "NOT_VERIFIED",
        "self_service_filing_permitted": false,
        "form_status": "NOT_VERIFIED",
        "fee_status": "UNKNOWN_VERIFY_AGENCY_PROCEDURE",
        "authority_url": "[https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD](https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD)"
      }
    },
    {
      "change_id": "FED-V11-009",
      "action": "add",
      "target": "US-FED-18USC5038-JUVENILE-RECORD-CONFIDENTIALITY",
      "original_v1_position": "Applicable to adult user with juvenile record.",
      "v1_1_candidate_correction": {
        "required_proceeding_classification": [
          "FEDERAL_JUVENILE_DELINQUENCY",
          "FEDERAL_ADULT_PROSECUTION",
          "UNKNOWN"
        ],
        "do_not_apply_if_adult_prosecution_without_further_authority": true,
        "authority_url": "[https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim](https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim)"
      }
    },
    {
      "change_id": "FED-V11-010",
      "action": "replace",
      "target": "US-FED-JUDICIAL-EXPUNGEMENT-INVALIDITY",
      "original_v1_position": "Limited judicial expungement/sealing based on invalidity/unlawfulness with cited circuit decisions.",
      "v1_1_candidate_correction": {
        "national_rule": "NO_GENERAL_NATIONWIDE_FEDERAL_EQUITABLE_EXPUNGEMENT_RULE_VERIFIED",
        "required_fields": [
          "federal_circuit",
          "federal_district",
          "legal_basis",
          "record_type",
          "underlying_order",
          "precedent_scope",
          "judgment_status",
          "appeal_status"
        ],
        "default_output": "RULE_NOT_VERIFIED_MANUAL_REVIEW_REQUIRED",
        "authority_urls": [
          "[https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf](https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf)",
          "[https://www2.ca3.uscourts.gov/opinarch/053425p.pdf](https://www2.ca3.uscourts.gov/opinarch/053425p.pdf)",
          "[https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf](https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf)",
          "[https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0](https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0)",
          "[https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf](https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf)"
        ]
      }
    },
    {
      "change_id": "FED-V11-011",
      "action": "narrow",
      "target": "US-FED-INVALID-CONVICTION-RELIEF",
      "original_v1_position": "Taxonomy/referral pathway.",
      "v1_1_candidate_correction": {
        "status": "UNSUPPORTED_FOR_GENERAL_RULE",
        "self_service_eligibility": false,
        "default_output": "RULE_NOT_VERIFIED",
        "manual_review_required": true
      }
    },
    {
      "change_id": "FED-V11-012",
      "action": "replace",
      "target": "US-FED-18USC925C-FIREARM-DISABILITY-RELIEF",
      "original_v1_position": "Statutory route with operational availability not verified.",
      "v1_1_candidate_correction": {
        "statutory_pathway_exists": true,
        "operational_availability": "NOT_VERIFIED",
        "agency_processing_status": "NOT_VERIFIED",
        "current_form": "NOT_VERIFIED",
        "fee_status": "FEE_UNKNOWN",
        "self_service_filing_permitted": false,
        "record_clearing_effect": false,
        "authority_url": "[https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim)"
      }
    },
    {
      "change_id": "FED-V11-013",
      "action": "narrow",
      "target": "US-FED-CLEMENCY-CATEGORICAL-MARIJUANA-PARDON",
      "original_v1_position": "Categorical marijuana pardon for qualifying simple possession, attempted possession, or use cases on or before December 22, 2023.",
      "v1_1_candidate_correction": {
        "required_facts": [
          "exact_code_authority",
          "exact_offense_conduct",
          "offense_or_charge_or_conviction_date",
          "federal_DC_or_CFR_jurisdiction",
          "citizenship_or_lawful_presence_at_time_of_offense",
          "official_record_evidence"
        ],
        "default_output": "POTENTIALLY_COVERED_BY_CATEGORICAL_PARDON_REVIEW",
        "prohibited_output": [
          "EXPUNGED",
          "SEALED",
          "RECORD_CLEARED"
        ],
        "authority_urls": [
          "[https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5](https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5)",
          "[https://www.justice.gov/archives/opa/pr/justice-department-announces-application-form-marijuana-pardon-certificates](https://www.justice.gov/archives/opa/pr/justice-department-announces-application-form-marijuana-pardon-certificates)",
          "[https://www.justice.gov/pardon/media/1398856/dl?inline](https://www.justice.gov/pardon/media/1398856/dl?inline)"
        ]
      }
    },
    {
      "change_id": "FED-V11-014",
      "action": "replace",
      "target": "federal_clemency_fee_fields",
      "original_v1_position": "No fee identified.",
      "v1_1_candidate_correction": {
        "value": "NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE",
        "display_behavior": "do_not_display_zero_or_free_guarantee",
        "requires_current_source_check": true
      }
    },
    {
      "change_id": "FED-V11-015",
      "action": "add",
      "target": "all_federal_rule_sources",
      "original_v1_position": "Source URLs and retrieval dates present but not uniformly normalized.",
      "v1_1_candidate_correction": {
        "required_source_fields": [
          "source_title",
          "source_authority",
          "source_quality_label",
          "source_url",
          "statute_or_rule_citation",
          "effective_date_if_shown",
          "text_currency_date_if_shown",
          "published_or_updated_date_if_shown",
          "retrieved_date",
          "source_snapshot_or_hash",
          "source_staleness_status"
        ]
      }
    },
    {
      "change_id": "FED-V11-016",
      "action": "add",
      "target": "all_federal_record_effect_rules",
      "original_v1_position": "Multiple relief effects described in prose.",
      "v1_1_candidate_correction": {
        "pathway_specific_record_effect_profile_required": true,
        "generic_record_erased_field_prohibited": true,
        "private_background_database_effect_default": "UNKNOWN_NOT_PROMISED",
        "court_or_executive_order_required_before_effect_assertion": true
      }
    }
  ]
}
```

# Final Red-Team Conclusion

Federal Candidate Package V1 must not be treated as production-ready or automatically ingestible as a deterministic legal-rule set without V1.1 conflict-resolution changes.

The controlling federal candidate-research conclusions are:

- Federal relief must remain a distinct jurisdiction model, not a state expungement variant.
- Presidential pardon, commutation, remission, reprieve, categorical pardon, statutory expungement, juvenile confidentiality, invalidity-based judicial relief, and firearm-disability relief are separate pathways.
- A calculated federal date is generally a milestone, filing-guidance estimate, or statutory dependency component, not a legal eligibility determination.
- § 3607 and § 844a are narrow statutory pathways requiring exact disposition classification and procedural verification.
- Federal judicial expungement/sealing requests require circuit, district, legal basis, and court-specific review.
- Federal firearm disability relief under § 925(c) cannot be converted into a self-service record-relief workflow without current official operational verification.
- Pardon and categorical marijuana pardon do not expunge convictions.
- No candidate rule may promise universal deletion from court, DOJ, FBI, agency, state, or private background-check records.
- Candidate data must remain behind FairPath’s source validation, conflict detection, stale-rule detection, engineering validation, human-verification, and publication gates.

PRODUCTION SAFETY BOUNDARY

This red-team package supersedes V1 only for candidate-research conflict resolution. It does not itself authorize publication. All federal legal rules, forms, fees, effective dates, clemency guidance, judicial authority, agency procedures, record effects, and eligibility logic remain subject to FairPath's validation and human-verification gates before production use.
```