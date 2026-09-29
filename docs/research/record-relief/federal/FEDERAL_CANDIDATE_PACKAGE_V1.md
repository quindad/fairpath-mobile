FEDERAL RECORD RELIEF — CANDIDATE RESEARCH PACKAGE V1

Package-Type: CANDIDATE_RESEARCH
Jurisdiction: Federal
Jurisdiction-Code: US-FED
Version: 1.0
Production-Status: NOT_APPROVED
Auto-Publish: FORBIDDEN
Human-Verification-Required: YES
Research-Status: CANDIDATE_RESEARCH_DATA
Research-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Default-Member-Facing-Outcome:
- MORE_INFORMATION_NEEDED
- MANUAL_REVIEW_REQUIRED
- RULE_NOT_VERIFIED
- POTENTIALLY_ELIGIBLE_FOR_REVIEW
Prohibited-Member-Facing-Outcomes:
- FEDERAL_CONVICTION_CAN_NEVER_BE_EXPUNGED
- PARDON_ERASES_CONVICTION
- COMMUTATION_ERASES_CONVICTION
- FIREARM_RELIEF_ERASES_CONVICTION
- AUTOMATIC_FEDERAL_RECORD_CLEARING
- LEGALLY_ELIGIBLE
- GUARANTEED_TO_BE_GRANTED

# Scope

This package covers adult-facing federal criminal-record and collateral-consequence relief mechanisms researched as of September 29, 2026.

Federal law must not be modeled as another state.

Federal relief mechanisms are structurally distinct from typical state sealing or expungement systems. This package preserves distinctions among:

- Presidential pardon.
- Commutation.
- Remission of fine or restitution.
- Reprieve.
- Categorical presidential marijuana pardon.
- Certificate of pardon for categorical marijuana pardon.
- 18 U.S.C. § 3607 pre-judgment probation and expungement.
- 21 U.S.C. § 844a civil controlled-substance penalty expungement.
- Federal juvenile-record confidentiality.
- Judicial expungement or sealing motions based on unlawful/invalid arrest or conviction.
- Vacatur/correction/resentencing remedies for invalid convictions.
- Firearm disability relief under 18 U.S.C. § 925(c).
- Record-effect distinctions.
- Federal-court/circuit-law limits.
- Federal executive clemency procedure.

This package is not legal advice. It does not decide individual eligibility. It does not authorize publication. It does not establish that FairPath can safely automate any federal pathway.

# Federal Architecture Warning

Federal criminal records can exist across multiple systems, including:

- United States district court records.
- United States Courts PACER/CM-ECF docket records.
- Department of Justice records.
- FBI criminal-history records.
- Bureau of Prisons records.
- Probation and pretrial-services records.
- Prosecutor records.
- Arresting-agency records.
- Agency records connected to specific programs.
- State or local records connected to federal cases.
- Private background-check databases.

A federal court order, executive clemency grant, expungement order, or correction of judgment may have different effects on different record custodians.

Do not promise deletion from private background-check databases unless a specific source supports that effect.

# Federal Legal Source Hierarchy

## PRIMARY_BINDING

- United States Constitution.
- United States Code.
- Code of Federal Regulations.
- Federal court orders and binding appellate decisions where necessary.
- Federal Rules when directly applicable.

## PRIMARY_OFFICIAL_GUIDANCE

- United States Department of Justice.
- Office of the Pardon Attorney.
- United States Courts.
- Official federal district court websites and local rules.
- Official federal agency guidance.

## OFFICIAL_FORM

- DOJ Office of the Pardon Attorney forms.
- Official federal court forms where a pathway is court-specific.
- Official agency application forms.

## LOCAL_OFFICIAL_PROCEDURE

- United States district court local rules.
- District-specific docketing, motion, filing-fee, and service procedures.

# Federal Candidate Pathway Inventory

1. Presidential pardon after completion of sentence.
2. Commutation of sentence.
3. Remission of fine or restitution.
4. Reprieve.
5. Categorical presidential pardon for qualifying federal, D.C. Code, and Code of Federal Regulations simple-possession, attempted-possession, or use of marijuana offenses covered by proclamations.
6. Certificate of pardon for qualifying categorical marijuana pardon.
7. 18 U.S.C. § 3607(a) pre-judgment probation for first-time simple possession.
8. 18 U.S.C. § 3607(c) expungement for qualifying persons under age 21 at offense who received § 3607(a) disposition.
9. 21 U.S.C. § 844a expungement after qualifying civil penalty disposition.
10. Federal juvenile record confidentiality under 18 U.S.C. § 5038.
11. Judicial expungement/sealing based on invalid or unlawful arrest/conviction, subject to federal court jurisdiction and circuit law.
12. Vacatur, correction, resentencing, or invalid-conviction relief, distinguished from ordinary record clearing.
13. Firearm relief from disabilities under 18 U.S.C. § 925(c), distinct from expungement, pardon, or record sealing.
14. Historical Federal Youth Corrections Act set-aside mechanism, repealed and not current general relief.

# Candidate Rule: Presidential Pardon

Rule-Identifier: US-FED-CLEMENCY-PRESIDENTIAL-PARDON
Jurisdiction: US-FED
Pathway-Name: Presidential Pardon
Pathway-Type: executive_clemency_pardon
Candidate-Version: 1.0
Effective-From: Constitutional authority; current DOJ clemency regulations and guidance must be versioned separately
Effective-To: null
Primary Authority:
- U.S. Constitution, Article II, Section 2, Clause 1.
- 28 C.F.R. §§ 0.35, 0.36, 1.1–1.11.
Official Sources:
- https://www.justice.gov/pardon
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960581/dl
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- MANUAL_REVIEW_REQUIRED
- COURT_DISCRETION: NO
- EXECUTIVE_DISCRETION: YES
- ENGINE_SCHEMA_GAP: YES

## What It Is

A presidential pardon is executive clemency. It is an expression of presidential forgiveness for a federal offense.

A pardon is distinct from:
- Expungement.
- Judicial sealing.
- Vacatur.
- Commutation.
- Firearm-rights relief.
- State pardon.
- D.C. local judicial record sealing.

## Potentially Applies To

A person with a federal conviction, D.C. Code conviction, or military conviction, subject to executive clemency process and applicable DOJ guidance.

The Office of the Pardon Attorney’s current application materials state that a person with a federal conviction who has finished sentence may use the pardon application process.

Official source:
- https://www.justice.gov/pardon/apply-clemency

## DOJ Waiting-Period Guidance

Current DOJ guidance states:

- No petition for pardon should be filed until at least five years after release from confinement.
- If no prison sentence was imposed, no petition should be filed until at least five years after conviction.
- Generally, no petition should be submitted by a person on probation, parole, or supervised release.

Authority:
- 28 C.F.R. Part 1 as described by DOJ.
- DOJ Legal Authority Governing Executive Clemency.

Official URL:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

## Clock Start

If incarcerated:
- Date of release from confinement.

If no prison sentence:
- Date of conviction.

Critical Distinction:
- This is DOJ clemency petition guidance/regulatory practice.
- It is not a statutory guarantee that a petition filed earlier is legally impossible.
- It is not an eligibility determination.
- It is not a record-clearing waiting period.

Automation Classification:
- DETERMINISTIC for five-year arithmetic only after verified relevant event.
- MEMBER_ASSERTED_FACT for sentence/release facts.
- MANUAL_REVIEW_REQUIRED for clemency process and exception questions.
- EXECUTIVE_DISCRETION.

## Sentence Completion / Supervision

Current DOJ guidance states that generally no pardon petition should be submitted while person is on probation, parole, or supervised release.

Authority:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Candidate Data Treatment:
- `supervision_status` is a required member fact.
- `supervision_status_evidence` is required for a filing-readiness screen.
- Do not treat satisfaction of five-year guidance as a legal entitlement to pardon.

## Effect of a Presidential Pardon

DOJ FAQ states that a pardon:

- Is an expression of the President’s forgiveness.
- May remove unpaid or unserved portions of sentence remaining at time pardon issued.
- Removes civil disabilities imposed because of conviction, such as restrictions on voting, holding state or local office, or jury service.
- Should lessen stigma arising from conviction.

DOJ materials also state that pardon cannot:

- Erase a conviction.
- Expunge a conviction.

Authority:
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960581/dl

Critical Effect Rule:
- Presidential pardon is not expungement.
- Presidential pardon is not sealing.
- Presidential pardon does not authorize FairPath to promise deletion, destruction, sealing, or removal of court, FBI, DOJ, PACER, state, private background-check, or other records.

## Filing Authority / Agency

- Petition addressed to President of the United States.
- Submitted to Office of the Pardon Attorney, U.S. Department of Justice.
- Military-offense procedures may differ.

Authority:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

## Forms

Official Form:
- Application for Pardon After Completion of Sentence.

Official URL:
- https://www.justice.gov/pardon/file/960581/dl

Form Scope:
- Federal executive clemency.
- Not a court record-clearing form.
- Not an expungement application.

Direct FairPath Link Status:
- Candidate only.
- Must revalidate active DOJ form/version and workflow before direct member link.

## Fees

Federal clemency application filing fee:
- No fee identified in retrieved DOJ clemency materials.

Candidate Fee Status:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

Do Not Infer:
- That every supporting document, legal representation, or ancillary record cost is free.
- That a pardon certificate/document process cannot change.

## Required Supporting Information

Official pardon application materials describe needing information about:

- Identity.
- Conviction.
- Criminal history.
- Reasons for seeking pardon.
- Current activities.
- Challenges arising from conviction.
- Letters of support.

Authority:
- https://www.justice.gov/pardon/file/960581/dl

## Manual Review Triggers

- Person is currently incarcerated.
- Person remains on probation, parole, or supervised release.
- Exact conviction jurisdiction is unclear.
- Person has state, federal, D.C., or military convictions mixed together.
- Member seeks record sealing/expungement rather than clemency.
- Member seeks firearm relief.
- Pardon applicability to immigration, licensing, or other collateral consequence is asserted.
- Clemency guidance, form, or regulations have changed.
- Applicant claims a prior presidential pardon.
- Special proclamation/categorical pardon may apply.

## Engine Schema Gap

Required support:
- Executive discretionary relief separate from judicial relief.
- Petition-readiness guidance separate from statutory eligibility.
- Pardon effect profile separate from record-clearing effect.
- Jurisdiction type: federal / D.C. Code / Uniform Code of Military Justice.
- Clemency document and condition tracking.
- No automatic outcome prediction.

# Candidate Rule: Commutation of Sentence

Rule-Identifier: US-FED-CLEMENCY-COMMUTATION
Jurisdiction: US-FED
Pathway-Name: Commutation of Sentence
Pathway-Type: executive_clemency_sentence_reduction
Candidate-Version: 1.0
Effective-From: Constitutional authority; current DOJ regulations/guidance versioned separately
Effective-To: null
Primary Authority:
- U.S. Constitution, Article II, Section 2, Clause 1.
- 28 C.F.R. §§ 0.35, 0.36, 1.1–1.11.
Official Sources:
- https://www.justice.gov/pardon
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960571/dl
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- MANUAL_REVIEW_REQUIRED
- EXECUTIVE_DISCRETION
- ENGINE_SCHEMA_GAP

## What It Is

A commutation reduces a sentence totally or partially that is being served.

It is distinct from:
- Pardon.
- Expungement.
- Sealing.
- Vacatur.
- Innocence finding.
- Firearm restoration.

## Potentially Applies To

Person sentenced by a federal court who seeks reduction of ongoing sentence.

Official source:
- https://www.justice.gov/pardon/apply-clemency

## Effect

DOJ FAQ states that a commutation:

- Reduces a sentence totally or partially.
- Does not change the fact of conviction.
- Does not imply innocence.
- Does not remove civil disabilities resulting from conviction.

Authority:
- https://www.justice.gov/pardon/frequently-asked-questions

Critical Effect Rule:
- Do not represent commutation as record expungement or sealing.
- Do not represent commutation as a vacatur or dismissal.
- Do not represent commutation as automatic restoration of civil rights.

## Remission Component

DOJ guidance states that commutation may include remission or reduction of unpaid criminal financial penalties such as fine or restitution.

Authority:
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960571/dl

Critical Limitation:
- Remission applies only to unpaid portions.
- It does not refund money already paid.
- It does not erase conviction.

## Filing Authority

- Petition to President through Office of the Pardon Attorney.

Official URLs:
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

## Form

Official Form:
- Commutation Instructions / commutation application process.

Official URL:
- https://www.justice.gov/pardon/file/960571/dl

Form Scope:
- Federal executive clemency.
- Not court record-clearing application.

## Fees

- No federal filing fee identified in retrieved DOJ guidance.

Candidate Fee Status:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

## Court Discretion

- No judicial eligibility decision.
- Presidential executive discretion controls ultimate relief.

## Manual Review Triggers

- Sentence type unclear.
- Applicant seeks remission of fine/restitution.
- Applicant has ongoing judicial or administrative remedies.
- Applicant seeks expungement or record clearing.
- Applicant has multiple convictions or state/federal mixed sentences.
- Commutation conditions or prior clemency action exist.

## Engine Schema Gap

Required support:
- Sentence-reduction relief.
- Financial-remission relief.
- Executive discretionary decision.
- Conditions attached to grant.
- Separation between sentence status and conviction status.

# Candidate Rule: Remission of Fine or Restitution

Rule-Identifier: US-FED-CLEMENCY-REMISSION
Jurisdiction: US-FED
Pathway-Name: Remission of Fine or Restitution
Pathway-Type: executive_clemency_financial_remission
Candidate-Version: 1.0
Effective-From: Constitutional authority; current DOJ regulations/guidance versioned separately
Effective-To: null
Primary Authority:
- U.S. Constitution, Article II, Section 2, Clause 1.
- 28 C.F.R. Part 1.
Official Sources:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/file/960571/dl
- https://www.justice.gov/pardon/frequently-asked-questions
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- MANUAL_REVIEW_REQUIRED
- EXECUTIVE_DISCRETION
- ENGINE_SCHEMA_GAP

## What It Is

Remission is executive clemency that can reduce unpaid criminal financial penalties, including fine or restitution.

It is distinct from:
- Expungement.
- Sealing.
- Pardon.
- Vacatur.
- Sentence completion.
- Repayment or refund of already paid amounts.

## Potentially Applies To

Person seeking reduction or remission of unpaid federal criminal fine or restitution through executive clemency.

## Effect

DOJ states remission applies only to financial penalty portion not already paid.

Authority:
- https://www.justice.gov/pardon/frequently-asked-questions
- https://www.justice.gov/pardon/file/960571/dl

## Filing

- Clemeny petition addressed to President and submitted to Office of the Pardon Attorney.
- Person seeking remission should state that request specifically and explain hardship/reasons.

Authority:
- https://www.justice.gov/pardon/file/960571/dl
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

## Waiting Period

- No independent fixed statutory waiting period identified in retrieved sources.
- DOJ commutation guidance warns that no commutation petition, including remission of fine, should be filed if other judicial or administrative relief is available, absent exceptional circumstances.

Authority:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Candidate Treatment:
- No deterministic wait-date.
- Manual review.

## Manual Review Triggers

- Restitution amount/status unclear.
- Financial penalty already paid.
- Other judicial/administrative remedy potentially available.
- Mixed fine, forfeiture, restitution, and special assessment issues.
- Request combined with pardon or commutation.
- Victim restitution rights or enforcement implications.

## Engine Schema Gap

Required support:
- Unpaid versus paid financial penalty allocation.
- Multiple financial obligation types.
- Executive relief separate from sentencing completion.
- Hardship narrative/documentation.
- Existing judicial/administrative remedies.

# Candidate Rule: Reprieve

Rule-Identifier: US-FED-CLEMENCY-REPRIEVE
Jurisdiction: US-FED
Pathway-Name: Reprieve
Pathway-Type: executive_clemency_temporary_delay
Candidate-Version: 1.0
Effective-From: Constitutional authority
Effective-To: null
Primary Authority:
- U.S. Constitution, Article II, Section 2, Clause 1.
- 28 C.F.R. Part 1.
Official Source:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- LOW_CONFIDENCE_MANUAL_REVIEW
- EXECUTIVE_DISCRETION
- ENGINE_SCHEMA_GAP

## What It Is

A reprieve is a form of executive clemency.

## Candidate Scope

- May delay execution or enforcement of sentence.
- Does not inherently seal, expunge, vacate, dismiss, or erase conviction.

## Candidate Treatment

- No ordinary record-relief eligibility logic.
- Manual legal and clemency review only.

## Engine Schema Gap

Required support:
- Temporary or conditional relief.
- Start/end dates.
- Conditions.
- Sentence enforcement status.
- Distinction from permanent sentence reduction and record relief.

# Candidate Rule: Categorical Marijuana Pardon

Rule-Identifier: US-FED-CLEMENCY-CATEGORICAL-MARIJUANA-PARDON
Jurisdiction: US-FED
Pathway-Name: Categorical Presidential Marijuana Pardon
Pathway-Type: executive_clemency_categorical_pardon
Candidate-Version: 1.0
Effective-From:
- 2022-10-06 for original proclamation.
- 2023-12-22 for expanded proclamation.
Effective-To: null
Primary Authority:
- Presidential proclamations as administered by DOJ.
- DOJ Office of the Pardon Attorney official guidance and certificate application.
Official Sources:
- https://www.justice.gov/archives/opa/pr/justice-department-announces-application-form-marijuana-pardon-certificates
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5
- https://www.justice.gov/archives/opa/pr/justice-department-statement-president-s-announcements-regarding-simple-possession-marijuana
- https://www.justice.gov/pardon/media/1398856/dl?inline
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- MANUAL_REVIEW_REQUIRED
- FUTURE_EFFECTIVE: NO
- EXECUTIVE_CLEMENCY
- ENGINE_SCHEMA_GAP

## What It Is

A categorical presidential pardon covers qualifying federal, D.C. Code, and Code of Federal Regulations offenses for simple possession, attempted possession, or use of marijuana, as stated by DOJ’s current certificate application page.

It is not:
- Expungement.
- Sealing.
- Vacatur.
- Dismissal.
- State marijuana relief.
- A generic marijuana-conviction-clearing mechanism.

## Potentially Applies To

Current official DOJ certificate application states a person qualifies if:

- On or before December 22, 2023, person was charged with or convicted of simple possession, attempted possession, or use of marijuana under federal code, D.C. code, or Code of Federal Regulations.
- Person was a U.S. citizen or lawfully present in the United States at time of offense.

Official source:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

## Effect

DOJ official certificate application states:

- A pardon is an expression of President’s forgiveness.
- It does not mean person is innocent.
- It does not expunge conviction.

Authority:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Critical Effect Rule:
- Do not label categorical marijuana pardon as expungement or sealing.
- Do not promise court record removal.
- Do not promise state record relief.
- Do not promise private-background-check deletion.

## Certificate of Pardon

Purpose:
- Certificate is proof person was pardoned under proclamation.

DOJ states:
- Certificate is the only documentation person receives of pardon.

Official application:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Official 2023 DOJ announcement:
- https://www.justice.gov/archives/opa/pr/justice-department-announces-application-form-marijuana-pardon-certificates

## Required Facts

- Federal, D.C. Code, or Code of Federal Regulations charging/conviction authority.
- Exact offense statute/code.
- Offense date.
- Charge/disposition.
- Citizenship or lawful-presence status at time of offense.
- Whether conduct falls within simple possession, attempted possession, or use as covered.
- Supporting official record/document.

## Manual Review Triggers

- Charge is distribution, possession with intent, trafficking, cultivation, or any offense beyond simple possession/attempted possession/use.
- Offense date after December 22, 2023.
- Jurisdiction unclear.
- Immigration status at offense unclear.
- Member seeks expungement/sealing.
- State marijuana conviction involved.
- Federal and state charges are mixed.
- Military conviction involved.
- Record shows multiple offenses.

## Engine Schema Gap

Required support:
- Categorical executive grant.
- Proclamation date/version.
- Offense-specific scope.
- Citizenship/lawful-presence facts.
- Certificate application separate from pardon effect.
- Federal/D.C./CFR jurisdiction distinction.
- Explicit “not expunged” record-effect status.

# Candidate Rule: 18 U.S.C. § 3607(a) Pre-Judgment Probation

Rule-Identifier: US-FED-18USC3607-PREJUDGMENT-PROBATION
Jurisdiction: US-FED
Pathway-Name: Special Probation for Drug Possessors
Pathway-Type: pre_judgment_probation_nonconviction_disposition
Candidate-Version: 1.0
Effective-From: Current United States Code text retrieved September 2026
Effective-To: null
Primary Authority:
- 18 U.S.C. § 3607(a)-(b).
Official Source:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- CLASSIFICATION_REQUIRED
- COURT_DISCRETION
- ENGINE_SCHEMA_GAP

## What It Is

A federal court may, with consent of person, place person on probation without entering judgment of conviction for a qualifying first federal simple-possession offense.

It is a special disposition, not ordinary post-conviction expungement.

## Potentially Applies To

Person found guilty of an offense under 21 U.S.C. § 844 who:

- Has not, before commission of the offense, been convicted of violating a federal or state law relating to controlled substances.
- Has not previously been the subject of disposition under 18 U.S.C. § 3607(a).

Court may place person on probation for not more than one year without entering judgment of conviction, with consent of person.

Authority:
- 18 U.S.C. § 3607(a).

## Sentence Completion

If person does not violate condition of probation, court shall, without entering judgment of conviction, dismiss proceedings and discharge person from probation at expiration of term.

Authority:
- 18 U.S.C. § 3607(a).

## Record Effect

A disposition under § 3607(a):

- Is not considered a conviction for purpose of a disqualification or disability imposed by law upon conviction of crime, or for any other purpose.
- Has a nonpublic DOJ record retained solely for court use in later proceedings to determine eligibility for § 3607 disposition or expungement.

Authority:
- 18 U.S.C. § 3607(b).

Critical Effect Rule:
- § 3607(a) disposition is not the same as § 3607(c) expungement.
- Nonpublic DOJ record retention remains.
- Do not call a § 3607(a) disposition “expunged” unless § 3607(c) order has been entered.

## Filing / Procedure

- Disposition occurs in federal criminal case.
- No standalone post-conviction petition form identified in this research for § 3607(a) because it is a sentencing/disposition mechanism.
- Court consent/person consent and eligibility are required.

## Automation Classification

- CLASSIFICATION_REQUIRED for exact offense and prior controlled-substance history.
- MEMBER_ASSERTED_FACT for history if official records incomplete.
- COURT_DISCRETION.
- MANUAL_REVIEW_REQUIRED.
- Not a general FairPath adult post-conviction filing pathway.

## Engine Schema Gap

Required support:
- Pre-judgment disposition.
- Conviction status distinct from guilty finding and sentencing status.
- Prior controlled-substance offense history.
- Court consent.
- Nonpublic retained record.
- Eligibility at time of original case, not merely later application date.

# Candidate Rule: 18 U.S.C. § 3607(c) Expungement

Rule-Identifier: US-FED-18USC3607-EXPUNGEMENT
Jurisdiction: US-FED
Pathway-Name: Expungement of Record of Disposition for Qualifying Drug Possessor Under 21
Pathway-Type: statutory_judicial_expungement
Candidate-Version: 1.0
Effective-From: Current United States Code text retrieved September 2026
Effective-To: null
Primary Authority:
- 18 U.S.C. § 3607(c).
- 18 U.S.C. § 3607(b).
- 21 U.S.C. § 844.
Official Sources:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- CLASSIFICATION_REQUIRED
- MANUAL_REVIEW_REQUIRED
- COURT_ORDER_REQUIRED
- ENGINE_SCHEMA_GAP

## Potentially Applies To

Person who:

- Was found guilty of offense under 21 U.S.C. § 844.
- Received disposition under 18 U.S.C. § 3607(a).
- Was less than 21 years old at time of offense.
- Applies for expungement.

Authority:
- 18 U.S.C. § 3607(c).

## Waiting Period

No additional express duration is stated in § 3607(c).

Clock Start:
- Eligibility depends on qualifying § 3607(a) disposition and age at offense.
- § 3607(a) dismissal occurs after successful probation completion.
- Application can be made after qualifying disposition; exact procedural timing requires court-specific review.

Critical Warning:
- Do not invent a general “one year after probation” filing rule.
- The statute does not provide a generic post-disposition waiting period in the retrieved text.

## Effect of Relief

Court shall enter expungement order upon application of qualifying person.

Order directs expungement from all official records, except nonpublic records referred to in § 3607(b), of:

- Arrest.
- Institution of criminal proceedings.
- Results of proceedings.

Effect:
- Restores person, in contemplation of law, to status occupied before arrest or institution of criminal proceedings.
- Person cannot be held guilty of perjury, false swearing, or making false statement because of failure to recite or acknowledge covered arrest/proceeding/results.

Authority:
- 18 U.S.C. § 3607(c).

Critical Limitation:
- Nonpublic records under § 3607(b) remain retained by DOJ solely for future court eligibility determinations under § 3607.
- Do not promise all federal records are destroyed in every system.
- Do not promise private database deletion.

## Court / Filing

- Federal court that handled qualifying § 3607(a) case.
- Exact motion form, docket procedure, fee, service, and local rule requirements were not identified in this candidate package.

Candidate Procedure Status:
- LOCAL_FEDERAL_COURT_PROCEDURE_REQUIRED.

## Fees

- No statutory filing fee identified in § 3607.
- Candidate value: UNKNOWN_VERIFY_RELEVANT_FEDERAL_COURT.

## Required Facts

- Exact offense statute.
- § 844 offense confirmation.
- § 3607(a) disposition order.
- Date of offense.
- Date of birth/age at offense.
- Probation/disposition history.
- Federal district court.
- Official case docket/order.

## Manual Review Triggers

- Person was 21 or older at offense.
- No proof of § 3607(a) disposition.
- Conviction/judgment entered.
- Offense not § 844.
- State drug case rather than federal case.
- Court local procedure unknown.
- Record effect requested beyond statutory scope.

## Engine Schema Gap

Required support:
- Age at offense.
- Pre-judgment versus judgment-of-conviction status.
- Statutory disposition history.
- Official-record expungement with defined DOJ nonpublic retention exception.
- Federal district court local procedure.
- Court order required before effect.

# Candidate Rule: 21 U.S.C. § 844a Civil-Penalty Expungement

Rule-Identifier: US-FED-21USC844A-CIVIL-PENALTY-EXPUNGEMENT
Jurisdiction: US-FED
Pathway-Name: Civil Penalty Controlled Substance Expungement
Pathway-Type: statutory_administrative_expungement
Candidate-Version: 1.0
Effective-From: Current United States Code text retrieved September 2026
Effective-To: null
Primary Authority:
- 21 U.S.C. § 844a.
Official Source:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- CLASSIFICATION_REQUIRED
- MANUAL_REVIEW_REQUIRED
- AGENCY_DETERMINATION_REQUIRED
- ENGINE_SCHEMA_GAP

## Potentially Applies To

Individual assessed a civil penalty under 21 U.S.C. § 844a for qualifying possession conduct, subject to statutory requirements.

## Waiting Period

Waiting Period:
- Three years.

Clock Start:
- Expiration of three years after qualifying civil-penalty disposition.

Authority:
- 21 U.S.C. § 844a(j), as reflected in official United States Code text.

## Required Conditions

Attorney General shall dismiss proceedings upon application after three years if:

- Individual has not previously been assessed civil penalty under § 844a.
- Individual has paid assessment.
- Individual has complied with any conditions imposed by Attorney General.
- Individual has not been convicted of a federal or state offense relating to controlled substances.
- Individual agrees to drug test and test shows individual drug free.

Authority:
- 21 U.S.C. § 844a(j).

## Record Effect

- A nonpublic record of disposition is retained by DOJ solely to determine later qualification for civil penalty or expungement.
- If record expunged, person may not be held guilty of perjury, false swearing, or false statement for failure to acknowledge proceeding/results.

Authority:
- 21 U.S.C. § 844a(j).

Critical Limitation:
- This is not general federal marijuana expungement.
- This is not a general federal conviction expungement pathway.
- It is tied to civil-penalty system and statutory requirements.

## Filing Authority

- Application to Attorney General as statute specifies.
- Current DOJ form/procedure not identified in this candidate package.

Candidate Procedure Status:
- OFFICIAL_AGENCY_PROCEDURE_NOT_VERIFIED.

## Fees

- No filing fee identified in retrieved statute text.
- Candidate value: UNKNOWN_VERIFY_AGENCY_PROCEDURE.

## Required Facts

- Civil penalty assessment under § 844a.
- Date of assessment/disposition.
- Prior § 844a assessment status.
- Payment status.
- Conditions imposed and compliance.
- Federal/state controlled-substance conviction history.
- Drug-test agreement/result.
- Agency documentation.

## Automation Classification

- DETERMINISTIC for three-year arithmetic after verified assessment/disposition event.
- MEMBER_ASSERTED_FACT.
- CLASSIFICATION_REQUIRED.
- MANUAL_REVIEW_REQUIRED.
- AGENCY_DETERMINATION_REQUIRED.

## Engine Schema Gap

Required support:
- Civil penalty distinct from criminal conviction.
- Attorney General-imposed conditions.
- Payment/assessment status.
- Drug-test requirement/result.
- Federal and state drug-offense history.
- DOJ nonpublic record retention.

# Candidate Rule: Federal Juvenile Record Confidentiality

Rule-Identifier: US-FED-18USC5038-JUVENILE-RECORD-CONFIDENTIALITY
Jurisdiction: US-FED
Pathway-Name: Federal Juvenile Delinquency Record Confidentiality
Pathway-Type: statutory_record_confidentiality
Candidate-Version: 1.0
Effective-From: Current United States Code text retrieved September 2026
Effective-To: null
Primary Authority:
- 18 U.S.C. § 5038.
Official Source:
- https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE
- MANUAL_REVIEW_REQUIRED
- ENGINE_SCHEMA_GAP

## What It Is

Federal juvenile delinquency record confidentiality and safeguarded access.

It is not:
- General adult expungement.
- Automatic destruction.
- General federal sealing order.
- A guarantee no agency can access record.

## Record Effect

Federal juvenile records must be safeguarded from unauthorized disclosure throughout and upon completion of juvenile delinquency proceeding.

Statute permits release in listed circumstances including:

- Another court of law.
- Presentence-report agency for another court.
- Law enforcement investigation or law-enforcement employment inquiry.
- Treatment/facility agencies.
- National security position consideration.
- Victim inquiry related to final disposition.

Unless otherwise authorized, juvenile record information may not be released for employment, license, bonding, civil right, or privilege request, and responses should not differ from those for person never involved in delinquency proceeding.

Authority:
- 18 U.S.C. § 5038(a).

## Applicability to FairPath Adult Users

Adult user may have a federal juvenile record.

Candidate Rule:
- Treat as a juvenile confidentiality pathway, not adult conviction expungement.
- Require confirmation person was handled under federal juvenile delinquency proceeding rather than prosecuted as adult.

## Manual Review Triggers

- Person was prosecuted as adult.
- Record holder/custodian uncertain.
- Request involves law enforcement, national security, immigration, licensing, firearm, or victim access.
- Member asks for destruction/expungement rather than confidentiality.
- Federal and state juvenile records mixed.

## Engine Schema Gap

Required support:
- Record-access rule rather than filing eligibility.
- Authorized-recipient categories.
- Juvenile proceeding versus adult prosecution.
- Confidentiality effect with exceptions.
- No generic sealed/expunged Boolean.

# Candidate Rule: Judicial Expungement or Sealing for Invalid or Unlawful Arrest/Conviction

Rule-Identifier: US-FED-JUDICIAL-EXPUNGEMENT-INVALIDITY
Jurisdiction: US-FED
Pathway-Name: Judicial Expungement or Sealing Based on Invalidity or Unlawfulness
Pathway-Type: limited_judicial_equitable_or_ancillary_relief
Candidate-Version: 1.0
Effective-From: Circuit-specific and fact-specific
Effective-To: null
Primary Authority:
- Federal constitutional and jurisdictional principles.
- Binding appellate precedent varies by circuit.
Official Sources:
- https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf
- https://www2.ca3.uscourts.gov/opinarch/053425p.pdf
- https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf
- https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0
- https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- LOW_CONFIDENCE_MANUAL_REVIEW
- CONFLICTING_AUTHORITY
- ENGINE_SCHEMA_GAP
- COURT_DISCRETION
- CIRCUIT_LAW_REQUIRED

## Candidate Research Finding

There is no identified general federal statutory pathway allowing a federal district court to expunge a lawful conviction on purely equitable grounds.

Multiple official federal court decisions state that federal courts have limited jurisdiction and, after Kokkonen-related analysis, may lack ancillary jurisdiction for equitable expungement of lawful conviction records where the validity of arrest or conviction is not challenged.

Examples:

First Circuit:
- United States v. Coloian, official court opinion.
- Court concluded district court did not have jurisdiction to expunge criminal record on equitable grounds.

Official URL:
- https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf

Third Circuit:
- Official court opinion stating jurisdiction may exist in narrow circumstances where predicate is challenge to validity of arrest or conviction.

Official URL:
- https://www2.ca3.uscourts.gov/opinarch/053425p.pdf

Eleventh Circuit:
- United States v. Batmasian official opinion.
- Court noted no federal statute authorized district court to hear the type of expungement motion brought and discussed limited ancillary jurisdiction.

Official URL:
- https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf

Seventh Circuit:
- Official opinion concluding ancillary jurisdiction does not extend to purely equitable expungement petition.

Official URL:
- https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0

West Virginia federal district court:
- Official order stating court lacked authority to expunge lawful misdemeanor conviction or alter NCIC report in case described.

Official URL:
- https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf

## Critical Rule

Do not state:
- Federal convictions can never be expunged.
- Federal courts always have inherent equitable expungement authority.
- A federal court can expunge a lawful conviction because it causes employment hardship.
- A federal pardon automatically gives court expungement authority.

## Potentially Relevant Circumstances

A judicial record-relief motion may require legal analysis where:

- Arrest or conviction was allegedly unlawful or unconstitutional.
- Conviction was invalidated.
- Arrest/prosecution violated federal statute or Constitution.
- Specific federal statute authorizes expungement.
- Court needs to manage its own proceedings or effectuate decree.
- Circuit precedent permits a narrow form of relief.

## Filing Court

- Usually the relevant United States district court, subject to jurisdiction and local procedure.
- Exact filing vehicle, jurisdiction, fee, motion form, service, and circuit precedent require legal review.

## Candidate Output

- MANUAL_REVIEW_REQUIRED.
- RULE_NOT_VERIFIED for any circuit-specific conclusion not researched.
- Do not produce general eligibility result.

## Engine Schema Gap

Required support:
- Federal circuit.
- Federal district court.
- Legal basis of claimed invalidity.
- Underlying order or appellate mandate.
- Constitutional/statutory challenge status.
- Circuit precedent status.
- Local federal court procedure.
- Distinguish jurisdictional absence from discretionary denial.
- Distinguish court-record action from agency/FBI record action.

# Candidate Rule: Vacatur, Correction, Resentencing, or Invalid-Conviction Relief

Rule-Identifier: US-FED-INVALID-CONVICTION-RELIEF
Jurisdiction: US-FED
Pathway-Name: Vacatur, Correction, Resentencing, or Relief from Invalid Conviction
Pathway-Type: post_conviction_judicial_relief_not_ordinary_record_clearing
Candidate-Version: 1.0
Effective-From: Varies by statutory and procedural mechanism
Effective-To: null
Primary Authority:
- Depends on mechanism, including federal post-conviction statutes, Federal Rules, appellate mandate, or constitutional basis.
Official Source Status:
- Specific pathway research not completed in this candidate package.
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- UNSUPPORTED_FOR_GENERAL_RULE
- MANUAL_REVIEW_REQUIRED
- ENGINE_SCHEMA_GAP

## Candidate Research Finding

Vacatur, correction of sentence, resentencing, reversal, and invalid-conviction remedies are legally distinct from ordinary expungement, sealing, executive pardon, commutation, or firearm disability relief.

No generalized candidate eligibility rule is supplied in this package.

## Required Treatment

- Do not map a vacatur request to ordinary record clearing.
- Do not call a corrected sentence an expungement.
- Do not call reversal or dismissal after invalidation automatic record sealing.
- Require pathway-specific legal research and court-order analysis.

## Candidate Output

- RULE_NOT_VERIFIED.
- MANUAL_REVIEW_REQUIRED.

## Engine Schema Gap

Required support:
- Court-order type.
- Underlying legal basis.
- Conviction status after order.
- Sentence status after order.
- Appeal status.
- Mandate/finality.
- Record-custodian effects.
- Separate relief effect from underlying judgment status.

# Candidate Rule: Firearm Disability Relief

Rule-Identifier: US-FED-18USC925C-FIREARM-DISABILITY-RELIEF
Jurisdiction: US-FED
Pathway-Name: Relief From Federal Firearm Disabilities
Pathway-Type: collateral_consequence_firearm_relief
Candidate-Version: 1.0
Effective-From: Current United States Code text retrieved September 2026
Effective-To: null
Primary Authority:
- 18 U.S.C. § 925(c).
Official Source:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HIGH_CONFIDENCE_CANDIDATE_FOR_STATUTORY_TEXT
- LOW_CONFIDENCE_MANUAL_REVIEW_FOR_OPERATIONAL_AVAILABILITY
- ENGINE_SCHEMA_GAP
- AGENCY_DETERMINATION_REQUIRED

## What It Is

18 U.S.C. § 925(c) provides a statutory application route for a person prohibited from possessing, shipping, transporting, or receiving firearms or ammunition to seek relief from federal firearm disabilities.

It is distinct from:
- Expungement.
- Sealing.
- Pardon.
- Set-aside.
- General restoration of all civil rights.
- State firearm restoration.
- Federal record clearing.

## Statutory Standard

Applicant may apply to Attorney General for relief from disabilities imposed by federal law related to acquisition, receipt, transfer, shipment, transportation, or possession of firearms or ammunition.

Attorney General may grant relief if satisfied that:

- Circumstances regarding disability and applicant’s record/reputation indicate applicant will not likely act dangerously to public safety.
- Grant would not be contrary to public interest.

Authority:
- 18 U.S.C. § 925(c).

## Judicial Review

A person whose application is denied may petition United States district court for judicial review in district where person resides.

Authority:
- 18 U.S.C. § 925(c).

## Operational Availability Warning

This candidate package does not verify current congressional appropriations restrictions, agency processing availability, or current ATF/DOJ implementation status.

Candidate Status:
- STATUTORY_PATHWAY_EXISTS_OPERATIONAL_AVAILABILITY_NOT_VERIFIED.

Do Not:
- Tell member that Attorney General/ATF application is currently processed.
- Tell member firearm rights are restored.
- Treat this as a record-relief pathway.
- Treat it as expungement.

## Filing Authority

- Attorney General under statute.
- District court review after denial as statute specifies.

## Fees and Forms

- Current official application form and fee were not verified in this candidate package.

Candidate Values:
- FORM_NOT_VERIFIED.
- FEE_UNKNOWN.
- OPERATIONAL_AVAILABILITY_NOT_VERIFIED.

## Engine Schema Gap

Required support:
- Collateral consequence separate from record clearing.
- Firearm-disability source.
- Federal versus state disability.
- Agency application availability.
- Appropriations/implementation status.
- Public-safety and public-interest standards.
- Denial and judicial-review event.
- Residence district for review.

# Historical Mechanism: Federal Youth Corrections Act Set-Aside

Rule-Identifier: US-FED-HISTORICAL-YCA-SETAIDE
Jurisdiction: US-FED
Pathway-Name: Federal Youth Corrections Act Set-Aside
Pathway-Type: historical_repealed_mechanism
Candidate-Version: 1.0
Effective-From: historical only
Effective-To: Repealed effective January 1, 1987
Primary Authority:
- Historical 18 U.S.C. § 5021.
Official Source:
- https://uscode.house.gov/view.xhtml;jsessionid=99193D587D9C9A87F8FAD4220D006DE5?req=granuleid:USC-1994-title18-part4&saved=%7CZ3JhbnVsZWlkOlVTQy0xOTk0LXRpdGxlMTgtcGFydDQtZnJvbnQ=%7C%7C0%7Cfalse%7C1994&edition=1994
Retrieved-Date: 2026-09-29
Last-Verified-Date: 2026-09-29
Candidate Classification:
- HISTORICAL_ONLY
- MANUAL_REVIEW_REQUIRED
- ENGINE_SCHEMA_GAP

## Candidate Research Finding

Historical 18 U.S.C. § 5021 provided for certificates setting aside convictions of youth offenders.

It was repealed effective January 1, 1987.

## Required Treatment

- Do not offer as current general federal relief.
- Preserve only as historical-law issue requiring manual review where a member presents historical Youth Corrections Act records or certificate.

# Federal Forms Register

## Application for Pardon After Completion of Sentence

Form Name:
- Application for Pardon After Completion of Sentence.

Issuing Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Relief Pathway:
- Presidential pardon.

Scope:
- Federal executive clemency.
- Not judicial expungement.
- Not sealing.
- Not commutation.

Official URL:
- https://www.justice.gov/pardon/file/960581/dl

Instructions / Information URL:
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Format:
- PDF.

Last Updated:
- Verify current version before direct linking; retrieved source appears current in 2026 research context but form/version metadata must be captured at ingestion.

Safe for FairPath to Link:
- Candidate only.
- Must validate active official form version and policy before linking.

## Commutation Instructions

Form Name:
- Commutation Instructions.

Issuing Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Relief Pathway:
- Commutation and remission request.

Official URL:
- https://www.justice.gov/pardon/file/960571/dl

Instructions URL:
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Format:
- PDF.

Safe for FairPath to Link:
- Candidate only.
- Must validate current active form/workflow before member display.

## Application for Certificate of Pardon for Categorical Marijuana Pardon

Form Name:
- Application for Certificate of Pardon.

Issuing Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Relief Pathway:
- Certificate of pardon for qualifying categorical marijuana pardon.

Official URL:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Format:
- Web form.

Safe for FairPath to Link:
- Candidate only.
- Must validate active form and proclamation scope before direct member use.

## 18 U.S.C. § 3607(c) Court Filing Form

Status:
- No universal federal judiciary form identified in this candidate package.

Scope:
- Federal district court-specific procedure.

Candidate Treatment:
- LOCAL_FEDERAL_COURT_PROCEDURE_REQUIRED.

## 21 U.S.C. § 844a Expungement Application Form

Status:
- Current official agency form not identified in this candidate package.

Candidate Treatment:
- OFFICIAL_AGENCY_PROCEDURE_NOT_VERIFIED.

## 18 U.S.C. § 925(c) Firearm Disability Relief Form

Status:
- Current official application form and operational availability not verified in this candidate package.

Candidate Treatment:
- FORM_NOT_VERIFIED.
- OPERATIONAL_AVAILABILITY_NOT_VERIFIED.

# Federal Fees Register

## Presidential Pardon

Fee:
- No fee identified in retrieved DOJ guidance.

Status:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

## Commutation / Remission

Fee:
- No fee identified in retrieved DOJ guidance.

Status:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

## Categorical Marijuana Pardon Certificate

Fee:
- No fee identified in retrieved official application page.

Status:
- NO_FEE_IDENTIFIED_IN_RETRIEVED_OFFICIAL_GUIDANCE.

## 18 U.S.C. § 3607(c)

Fee:
- Not stated in retrieved statute.

Status:
- UNKNOWN_VERIFY_RELEVANT_FEDERAL_COURT.

## 21 U.S.C. § 844a

Fee:
- Not stated in retrieved statute.

Status:
- UNKNOWN_VERIFY_AGENCY_PROCEDURE.

## 18 U.S.C. § 925(c)

Fee:
- Not verified.

Status:
- FEE_UNKNOWN.

# Federal Source Register

## United States Constitution

Source Title:
- Constitution of the United States, Article II, Section 2, Clause 1.

Authority:
- PRIMARY_BINDING.

Supports:
- Presidential executive clemency power.

URL:
- Official constitutional source to be added during formal source normalization.

Research Note:
- Current package relies on DOJ official clemency sources for operational procedure.

## Office of the Pardon Attorney

Source Title:
- Office of the Pardon Attorney.

Authority:
- U.S. Department of Justice.

Quality Label:
- PRIMARY_OFFICIAL_GUIDANCE.

URL:
- https://www.justice.gov/pardon

Supports:
- Executive clemency overview.

Retrieved Date:
- 2026-09-29.

## Apply for Clemency

Source Title:
- Apply for Clemency.

Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Quality Label:
- PRIMARY_OFFICIAL_GUIDANCE.

URL:
- https://www.justice.gov/pardon/apply-clemency

Supports:
- Pardon versus commutation routing.

Retrieved Date:
- 2026-09-29.

## Legal Authority Governing Executive Clemency

Source Title:
- Legal Authority Governing Executive Clemency.

Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Quality Label:
- PRIMARY_OFFICIAL_GUIDANCE.

URL:
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency

Supports:
- 28 C.F.R. authority.
- Petition procedures.
- Pardon waiting-period guidance.
- Supervision guidance.
- Commutation/remission process.

Published Date:
- 2025-04-22.

Retrieved Date:
- 2026-09-29.

## Office of the Pardon Attorney Frequently Asked Questions

Source Title:
- Frequently Asked Questions.

Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Quality Label:
- PRIMARY_OFFICIAL_GUIDANCE.

URL:
- https://www.justice.gov/pardon/frequently-asked-questions

Supports:
- Pardon effect.
- Commutation effect.
- Remission effect.
- Distinction from expungement.

Retrieved Date:
- 2026-09-29.

## Pardon Application PDF

Source Title:
- Application for Pardon After Completion of Sentence.

Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Quality Label:
- OFFICIAL_FORM.

URL:
- https://www.justice.gov/pardon/file/960581/dl

Supports:
- Form purpose.
- Pardon cannot erase/expunge conviction.
- Supporting-information expectations.

Retrieved Date:
- 2026-09-29.

## Commutation Instructions PDF

Source Title:
- Commutation Instructions.

Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Quality Label:
- OFFICIAL_FORM.

URL:
- https://www.justice.gov/pardon/file/960571/dl

Supports:
- Commutation.
- Remission request.
- Pardon wait guidance.
- Judicial/administrative-relief warning.

Retrieved Date:
- 2026-09-29.

## 18 U.S.C. § 3607

Source Title:
- 18 U.S.C. § 3607 | Special probation and expungement procedures for drug possessors.

Authority:
- United States Code, Office of the Law Revision Counsel, U.S. House of Representatives.

Quality Label:
- PRIMARY_BINDING.

URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim

Supports:
- Pre-judgment probation.
- Nonconviction disposition.
- Expungement for qualifying person under 21 at offense.
- Nonpublic DOJ record retention.
- Effect of expungement.

Text Currency Shown:
- Laws in effect on September 8, 2026.

Retrieved Date:
- 2026-09-29.

## 21 U.S.C. § 844 and § 844a

Source Title:
- 21 U.S.C. Chapter 13, Subchapter I, Part D.

Authority:
- United States Code, Office of the Law Revision Counsel, U.S. House of Representatives.

Quality Label:
- PRIMARY_BINDING.

URL:
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD

Supports:
- Controlled-substance simple possession context.
- Civil penalty procedure.
- § 844a expungement conditions.
- Nonpublic DOJ record retention.

Retrieved Date:
- 2026-09-29.

## 18 U.S.C. § 5038

Source Title:
- 18 U.S.C. Chapter 403 | Juvenile Delinquency.

Authority:
- United States Code, Office of the Law Revision Counsel, U.S. House of Representatives.

Quality Label:
- PRIMARY_BINDING.

URL:
- https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim

Supports:
- Federal juvenile record confidentiality.
- Authorized disclosure categories.
- Employment/license/bonding/civil-right response rules.

Retrieved Date:
- 2026-09-29.

## 18 U.S.C. § 925(c)

Source Title:
- 18 U.S.C. § 925 | Exceptions: Relief from disabilities.

Authority:
- United States Code, Office of the Law Revision Counsel, U.S. House of Representatives.

Quality Label:
- PRIMARY_BINDING.

URL:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim

Supports:
- Federal firearm disability relief statutory text.
- Attorney General application.
- Public safety/public interest standard.
- Judicial review after denial.

Text Currency Shown:
- Laws in effect on September 12, 2026.

Retrieved Date:
- 2026-09-29.

## Categorical Marijuana Pardon Certificate Application

Source Title:
- Application for Certificate of Pardon.

Authority:
- U.S. Department of Justice, Office of the Pardon Attorney.

Quality Label:
- PRIMARY_OFFICIAL_GUIDANCE.
- OFFICIAL_FORM.

URL:
- https://www.justice.gov/iqextranet/EForm.aspx?__cid=Pardon_prod&__fid=5

Supports:
- 2022/2023 categorical marijuana pardon scope.
- Citizenship/lawful-presence criteria.
- Certificate purpose.
- Pardon does not expunge conviction.

Retrieved Date:
- 2026-09-29.

## DOJ Marijuana Pardon Certificate Announcement

Source Title:
- Justice Department Announces Application Form for Marijuana Pardon Certificates.

Authority:
- U.S. Department of Justice.

Quality Label:
- PRIMARY_OFFICIAL_GUIDANCE.

URL:
- https://www.justice.gov/archives/opa/pr/justice-department-announces-application-form-marijuana-pardon-certificates

Published Date:
- 2023-03-03.

Supports:
- 2022 proclamation implementation.
- Certificate process.
- Federal/D.C. simple possession scope as described.

Retrieved Date:
- 2026-09-29.

## Official Federal Court Decisions

### United States v. Coloian

Authority:
- United States Court of Appeals for the First Circuit.

Quality Label:
- PRIMARY_BINDING_OR_PERSUASIVE_DEPENDING_ON_FORUM.

URL:
- https://media.ca1.uscourts.gov/pdf.opinions/06-1357-01A.pdf

Supports:
- Limits on federal equitable expungement jurisdiction.

Retrieved Date:
- 2026-09-29.

### Third Circuit Official Opinion

Authority:
- United States Court of Appeals for the Third Circuit.

Quality Label:
- PRIMARY_BINDING_OR_PERSUASIVE_DEPENDING_ON_FORUM.

URL:
- https://www2.ca3.uscourts.gov/opinarch/053425p.pdf

Supports:
- Narrow jurisdiction where predicate challenges validity of arrest or conviction.

Retrieved Date:
- 2026-09-29.

### United States v. Batmasian

Authority:
- United States Court of Appeals for the Eleventh Circuit.

Quality Label:
- PRIMARY_BINDING_OR_PERSUASIVE_DEPENDING_ON_FORUM.

URL:
- https://media.ca11.uscourts.gov/opinions/pub/files/202112800.op2.pdf

Supports:
- No general statutory authority for equitable expungement motion; ancillary-jurisdiction analysis.

Retrieved Date:
- 2026-09-29.

### Seventh Circuit Official Opinion

Authority:
- United States Court of Appeals for the Seventh Circuit.

Quality Label:
- PRIMARY_BINDING_OR_PERSUASIVE_DEPENDING_ON_FORUM.

URL:
- https://media.ca7.uscourts.gov/cgi-bin/rssExec.pl?Submit=Display&Path=Y2017/D03-02/C:15-2094:J:Sykes:aut:T:fnOp:N:1922190:S:0

Supports:
- Ancillary jurisdiction does not extend to purely equitable expungement petition.

Retrieved Date:
- 2026-09-29.

### Smith Order

Authority:
- United States District Court for the Southern District of West Virginia.

Quality Label:
- LOCAL_FEDERAL_COURT_AUTHORITY.

URL:
- https://www.wvsd.uscourts.gov/sites/wvsd/files/opinions/Smith%20--%20Order%20Denying%20Motion%20to%20Expunge%20--%20For%20Entry.pdf

Supports:
- Example of limited federal court jurisdiction and denial of lawful-conviction expungement request.

Retrieved Date:
- 2026-09-29.

# Known Ambiguities

- No general federal expungement statute for ordinary lawful federal convictions was identified in this candidate research.
- Federal judicial expungement/sealing authority varies by circuit, court, claimed legal basis, and type of record.
- A federal pardon does not expunge conviction according to DOJ materials.
- A commutation does not erase conviction or remove civil disabilities according to DOJ materials.
- Firearm disability relief under 18 U.S.C. § 925(c) is not record clearing.
- Current operational availability of § 925(c) agency applications was not verified.
- Current official agency form/procedure for 21 U.S.C. § 844a expungement was not identified.
- Current official federal-district-court motion form/procedure for 18 U.S.C. § 3607(c) was not identified.
- Federal juvenile confidentiality is not expungement.
- Categorical marijuana pardon scope must be matched to exact code, conduct, date, and immigration-status requirements.
- D.C. Code cases require separate jurisdiction modeling from federal United States Code convictions even where presidential clemency process is shared.
- Federal clemency procedure and forms can change through DOJ policy or regulation.
- Federal relief effects across DOJ, FBI, court, agency, and private records are not uniform.

# Required Manual Review Conditions

Return MANUAL_REVIEW_REQUIRED for:

- Any ordinary federal conviction record-clearing request.
- Any claimed federal court equitable expungement.
- Any circuit-specific judicial expungement conclusion.
- Any alleged unconstitutional or invalid arrest/conviction.
- Any vacatur, resentencing, correction-of-sentence, or appellate reversal matter.
- Any § 3607 request lacking official disposition order.
- Any § 844a request lacking civil-penalty record and payment/condition evidence.
- Any federal juvenile record inquiry involving authorized-recipient exception.
- Any firearm-rights relief request.
- Any categorical marijuana pardon claim involving unclear statute, conduct, date, citizenship/lawful-presence status, or jurisdiction.
- Any pardon, commutation, remission, or reprieve application.
- Any member statement that a pardon, commutation, or firearm restoration “cleared” record.
- Any federal/D.C./state/military mixed-conviction situation.
- Any filing form, fee, local rule, or court procedure not verified for actual federal court/agency.

# Federal Engine Schema Gaps

## Executive Clemency Layer

FairPath must represent:

- Pardon.
- Commutation.
- Remission.
- Reprieve.
- Categorical pardon.
- Individual clemency.
- Clemency certificate.
- Clemency conditions.
- Executive discretion.
- Petition guidance versus legal eligibility.
- Grant document status.

## Federal Jurisdiction Layer

FairPath must distinguish:

- United States Code offense.
- D.C. Code offense.
- Code of Federal Regulations offense.
- Uniform Code of Military Justice offense.
- Federal juvenile proceeding.
- Federal adult prosecution.
- Federal district.
- Federal circuit.
- State conviction that creates federal collateral consequence.

## Court Authority Layer

FairPath must distinguish:

- Statutory expungement.
- Court confidentiality.
- Equitable expungement request.
- Invalidity-based relief.
- Vacatur.
- Correction.
- Resentencing.
- Pardon.
- Commutation.
- Firearm disability relief.

## Record Effect Layer

FairPath must represent:

- Official record expungement with statutory retained nonpublic DOJ record.
- Court docket visibility.
- DOJ/FBI retention.
- Agency record effects.
- Juvenile confidentiality.
- Pardon without expungement.
- Sentence reduction without conviction change.
- Firearm disability relief without record clearing.
- Unknown private background-check database effect.

## Date Formula Layer

FairPath must support:

- Five years after release from confinement.
- Five years after conviction if no prison.
- Three years after civil penalty disposition.
- No stated waiting period but prior statutory disposition required.
- Age at offense.
- Sentence completion versus supervision.
- Future-effective and proclamation-version dates.

# Change Monitoring Register

## Office of the Pardon Attorney

Authority:
- U.S. Department of Justice.

URLs:
- https://www.justice.gov/pardon
- https://www.justice.gov/pardon/apply-clemency
- https://www.justice.gov/pardon/legal-authority-governing-executive-clemency
- https://www.justice.gov/pardon/frequently-asked-questions

What Can Change:
- Forms.
- Pardon waiting guidance.
- Commutation guidance.
- Clemeny process.
- Certificate application.
- Regulations/guidance.
- Statistics and executive action announcements.

Monitoring:
- Web monitoring.
- Manual review.
- Check official release/news feed where available.

Recommended Frequency:
- Weekly.
- Immediate review upon executive proclamation or DOJ process announcement.

## United States Code

Authority:
- Office of the Law Revision Counsel, U.S. House of Representatives.

URLs:
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section3607&num=0&edition=prelim
- https://uscode.house.gov/view.xhtml?edition=prelim&path=/prelim@title21/chapter13/subchapter1/partD
- https://uscode.house.gov/view.xhtml?path=/prelim@title18/part4/chapter403&edition=prelim
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section925&num=0&edition=prelim

What Can Change:
- Statutory text.
- Effective dates.
- Notes.
- Historical versions.

Monitoring:
- Web monitoring.
- Source snapshots.
- Congress/enacted-bill monitoring.
- Manual review.

Recommended Frequency:
- Weekly statute diff.
- Immediate review after enacted federal legislation affecting tracked statutes.

## Congress / Enacted Federal Legislation

Authority:
- United States Congress / official legislative sources.

What Can Change:
- New expungement/sealing statutes.
- Amendments to 18 U.S.C. § 3607, 18 U.S.C. § 925(c), 18 U.S.C. § 5038, 21 U.S.C. § 844/844a, clemency-related statutes, appropriations affecting operations.
- Future-effective provisions.
- Repealed provisions.

Monitoring:
- Official Congress bill and enacted-law monitoring.
- Manual review required.

Recommended Frequency:
- Daily during active congressional session for tracked bills.
- Immediate review upon enactment.

## United States Courts and Circuit Courts

Authority:
- United States Courts and official circuit/district court websites.

What Can Change:
- Binding circuit precedent.
- Federal court forms.
- Local rules.
- Filing fees.
- Docketing procedures.
- Case law affecting expungement jurisdiction.

Monitoring:
- Official court opinion feeds/pages where available.
- Local federal court websites for supported districts.
- Manual legal review.

Recommended Frequency:
- Weekly for tracked circuits.
- Immediate review upon relevant appellate decision.

## Department of Justice / ATF or Other Agency

Authority:
- Relevant federal agency.

What Can Change:
- § 925(c) operational availability.
- Forms.
- Agency process.
- Appropriations implementation effects.
- Federal criminal-history processing guidance.

Monitoring:
- Official agency webpage monitoring.
- Manual review.

Recommended Frequency:
- Monthly.
- Immediate review upon agency notice.

# Production Safety Boundary

This package contains candidate research only. It does not authorize member-facing eligibility decisions, production publication, filing instructions, fee promises, record-effect promises, or legal advice. Federal law contains pathways that are executive, judicial, administrative, discretionary, statutory, jurisdiction-specific, and circuit-specific. FairPath engineering must preserve provenance and route all candidate legal data through validation, conflict detection, stale-rule detection, publication-gate, and human-verification processes before production use.