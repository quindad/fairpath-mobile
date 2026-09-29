OHIO RECORD RELIEF — CANDIDATE PACKAGE V1.1 RED-TEAM REVIEW



Package-Type: CANDIDATE\_RESEARCH\_RED\_TEAM

Jurisdiction: Ohio

Jurisdiction-Code: OH

Version: 1.1

Supersedes-For-Conflict-Purposes: 1.0

Production-Status: NOT\_APPROVED

Auto-Publish: FORBIDDEN

Human-Verification-Required: YES

Research-Status: ADVERSARIAL\_CANDIDATE\_RESEARCH\_REVIEW

Research-Date: 2026-09-29

Last-Verified-Date: 2026-09-29

Controlling-Candidate-Conflict-Rule: V1\_1\_CONTROLS\_FOR\_CANDIDATE\_RESEARCH\_CONFLICT\_RESOLUTION\_ONLY

Publication-Authority: NONE



\# Executive Red-Team Findings



V1 is not safe to ingest unchanged, even as candidate data.



The major statutory adult-conviction framework was directionally supported by current Ohio law. However, V1 contained material risks where a coding system could flatten conditional legal rules into date arithmetic, classify a relief pathway too broadly, treat a local form or fee as statewide, or infer legal eligibility from incomplete offense and case data.



The principal v1.1 findings are:



\- Prosecutor-initiated low-level controlled-substance timing must be tied to the subject offense and subject offender under the corresponding R.C. 2953.32(B)(1) rule.

\- Juvenile sealing and juvenile expungement require separate statute/version/effective-date objects.

\- Juvenile immediate and court-initiated sealing routes must not be collapsed into one six-month waiting-period path.

\- “Final discharge” must remain an evidence-gated legal event, not a self-reported date used directly for filing eligibility.

\- Adult F4/F5/misdemeanor one-year sealing timing has statutory lane predicates that must be evaluated before date calculation.

\- F3 analysis requires conviction-count, relationship, and potentially court public-interest analysis.

\- R.C. 2953.61’s narrow traffic exception does not apply generally to adult conviction relief under R.C. 2953.32.

\- Bail forfeiture requires evidence that the forfeiture was agreed to by the applicant and prosecutor.

\- Nonconviction DNA-related orders must not be represented as complete official-record relief.

\- Human-trafficking conviction expungement contains two separate statutory routes with different predicates and proof standards.

\- CQE felony baseline filing timing must not be expanded with an unsupported supervision-completion requirement.

\- CQE current prescribed form is legally required but not currently verified in the candidate package.

\- “Expungement” effects differ across statutory pathways and must not be normalized.

\- Unknown statewide fees must never be serialized as zero or free.

\- Local court forms must remain local, court-specific procedural data and must not override current Ohio statutory law.



\# Red-Team Status Definitions



\## CONFIRMED



The V1 claim is supported by current primary authority as stated, subject to ordinary candidate-research limitations.



\## CORRECTED



The V1 claim was materially inaccurate, incomplete, or misleading and must be changed.



\## NARROWED



The V1 claim was directionally correct but its scope must be limited to match statutory authority.



\## AMBIGUOUS



Primary authority does not clearly resolve the operational question in a way safe for deterministic implementation.



\## CONFLICTING



Official sources conflict or differ in legal currency, source hierarchy, or procedure. Do not resolve by guessing.



\## UNSUPPORTED



V1 contained a proposition not adequately supported by the retrieved primary authority.



\## REQUIRES MANUAL REVIEW



The legal question cannot safely be determined by candidate data engine logic alone.



\# V1 Claims Confirmed



\## RT-CONF-001 — Adult R.C. 2953.32 Is the Principal Ordinary Conviction Relief Statute



V1 Claim/Rule Being Reviewed:

\- Ohio adult conviction sealing and expungement generally proceed under R.C. 2953.32.



Red-Team Finding:

\- CONFIRMED.



Authority:

\- Ohio Revised Code Section 2953.32.



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Effective Date:

\- September 30, 2025.



Why It Matters:

\- Candidate rule routing for ordinary adult conviction relief should begin with R.C. 2953.32 but must still test exclusions, timing, pending cases, and court findings.



Recommended Engineering Treatment:

\- Maintain pathway object.

\- Do not convert it into a universal “Ohio expungement” path.

\- Require exact offense and disposition classification.



Automatic Publication Must Be Blocked:

\- YES.



\## RT-CONF-002 — Adult Court Discretion Is a Hard Boundary



V1 Claim/Rule Being Reviewed:

\- Court must evaluate rehabilitation and balance applicant interest against legitimate government need.



Red-Team Finding:

\- CONFIRMED.



Authority:

\- R.C. 2953.32(D).

\- R.C. 2953.33(B).

\- R.C. 2953.36.

\- R.C. 2953.521.

\- R.C. 2953.25(C).



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Why It Matters:

\- Satisfying objective timing or exclusion rules does not guarantee grant of relief.



Recommended Engineering Treatment:

\- Require `court\_discretion: true`.

\- Output `POTENTIALLY\_ELIGIBLE` or `MANUAL\_REVIEW\_REQUIRED`.

\- Do not output `LEGALLY\_ELIGIBLE` or `GUARANTEED\_TO\_BE\_GRANTED`.



Automatic Publication Must Be Blocked:

\- YES.



\## RT-CONF-003 — Exact Offense Classification Is Required



V1 Claim/Rule Being Reviewed:

\- Exact statute, subsection, degree, traffic classification, violence classification, sex-offense status, Chapter 2950 status, victim-age issue, and special categories are required.



Red-Team Finding:

\- CONFIRMED.



Authority:

\- R.C. 2953.32(A)-(B).

\- R.C. 2953.33(C).

\- R.C. 2953.35.

\- R.C. 2953.36.

\- R.C. 2953.39.

\- R.C. 2953.61.



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36

\- https://codes.ohio.gov/ohio-revised-code/section-2953.39

\- https://codes.ohio.gov/ohio-revised-code/section-2953.61



Why It Matters:

\- Charge labels such as “DUI,” “traffic,” “violent,” “sex offense,” or “drug case” do not safely correspond to the statutory categories used by Ohio relief statutes.



Recommended Engineering Treatment:

\- Never infer rule applicability from charge-name text alone.

\- Require legal classification or route to manual review.



Automatic Publication Must Be Blocked:

\- YES.



\# V1 Claims Corrected or Narrowed



\## Finding ID: OH-RT-001



Severity:

\- BLOCKER.



V1 Claim/Rule Being Reviewed:

\- The prosecutor low-level controlled-substance pathway states that the waiting period is the “corresponding R.C. 2953.32 period.”



Red-Team Finding:

\- CORRECTED.



Problem:

\- The V1 statement was incomplete because R.C. 2953.39(B)(1) requires expiration of the corresponding R.C. 2953.32(B)(1) period “with respect to that offense and the subject offender.”

\- A naive engine could apply only offense-level timing and ignore offender-specific conditions, underlying start event, exclusions, or related case facts.



Primary Authority:

\- R.C. 2953.39(B)(1).

\- R.C. 2953.32(B)(1).



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.39

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Effective-Date Issue:

\- R.C. 2953.39 current pathway effective October 3, 2023.

\- R.C. 2953.32 current cited version effective September 30, 2025.

\- Dependency must preserve both statute versions.



Corrected Candidate Interpretation:

\- Prosecutor pathway filing timing is a dependent date:



```text

PROSECUTOR\_PATH\_FILING\_DATE =

APPLICABLE\_R.C.\_2953.32(B)(1)\_FILING\_DATE

FOR\_THE\_SUBJECT\_OFFENDER

AND\_THE\_SUBJECT\_OFFENSE

```



Why Difference Matters to Eligibility Engine:

\- A generic Chapter 2925 offense date plus one year or six months can be legally incorrect.

\- The route cannot be modeled as a standalone offense-level clock.



Recommended Engineering Treatment:

\- Require `subject\_offender`.

\- Require `subject\_offense`.

\- Require `dependent\_rule\_id`.

\- Require dependency source evidence.

\- Default output: `MANUAL\_REVIEW\_REQUIRED` until dependency is complete.



Automation Classification:

\- DETERMINISTIC only after verified dependency.

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-002



Severity:

\- BLOCKER.



V1 Claim/Rule Being Reviewed:

\- V1 combined R.C. 2151.356 juvenile sealing and R.C. 2151.358 juvenile expungement under a compound rule with effective date September 30, 2025.



Red-Team Finding:

\- CORRECTED.



Problem:

\- R.C. 2151.356 and R.C. 2151.358 are distinct statutes with different effective dates, rule triggers, legal effects, fees, and procedural conditions.

\- Assigning R.C. 2151.356’s effective date to the entire combined rule can create false historical provenance for R.C. 2151.358.



Primary Authority:

\- R.C. 2151.356.

\- R.C. 2151.358.



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.356

\- https://codes.ohio.gov/ohio-revised-code/section-2151.358



Effective-Date Issue:

\- R.C. 2151.356 current official page: effective September 30, 2025.

\- R.C. 2151.358 current official page: effective April 6, 2023.



Corrected Candidate Interpretation:

\- Create separate objects:

&#x20; - OH-RC-2151.356-JUVENILE-SEALING.

&#x20; - OH-RC-2151.358-JUVENILE-EXPUNGEMENT-AFTER-SEALING.



Why Difference Matters to Eligibility Engine:

\- A combined version can apply wrong law version to a juvenile case or incorrectly report candidate rule provenance.



Recommended Engineering Treatment:

\- Separate effective-from dates.

\- Separate source URLs.

\- Separate pathway conditions.

\- Separate fee status.

\- Separate record-effect status.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED for historical version questions.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-003



Severity:

\- BLOCKER.



V1 Claim/Rule Being Reviewed:

\- V1 presented juvenile sealing mainly through a six-month/age-based application path.



Red-Team Finding:

\- CORRECTED.



Problem:

\- R.C. 2151.356 contains additional material juvenile sealing routes that do not fit the six-month waiting-period model.



Primary Authority:

\- R.C. 2151.356(B)(1)(a)-(e).

\- R.C. 2151.356(C).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.356



Corrected Candidate Interpretation:

\- Separate juvenile route objects are required for:

&#x20; - Immediate sealing where no complaint is filed.

&#x20; - Immediate sealing after successful diversion under R.C. 4301.69(E)(2)(a).

&#x20; - Court-initiated sealing after dismissal, not-delinquent finding, not-unruly finding, or not-juvenile-traffic-offender finding, subject to statutory findings.

&#x20; - Qualifying unruly-child record path after age 18 and statutory conditions.

&#x20; - Application/court-motion sealing under R.C. 2151.356(C).



Why Difference Matters to Eligibility Engine:

\- Applying the six-month waiting rule to an immediate route could delay a member incorrectly.

\- Treating immediate routes as automatic without statutory conditions or court process could be equally inaccurate.



Recommended Engineering Treatment:

\- Require juvenile pathway selector before timing calculation.

\- Do not reuse adult sealing schema without juvenile-pathway fields.

\- Preserve court finding and local procedure requirements.



Automation Classification:

\- DETERMINISTIC for verified immediate-trigger event in limited circumstances.

\- MEMBER\_ASSERTED\_FACT.

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-004



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 used final discharge as adult waiting-period clock start and noted ambiguity.



Red-Team Finding:

\- NARROWED and REQUIRES MANUAL REVIEW.



Problem:

\- R.C. 2953.32 uses “final discharge” but the retrieved current text does not provide a self-contained implementation definition.

\- A member can incorrectly identify sentence completion, supervision completion, financial obligations, post-release control, or other sentence-related status.

\- A naive engine could calculate filing date from a self-reported final-discharge date and present misleading legal guidance.



Primary Authority:

\- R.C. 2953.32(B)(1).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:

\- `final\_discharge\_date` must be an evidence-gated legal event.

\- The candidate rule must retain:

&#x20; - `clock\_start\_status`.

&#x20; - `clock\_start\_evidence\_status`.

&#x20; - `source\_document\_type`.

&#x20; - `member\_asserted`.

&#x20; - `document\_verified`.

&#x20; - `human\_review\_accepted`.

&#x20; - `unknown`.



Why Difference Matters to Eligibility Engine:

\- Date arithmetic can be mathematically correct and legally wrong if the input event is wrong.



Recommended Engineering Treatment:

\- Do not produce filing recommendation from member assertion alone.

\- Permit only estimated milestone output labeled `based\_on\_member\_report`.

\- Require manual review if final-discharge evidence is incomplete or inconsistent.



Automation Classification:

\- MEMBER\_ASSERTED\_FACT.

\- MANUAL\_REVIEW\_REQUIRED.

\- DETERMINISTIC only after verified start event.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-005



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described a general one-year sealing lane for one or more F4/F5 convictions or misdemeanors.



Red-Team Finding:

\- CORRECTED.



Problem:

\- R.C. 2953.32(B)(1)(a)(ii) includes lane conditions: none of the offenses may be R.C. 2921.43 or a felony offense of violence.

\- V1 listed exclusions elsewhere but did not make them timing-lane predicates.



Primary Authority:

\- R.C. 2953.32(B)(1)(a)(ii).

\- R.C. 2953.32(A)(1).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:

\- One-year lane requires:

&#x20; - Subject offense is F4, F5, or misdemeanor.

&#x20; - No subject offense is R.C. 2921.43.

&#x20; - No subject offense is felony offense of violence.

&#x20; - No ordinary exclusion applies.



Why Difference Matters to Eligibility Engine:

\- If timing runs before the exclusion predicate, an excluded or differently timed case can receive a false filing date.



Recommended Engineering Treatment:

\- Treat lane predicate as required precondition.

\- Unknown predicate results in `CLASSIFICATION\_REQUIRED` or `MANUAL\_REVIEW\_REQUIRED`.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- DETERMINISTIC after validated classification.

\- MANUAL\_REVIEW\_REQUIRED if classification uncertain.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-006



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 used phrase “one or two eligible F3 convictions.”



Red-Team Finding:

\- NARROWED.



Problem:

\- This phrase can obscure the statutory F3 count exclusion and related-conviction aggregation rules.

\- A flat list of member-entered convictions may not be legally sufficient.



Primary Authority:

\- R.C. 2953.32(A)(1)(h).

\- R.C. 2953.32(A)(3).

\- R.C. 2953.32(D)(1)(i).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:

\- F3 timing may apply only after:

&#x20; - Complete applicable conviction history is available.

&#x20; - R.C. 2953.32(A)(1)(h) is analyzed.

&#x20; - Same-act and related-conviction analysis under R.C. 2953.32(A)(3) is performed.

&#x20; - Court public-interest determination is preserved when applicable.



Why Difference Matters to Eligibility Engine:

\- Conviction totals can differ depending on statutory aggregation and court findings.



Recommended Engineering Treatment:

\- Require complete conviction inventory.

\- Support case/charge relationships.

\- Default incomplete F3 history to `MANUAL\_REVIEW\_REQUIRED`.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-007



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described felony expungement as ten years after the applicable sealing-filing date.



Red-Team Finding:

\- CONFIRMED IN PRINCIPLE; NARROWED FOR IMPLEMENTATION.



Problem:

\- The formula is accurate only if the predicate sealing-filing date is derived from the correct statutory lane and verified legal event.

\- That predicate can be based on final discharge, Chapter 2950 end/termination date, F3 count rule, or another statutory fact.



Primary Authority:

\- R.C. 2953.32(B)(1)(a).

\- R.C. 2953.32(B)(1)(b)(iii).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:



```text

FELONY\_EXPUNGEMENT\_FILING\_DATE =

VALIDATED\_APPLICABLE\_SEALING\_FILING\_ELIGIBILITY\_DATE

\+ 10 YEARS

```



Required Preserved Dependencies:

\- Predicate sealing lane identifier.

\- Predicate clock start event type.

\- Predicate evidence status.

\- Predicate exclusion status.

\- Predicate classification status.

\- Source statute version.



Why Difference Matters to Eligibility Engine:

\- A generic event date plus ten years can be incorrect by years and may be based on the wrong legal event.



Recommended Engineering Treatment:

\- Maintain formula dependency graph.

\- Do not store derived date without preserving its source lane and evidence.

\- Output only milestone, not final eligibility.



Automation Classification:

\- DETERMINISTIC after dependencies.

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-008



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described traffic-related convictions as excluded and advised exact statute classification.



Red-Team Finding:

\- NARROWED.



Problem:

\- “Traffic-related” is not the statutory test.

\- The ordinary adult conviction exclusion identifies Chapters 4506, 4507, 4510, 4511, and 4549, plus substantially similar municipal ordinances.



Primary Authority:

\- R.C. 2953.32(A)(1)(a).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:

\- Use statute/chapter mapping.

\- Unknown mapping must result in `CLASSIFICATION\_REQUIRED`.

\- Never use keyword labels as controlling classification.



Why Difference Matters to Eligibility Engine:

\- Generic labels could overexclude non-covered offenses or underexclude covered ones.



Recommended Engineering Treatment:

\- Store the exact chapter list.

\- Require official statute/ordinance identification.

\- Route municipal equivalence to manual review.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-009



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described R.C. 2953.61 same-act traffic exception in broader multiple-charge discussion.



Red-Team Finding:

\- CORRECTED.



Problem:

\- R.C. 2953.61(B)(1) narrow traffic exception applies to R.C. 2953.33, R.C. 2953.39, or R.C. 2953.521 proceedings, not ordinary adult conviction relief under R.C. 2953.32.



Primary Authority:

\- R.C. 2953.61(A)-(B).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.61



Corrected Candidate Interpretation:

\- Limit exception scope to:

&#x20; - R.C. 2953.33.

&#x20; - R.C. 2953.39.

&#x20; - R.C. 2953.521.

\- Explicitly exclude ordinary R.C. 2953.32 conviction relief from the exception scope.



Why Difference Matters to Eligibility Engine:

\- Applying exception to adult conviction relief could produce a false eligibility result.



Recommended Engineering Treatment:

\- Pathway-specific relationship rule.

\- Do not apply a global same-act exception.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MEMBER\_ASSERTED\_FACT for CDL status.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-010



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described misdemeanor bail-forfeiture relief and stated traffic interaction required classification.



Red-Team Finding:

\- CORRECTED.



Problem:

\- V1 did not preserve the requirement that the bail forfeiture was agreed to by the applicant and prosecutor.



Primary Authority:

\- R.C. 2953.32(B)(2).

\- R.C. 2953.32(D)(1)(a).

\- R.C. 2953.32(D)(2).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:

\- Add documentary-backed fact:

&#x20; - `bail\_forfeiture\_agreed\_by\_applicant\_and\_prosecutor`.



Why Difference Matters to Eligibility Engine:

\- A person with a bail-forfeiture entry may not meet the statutory agreed-forfeiture condition.



Recommended Engineering Treatment:

\- Require docket, journal, or equivalent court/case record.

\- Self-report is insufficient for final candidate screen.

\- Default unclear cases to manual review.



Automation Classification:

\- MEMBER\_ASSERTED\_FACT.

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-011



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described nonconviction relief and noted DNA provisions.



Red-Team Finding:

\- NARROWED.



Problem:

\- R.C. 2953.33(B)(3) DNA-related order and R.C. 2953.33(B)(4) broader official-record sealing/expungement order are legally distinct.

\- A system could mistakenly interpret DNA action as complete record relief.



Primary Authority:

\- R.C. 2953.33(B)(3)-(5).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Corrected Candidate Interpretation:

\- Separate:

&#x20; - `requested\_relief\_type`.

&#x20; - `statutory\_relief\_option`.

&#x20; - `court\_ordered\_relief\_type`.

&#x20; - `DNA\_only\_action`.

&#x20; - `official\_record\_relief\_granted`.



Why Difference Matters to Eligibility Engine:

\- Member-facing statements could falsely say a record was sealed or expunged when the court order affected only DNA record handling.



Recommended Engineering Treatment:

\- Relief effect must be order-specific.

\- Do not normalize a case as complete relief based on DNA action.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-012



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 correctly stated that R.C. 2953.33 expungement exclusions should not automatically be treated as sealing exclusions.



Red-Team Finding:

\- CONFIRMED IN PRINCIPLE; IMPLEMENTATION NARROWED.



Problem:

\- One generic relief-type field is insufficient.

\- The system must preserve what the person requested, what statute permits, and what court ordered.



Primary Authority:

\- R.C. 2953.33(A), (C).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Corrected Candidate Interpretation:

\- Separate fields:

&#x20; - `requested\_relief`.

&#x20; - `statutory\_relief\_options`.

&#x20; - `court\_ordered\_relief`.



Why Difference Matters to Eligibility Engine:

\- A record could be sealing-eligible but not expungement-eligible.

\- The court’s order may grant only a subset of requested relief.



Recommended Engineering Treatment:

\- Do not store a single generic `record\_relief\_type`.

\- Candidate and case outcome must identify exact relief.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-013



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described pardon-based sealing.



Red-Team Finding:

\- NARROWED.



Problem:

\- A pardon must be the qualifying gubernatorial pardon under R.C. 2967.02(B), and a conditional pardon requires condition satisfaction.

\- Informal assertions or unverified documents cannot satisfy pathway facts.



Primary Authority:

\- R.C. 2953.33(A)(3).

\- R.C. 2953.33(B)(2)(d).

\- R.C. 2967.02.



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2967.02



Corrected Candidate Interpretation:

\- Require:

&#x20; - Official pardon grant/order.

&#x20; - Pardon type.

&#x20; - Case identity.

&#x20; - Condition satisfaction evidence if conditional.



Why Difference Matters to Eligibility Engine:

\- A person can inaccurately characterize a rights-restoration document or clemency communication as a qualifying pardon.



Recommended Engineering Treatment:

\- All pardon pathways require documentary/manual review.



Automation Classification:

\- MEMBER\_ASSERTED\_FACT.

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-014



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 grouped trafficking-related conviction relief as “specified prostitution-related offenses or any misdemeanor/F4/F5.”



Red-Team Finding:

\- CORRECTED.



Problem:

\- R.C. 2953.36(A)(1) and R.C. 2953.36(A)(2) create separate statutory routes.

\- The A(1) route involves conviction under R.C. 2907.24, R.C. 2907.241, or R.C. 2907.25 and can request expungement of any offense except aggravated murder, murder, or rape if trafficking nexus is established.

\- The A(2) route applies to misdemeanor/F4/F5 conviction with separate proof standard.



Primary Authority:

\- R.C. 2953.36(A)(1)-(2).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36



Corrected Candidate Interpretation:

\- Split the pathway into:

&#x20; - A(1): specified qualifying prostitution-related conviction plus requested subject offense except stated exclusions.

&#x20; - A(2): misdemeanor/F4/F5 conviction route.



Why Difference Matters to Eligibility Engine:

\- Combining routes can improperly narrow A(1) or improperly broaden A(2).



Recommended Engineering Treatment:

\- Separate rule IDs.

\- Separate statutory predicates.

\- Separate proof standards.

\- Preserve requested offense and prerequisite conviction as different legal facts.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION for applicable factors.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-015



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 treated F1/F2 as a special review status in trafficking conviction relief.



Red-Team Finding:

\- CORRECTED.



Problem:

\- F1/F2 treatment must be tied to the proper R.C. 2953.36 statutory route.

\- The A(2) route expressly covers misdemeanor/F4/F5; F1/F2 subject-offense analysis arises under the route capable of reaching those requested offenses.



Primary Authority:

\- R.C. 2953.36(A)(1)-(2).

\- R.C. 2953.36(D)(2).

\- R.C. 2953.36(E).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36



Corrected Candidate Interpretation:

\- Apply F1/F2 factor analysis only when statutory route provenance supports it.

\- Do not allow broad “F1/F2 trafficking exception” without route validation.



Why Difference Matters to Eligibility Engine:

\- A simplified flag may either falsely exclude a potentially valid A(1) case or falsely include an unsupported A(2) case.



Recommended Engineering Treatment:

\- Attach F1/F2 special review only to appropriate pathway object.

\- Always route to manual review.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-016



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 described human-trafficking-related nonconviction expungement as available after not guilty or dismissal with manual review.



Red-Team Finding:

\- NARROWED.



Problem:

\- V1 did not explicitly preserve:

&#x20; - Dismissal with-prejudice / without-prejudice determination.

&#x20; - Limitations-expiration requirement for dismissal without prejudice.

&#x20; - No pending criminal proceedings requirement.



Primary Authority:

\- R.C. 2953.521(D)(1)-(4).

\- R.C. 2953.521(E).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Corrected Candidate Interpretation:

\- Add these as mandatory review conditions.

\- Do not return potentially eligible based on disposition alone.



Why Difference Matters to Eligibility Engine:

\- A dismissed case may remain legally or procedurally unresolved for purposes of relief.



Recommended Engineering Treatment:

\- Every dismissed-case trafficking pathway requires manual review.



Automation Classification:

\- MEMBER\_ASSERTED\_FACT.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-017



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 stated CQE felony clock begins after release from incarceration and supervision, or final release from sanctions.



Red-Team Finding:

\- CORRECTED.



Problem:

\- For baseline felony filing under R.C. 2953.25(B)(4)(a)(i), the incarceration branch requires one year after release from incarceration imposed for that offense.

\- V1 improperly added supervision completion to that felony incarceration branch.

\- The misdemeanor branch expressly includes release from local incarceration and all supervision.

\- Separate rebuttable-presumption provisions must not be merged with baseline filing timing.



Primary Authority:

\- R.C. 2953.25(B)(4)(a)(i).

\- R.C. 2953.25(B)(4)(a)(ii).

\- R.C. 2953.25(C)(5).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Corrected Candidate Interpretation:



```text

CQE\_FELONY\_BASELINE\_FILING\_DATE =

RELEASE\_FROM\_INCARCERATION\_IMPOSED\_FOR\_THAT\_OFFENSE

\+ 1 YEAR



OR, IF\_NO\_INCARCERATION\_FOR\_THAT\_OFFENSE:



FINAL\_RELEASE\_FROM\_ALL\_OTHER\_SANCTIONS\_IMPOSED\_FOR\_THAT\_OFFENSE

\+ 1 YEAR

```



```text

CQE\_MISDEMEANOR\_BASELINE\_FILING\_DATE =

RELEASE\_FROM\_LOCAL\_INCARCERATION\_AND\_ALL\_POST\_RELEASE\_SUPERVISION

\+ 6 MONTHS



OR, IF\_NO\_INCARCERATION:



FINAL\_RELEASE\_FROM\_ALL\_SANCTIONS\_INCLUDING\_SUPERVISION

\+ 6 MONTHS

```



Why Difference Matters to Eligibility Engine:

\- Adding unsupported supervision completion can delay a felony member’s filing-date estimate improperly.



Recommended Engineering Treatment:

\- Create separate baseline and presumption timing objects.

\- Preserve branch conditions.

\- Do not infer conditions from related subsections.



Automation Classification:

\- DETERMINISTIC after verified qualifying facts.

\- MEMBER\_ASSERTED\_FACT.

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED for unclear sanctions/release facts.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-018



Severity:

\- HIGH.



V1 Claim/Rule Being Reviewed:

\- V1 stated that court or DRC decisionmaker applies CQE statutory standards.



Red-Team Finding:

\- NARROWED.



Problem:

\- The statute describes DRC designee intake/forwarding mechanisms and common pleas court decision process. V1 should not imply a DRC designee exercises the same final statutory judicial decision authority without separate verified agency authority.



Primary Authority:

\- R.C. 2953.25(B)(5).

\- R.C. 2953.25(C).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Corrected Candidate Interpretation:

\- Separate:

&#x20; - `petition\_intake\_channel`.

&#x20; - `petition\_forwarding\_or\_processing\_actor`.

&#x20; - `adjudicating\_decisionmaker`.

\- Do not call a DRC intake channel a CQE grant process absent verified authority.



Why Difference Matters to Eligibility Engine:

\- Member workflow and outcome expectations could be incorrect.



Recommended Engineering Treatment:

\- Preserve statutory role separation.

\- Require current DRC process verification before workflow implementation.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-019



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 stated DRC may establish earlier CQE filing criteria and treated it as a potential manual-review note.



Red-Team Finding:

\- NARROWED.



Problem:

\- R.C. 2953.25 authorizes DRC to establish criteria by rule, but current implementing rule was not located or verified in candidate research.



Primary Authority:

\- R.C. 2953.25(B)(4)(b).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Corrected Candidate Interpretation:

\- `early\_filing\_status: RULE\_AUTHORIZED\_CURRENT\_IMPLEMENTING\_RULE\_NOT\_VERIFIED`.



Why Difference Matters to Eligibility Engine:

\- A user could be offered an early-filing date that is not supported by a verified current rule.



Recommended Engineering Treatment:

\- No early-filing date.

\- No early-filing workflow.

\- Manual review only until official administrative rule research is complete.



Automation Classification:

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-020



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 correctly noted CQE form is DRC-prescribed but direct form URL was not verified.



Red-Team Finding:

\- CORRECTED FOR FORM STATUS.



Problem:

\- A statutorily required form cannot be treated as merely absent from a registry.

\- The absence of a verified current direct official form is a workflow blocker.



Primary Authority:

\- R.C. 2953.25(B)(3).

\- R.C. 2953.25(J).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Corrected Candidate Interpretation:

\- `form\_status: STATUTORILY\_REQUIRED\_FORM\_NOT\_CURRENTLY\_VERIFIED`.

\- `direct\_form\_link\_permitted: false`.



Why Difference Matters to Eligibility Engine:

\- FairPath could direct a member to an outdated, unofficial, or wrong form.



Recommended Engineering Treatment:

\- Block direct-form linking and assisted filing for CQE until current official form/version and process are verified.



Automation Classification:

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-021



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 listed no pending criminal proceedings as a required condition.



Red-Team Finding:

\- CONFIRMED; IMPLEMENTATION NARROWED.



Problem:

\- Court must determine whether proceedings are pending. Member self-report is not statewide verification.



Primary Authority:

\- R.C. 2953.32(D)(1)(b).

\- R.C. 2953.33(B)(2)(b).

\- R.C. 2953.39(E)(2)(a).

\- R.C. 2953.521(D)(4).



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.39

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Corrected Candidate Interpretation:

\- Pending-case fact must retain source status:

&#x20; - member\_asserted.

&#x20; - record\_verified.

&#x20; - unknown.



Why Difference Matters to Eligibility Engine:

\- A member can fail to know about a pending matter, an unresolved warrant, a linked proceeding, or a case in another court.



Recommended Engineering Treatment:

\- Unknown status should return `MORE\_INFORMATION\_NEEDED` or `MANUAL\_REVIEW\_REQUIRED`.

\- Never return verified no-pending-cases from self-report alone.



Automation Classification:

\- MEMBER\_ASSERTED\_FACT.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES for member-facing determination.

\- NO for candidate ingestion if uncertainty state is preserved.



V1 Must Change Before Candidate Ingestion:

\- NO, if warning preserved.

\- YES before any member-facing screening output.



\## Finding ID: OH-RT-022



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- Adult R.C. 2953.32 fee represented as $50 plus local fee up to $50.



Red-Team Finding:

\- NARROWED.



Problem:

\- The statute establishes $50 application fee and permits local court fee up to $50. It does not establish every court charges the extra fee.



Primary Authority:

\- R.C. 2953.32(D)(3).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Corrected Candidate Interpretation:

\- State fee:

&#x20; - $50.

&#x20; - Fixed by statute.

&#x20; - Waivable through poverty affidavit showing indigency.

\- Local fee:

&#x20; - `POSSIBLE\_UP\_TO\_50\_VERIFY\_FILING\_COURT`.

&#x20; - Not assumed.

&#x20; - Not a fixed statewide amount.



Why Difference Matters to Eligibility Engine:

\- A statewide fee display could overstate required filing costs.



Recommended Engineering Treatment:

\- Fee object must distinguish fixed, capped, local, unknown, and waived values.



Automation Classification:

\- DETERMINISTIC for stated state fee.

\- LOCAL\_OFFICIAL\_PROCEDURE for local fee.

\- MEMBER\_ASSERTED\_FACT for indigency.

\- MANUAL\_REVIEW\_REQUIRED for unverified court procedure.



Automatic Publication Must Be Blocked:

\- NO for candidate ingestion.

\- YES for a member-facing total cost unless filing court is verified.



V1 Must Change Before Candidate Ingestion:

\- NO, if current “possible” wording is retained.

\- YES before member-facing fee display.



\## Finding ID: OH-RT-023



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- Firearm-law-change expungement stated as depending on historical firearm conviction and statutory changed-law conditions.



Red-Team Finding:

\- NARROWED.



Problem:

\- R.C. 2953.35 depends on additional cross-referenced authorization provisions. Candidate pathway must not rely on R.C. 2953.35 alone.



Primary Authority:

\- R.C. 2953.35(A)(2).

\- R.C. 2953.35(C).

\- R.C. 2923.16(H)(2)(a).

\- R.C. 2923.12(E)(2).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35



Corrected Candidate Interpretation:

\- Add cross-reference dependencies.

\- Require historical statute/version and current cross-reference validation.



Why Difference Matters to Eligibility Engine:

\- A historical conviction label may not establish that present statutory authorization applies.



Recommended Engineering Treatment:

\- Manual-review referral only.

\- No autonomous screen beyond “possible special pathway to review.”



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-024



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- Firearm pathway fee says $50 and indigent applicant does not pay.



Red-Team Finding:

\- CONFIRMED; NARROWED.



Problem:

\- R.C. 2953.35 states the $50 fee and indigency exception, but does not contain the same local-fee cap structure as R.C. 2953.32.



Primary Authority:

\- R.C. 2953.35(C)(3).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35



Corrected Candidate Interpretation:

\- State fee:

&#x20; - $50.

&#x20; - Fixed by statute.

&#x20; - Indigent applicant does not pay.

\- Local additional fee:

&#x20; - `NOT\_SPECIFIED\_IN\_R.C.\_2953.35`.

&#x20; - Must not inherit R.C. 2953.32 local-fee logic.



Why Difference Matters to Eligibility Engine:

\- Reusing adult sealing fee rules can create a false fee amount.



Recommended Engineering Treatment:

\- Fee logic must be pathway-specific.



Automation Classification:

\- DETERMINISTIC for stated $50.

\- LOCAL\_OFFICIAL\_PROCEDURE for any court-specific additional charge.



Automatic Publication Must Be Blocked:

\- YES for total member-facing cost unless court procedure verified.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-025



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 described expungement generally as record removal subject to statutory exceptions.



Red-Team Finding:

\- CORRECTED FOR DATA MODEL.



Problem:

\- Different Ohio pathways have different statutory record effects and exceptions.

\- The BCI limited retention provision in R.C. 2953.32(D)(5) is specific to that adult-conviction expungement pathway.



Primary Authority:

\- R.C. 2953.32(D)(5).

\- R.C. 2953.34.

\- R.C. 2953.35(C)(2).

\- R.C. 2953.36(F).

\- R.C. 2953.39(G).

\- R.C. 2953.521(G).



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.34

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36

\- https://codes.ohio.gov/ohio-revised-code/section-2953.39

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Corrected Candidate Interpretation:

\- Every relief pathway requires its own `record\_effect\_profile`.

\- Generic `record\_erased` semantic is prohibited.



Why Difference Matters to Eligibility Engine:

\- FairPath could make materially inaccurate promises about records disappearing or access being eliminated.



Recommended Engineering Treatment:

\- Store relief effect by statutory pathway and court order.

\- Member messaging must be order-specific and statutory-source-specific.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-026



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 says statewide fee not identified for R.C. 2953.33 nonconviction relief and R.C. 2953.521 trafficking nonconviction relief.



Red-Team Finding:

\- CONFIRMED; DATA-SAFETY CORRECTION REQUIRED.



Problem:

\- Null or blank fee data can be serialized by an importer or UI as $0, no fee, or free.



Primary Authority:

\- R.C. 2953.33.

\- R.C. 2953.521.



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Corrected Candidate Interpretation:

\- Use explicit value:

&#x20; - `UNKNOWN\_STATEWIDE\_VERIFY\_FILING\_COURT`.

\- Never use zero or free where fee is unknown.



Why Difference Matters to Eligibility Engine:

\- Members could make decisions based on incorrect cost information.



Recommended Engineering Treatment:

\- Fee field must distinguish:

&#x20; - fixed.

&#x20; - capped.

&#x20; - local.

&#x20; - waivable.

&#x20; - unknown.

&#x20; - no\_fee\_by\_statute.



Automation Classification:

\- LOCAL\_OFFICIAL\_PROCEDURE.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES for fee display unless verified.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-027



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 says juvenile sealing application has no fee.



Red-Team Finding:

\- NARROWED.



Problem:

\- R.C. 2151.356(C)(1) no-fee language is scoped to that application path. It must not be generalized to all juvenile sealing or expungement pathways.



Primary Authority:

\- R.C. 2151.356(C)(1).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.356



Corrected Candidate Interpretation:

\- Scope no-fee rule to application under R.C. 2151.356(C)(1).

\- Other juvenile pathways and juvenile expungement fees remain unknown until verified.



Why Difference Matters to Eligibility Engine:

\- A member could be incorrectly told another juvenile procedure is free.



Recommended Engineering Treatment:

\- Fee rules must include statutory subsection/pathway scope.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- LOCAL\_OFFICIAL\_PROCEDURE.



Automatic Publication Must Be Blocked:

\- YES for unverified fee display.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-028



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 says juvenile record is automatically expunged five years after sealing or at age 23, whichever is earlier.



Red-Team Finding:

\- NARROWED.



Problem:

\- R.C. 2151.358(C) provides a civil-action hold. The date calculation is a milestone, not necessarily the actual expungement date.



Primary Authority:

\- R.C. 2151.358(A).

\- R.C. 2151.358(C).



Official Source URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.358



Corrected Candidate Interpretation:

\- `automatic\_expungement\_milestone\_date`.

\- `actual\_expungement\_status` must depend on civil-action and appeal-finality status.



Why Difference Matters to Eligibility Engine:

\- A person could be told a record has been expunged when it is delayed by an unresolved civil action.



Recommended Engineering Treatment:

\- Do not use milestone date as confirmed order/effect date.

\- Require civil-action review.



Automation Classification:

\- DETERMINISTIC for milestone.

\- MEMBER\_ASSERTED\_FACT.

\- MANUAL\_REVIEW\_REQUIRED.

\- COURT\_DISCRETION for early application route.



Automatic Publication Must Be Blocked:

\- YES.



V1 Must Change Before Candidate Ingestion:

\- YES.



\## Finding ID: OH-RT-029



Severity:

\- MEDIUM.



V1 Claim/Rule Being Reviewed:

\- V1 listed Franklin County official forms as safe to link after court routing.



Red-Team Finding:

\- NARROWED.



Problem:

\- The local forms are official local procedure but not statewide forms.

\- The Franklin County explanatory page includes older statutory language and terminology that must not control legal eligibility content.



Primary Authority:

\- Franklin County Clerk of Courts official forms page.

\- Current R.C. 2953.32.

\- Current R.C. 2953.33.



Official Source URLs:

\- https://clerk.franklincountyohio.gov/Legal-Divisions/General-Civil-Criminal

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Corrected Candidate Interpretation:

\- Every local form record must include:

&#x20; - form scope.

&#x20; - county.

&#x20; - court.

&#x20; - court division.

&#x20; - relief pathway.

&#x20; - official URL.

&#x20; - retrieval/last-checked date.

&#x20; - stale-guidance flag.

&#x20; - direct-link permission.

\- Local explanatory text is not substantive rule authority.



Why Difference Matters to Eligibility Engine:

\- A form link can be correct while the page’s legal explanation is outdated.

\- Form availability does not validate statewide eligibility logic.



Recommended Engineering Treatment:

\- Form resolver must be court-specific.

\- Statute resolver remains separate.

\- Live validation before direct member link display.



Automation Classification:

\- LOCAL\_OFFICIAL\_PROCEDURE.

\- OFFICIAL\_FORM.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES for statewide use.

\- YES for direct member link if not recently verified.



V1 Must Change Before Candidate Ingestion:

\- NO if scope warning preserved.

\- YES before direct form linking.



\## Finding ID: OH-RT-030



Severity:

\- LOW.



V1 Claim/Rule Being Reviewed:

\- V1 generally summarized statutory hearing timing as 45–90 days.



Red-Team Finding:

\- NARROWED.



Problem:

\- Not every pathway uses the 45–90-day hearing window.



Primary Authority:

\- R.C. 2953.32(C).

\- R.C. 2953.33(B)(1).

\- R.C. 2953.35(B).

\- R.C. 2953.36(C).

\- R.C. 2953.521(C).



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Corrected Candidate Interpretation:

\- Store hearing timing per pathway.

\- Use `NOT\_STATUTORILY\_SPECIFIED\_IN\_RETRIEVED\_SECTION` where the statute requires hearing but does not state 45–90-day timing.



Why Difference Matters to Eligibility Engine:

\- Generic process timeline would be misleading.



Recommended Engineering Treatment:

\- Do not provide a universal Ohio processing timeline.



Automation Classification:

\- CLASSIFICATION\_REQUIRED.

\- LOCAL\_OFFICIAL\_PROCEDURE.



Automatic Publication Must Be Blocked:

\- NO for candidate data.

\- YES for member-facing timeline unless pathway and court are verified.



V1 Must Change Before Candidate Ingestion:

\- NO.



\## Finding ID: OH-RT-031



Severity:

\- LOW.



V1 Claim/Rule Being Reviewed:

\- V1 generally represented court discretion as required.



Red-Team Finding:

\- NARROWED.



Problem:

\- Some statutes direct that court “shall” grant/order relief after required findings; others retain balancing or discretionary elements.

\- Generic court-discretion field can obscure whether relief is conditional-mandatory after judicial factual findings.



Primary Authority:

\- R.C. 2953.32(D)(2).

\- R.C. 2953.33(B)(4).

\- R.C. 2953.36(E).

\- R.C. 2953.521(E).



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Corrected Candidate Interpretation:

\- Use separate fields:

&#x20; - `court\_findings\_required`.

&#x20; - `court\_balancing\_required`.

&#x20; - `post\_findings\_order\_type`.

&#x20; - `shall\_order`.

&#x20; - `may\_order`.



Why Difference Matters to Eligibility Engine:

\- Legal logic should preserve statutory semantics without claiming court outcome.



Recommended Engineering Treatment:

\- Keep conservative member language.

\- Do not collapse “shall after findings” into “automatic.”



Automation Classification:

\- COURT\_DISCRETION.

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- NO for candidate data.

\- YES for any direct legal outcome assertion.



V1 Must Change Before Candidate Ingestion:

\- NO.



\## Finding ID: OH-RT-032



Severity:

\- LOW.



V1 Claim/Rule Being Reviewed:

\- V1 treats Ohio Laws current pages as authoritative statutory sources.



Red-Team Finding:

\- CONFIRMED; PROVENANCE ENHANCEMENT REQUIRED.



Problem:

\- Ohio Laws pages show effective dates and latest legislation, but Ohio Laws warns its code updates can lag enacted legislation review.



Primary Authority:

\- Ohio Laws notices displayed on Revised Code pages.



Official Source URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Corrected Candidate Interpretation:

\- Every source record should preserve:

&#x20; - Effective date.

&#x20; - Latest legislation.

&#x20; - Page last updated if shown.

&#x20; - Retrieved date.

&#x20; - Authenticated PDF or source snapshot reference.

&#x20; - Source staleness status.



Why Difference Matters to Eligibility Engine:

\- Current code page text may not reflect a very recent enacted amendment.



Recommended Engineering Treatment:

\- Mark rules `POSSIBLY\_STALE` on tracked statute or enacted-act changes.

\- Require human review before successor rule publication.



Automation Classification:

\- MANUAL\_REVIEW\_REQUIRED.



Automatic Publication Must Be Blocked:

\- YES upon change detection until review.



V1 Must Change Before Candidate Ingestion:

\- NO.



\# Conflicting or Ambiguous Authority



\## Final Discharge



Status:

\- AMBIGUOUS.



Issue:

\- R.C. 2953.32 uses final discharge as the clock start but does not contain a self-contained definition in the retrieved statutory text.



Authority:

\- R.C. 2953.32(B).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Candidate Treatment:

\- Do not infer final discharge from conviction date, sentence date, or incarceration release alone.

\- Do not create universal statewide unpaid-fine, restitution, or court-cost logic without additional primary authority.

\- Require evidence status and manual review where unclear.



Publication Treatment:

\- Block automatic publication of individualized filing date unless final-discharge evidence is verified.



\## Local Court Guidance Versus Current Statute



Status:

\- CONFLICTING / OUTDATED SOURCE RISK.



Issue:

\- Official local court pages may include current local forms but older statutory narrative, terminology, or citations.



Example Official Local Source:

\- Franklin County Clerk of Courts General Civil / Criminal:

&#x20; https://clerk.franklincountyohio.gov/Legal-Divisions/General-Civil-Criminal



Current Statutory Authorities:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Candidate Treatment:

\- Revised Code controls statewide legal eligibility rule.

\- Local court page controls only its local form/process to the extent currently valid.

\- Do not resolve conflict by using local summary as substantive authority.



Publication Treatment:

\- Block automatic publication where official sources conflict or local legal explanation is stale.



\## CQE Earlier Filing



Status:

\- AMBIGUOUS / DATA NOT FOUND.



Issue:

\- R.C. 2953.25 authorizes DRC to establish earlier-filing criteria by rule, but current implementing rule was not verified.



Authority:

\- R.C. 2953.25(B)(4)(b).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Candidate Treatment:

\- No early-filing date or workflow.



Publication Treatment:

\- Block early-filing feature until official DRC rule verified.



\## Nonconviction Fees



Status:

\- DATA NOT FOUND.



Issue:

\- Retrieved R.C. 2953.33 and R.C. 2953.521 text did not establish a statewide fee amount.



Authority:

\- R.C. 2953.33.

\- R.C. 2953.521.



Official URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Candidate Treatment:

\- `UNKNOWN\_STATEWIDE\_VERIFY\_FILING\_COURT`.



Publication Treatment:

\- Block automatic fee amount display.



\# Waiting-Period Verification



\## Adult Conviction Sealing



Verified Current Effective Date:

\- September 30, 2025.



Authority:

\- R.C. 2953.32.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Verified Timing Lanes:

\- One/two qualifying F3 convictions: three years after final discharge.

\- F4/F5/misdemeanors: one year after final discharge, subject to lane predicates.

\- R.C. 2921.43: seven years after final discharge.

\- Chapter 2950 lane: five years after statutory end/termination event.

\- Minor misdemeanor: six months after final discharge.



Red-Team Boundary:

\- These are candidate timing lanes, not eligibility outcomes.

\- Every final-discharge calculation requires evidence status.

\- F3 lane requires count and relationship review.

\- F4/F5/misdemeanor lane requires no R.C. 2921.43 and no felony violence predicate.

\- Chapter 2950 lane requires verified status/end event.



\## Adult Conviction Expungement



Authority:

\- R.C. 2953.32(B)(1)(b).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Verified Timing:

\- Eligible misdemeanor: one year after final discharge.

\- Eligible minor misdemeanor: six months after final discharge.

\- Eligible felony: ten years after the time person may file for sealing under R.C. 2953.32(B)(1)(a).



Red-Team Boundary:

\- Felony timing is dependent.

\- Do not calculate felony expungement from conviction date or final discharge alone.



\## Bail Forfeiture



Authority:

\- R.C. 2953.32(B)(2).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Verified Timing:

\- Sealing: immediately after qualifying bail forfeiture.

\- Misdemeanor expungement: one year after qualifying bail forfeiture.

\- Minor misdemeanor expungement: six months after qualifying bail forfeiture.



Red-Team Boundary:

\- Must verify agreed forfeiture between applicant and prosecutor.

\- Must verify underlying disposition and related-charge context.



\## Not Guilty, Dismissal, and No Bill



Authority:

\- R.C. 2953.33(A).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Verified Timing:

\- Not guilty: after entry on minutes or journal, whichever first.

\- Dismissal: after entry on minutes or journal, whichever first.

\- No bill: two years after report to court.



Red-Team Boundary:

\- Dismissal without prejudice requires limitations analysis.

\- R.C. 2953.61 relationship issues may delay/limit relief.

\- Expungement versus sealing must remain distinct.



\## Human Trafficking Conviction Relief



Authority:

\- R.C. 2953.36(A).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36



Verified Timing:

\- Application may be filed at any time.



Red-Team Boundary:

\- No ordinary waiting period does not make pathway automatic.

\- Trafficking nexus and proof standard require manual review.



\## Juvenile Expungement Milestone



Authority:

\- R.C. 2151.358(A), (C).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.358



Verified Milestone:

\- Five years after sealing or age 23, whichever occurs earlier.



Red-Team Boundary:

\- Civil-action hold prevents treating milestone as actual expungement completion.



\## CQE



Authority:

\- R.C. 2953.25(B)(4).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Verified Baseline Timing:

\- Felony: one year after release from incarceration imposed for offense, or if no incarceration, one year after final release from all other sanctions imposed for offense.

\- Misdemeanor: six months after release from local incarceration and all post-release supervision, or if no incarceration, six months after final release from all sanctions including supervision.



Red-Team Boundary:

\- Do not merge baseline timing with later rebuttable-presumption timing.

\- Current early-filing administrative rule not verified.



\# Offense and Eligibility Exclusion Verification



\## Adult Ordinary Conviction Relief



Authority:

\- R.C. 2953.32(A)(1)-(2).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Verified Candidate Exclusion Categories:

\- Listed traffic chapters and substantially similar municipal ordinances.

\- Felony offense of violence that is not sexually oriented.

\- Sexually oriented offense with Chapter 2950 registration requirement.

\- Offense with victim under 13, subject to R.C. 2919.21 exception.

\- Theft in office.

\- F1/F2 conviction.

\- R.C. 2919.25 or similar domestic violence M1/M2 conviction.

\- Certain F3 history/count conditions.



Verified Sealing-Only Categories:

\- R.C. 2919.25 or substantially similar ordinance M3/M4.

\- R.C. 2919.27 protection-order violation.



Red-Team Boundary:

\- All require exact statute/subsection and appropriate legal classification.

\- Do not infer from names or arrest descriptions.



\## Nonconviction Expungement Exclusions



Authority:

\- R.C. 2953.33(C).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Verified Candidate Exclusion Categories:

\- Listed traffic chapters and similar municipal ordinances.

\- Felony offense of violence that is not sexually oriented.

\- Sexually oriented offense with Chapter 2950 requirements.

\- Victim-under-13 category subject to R.C. 2919.21 exception.

\- F1/F2.

\- R.C. 2919.25 / R.C. 2919.27 or similar ordinance.

\- Specified F3 prior-conviction-count condition.



Red-Team Boundary:

\- These are expungement restrictions.

\- Do not automatically treat as sealing restrictions.



\## Multiple-Charge Rule



Authority:

\- R.C. 2953.61.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.61



Verified:

\- Same-act multiple-charge relationships can control whether relief is available or delayed.



Red-Team Boundary:

\- The narrow traffic exception does not generally apply to R.C. 2953.32 adult conviction relief.



\# Sentence-Completion / Fines / Restitution Verification



\## Final Discharge



Status:

\- AMBIGUOUS.



Authority:

\- R.C. 2953.32(B).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Confirmed:

\- Ohio adult timing lanes use final discharge.



Not Confirmed:

\- A statewide definition in the retrieved statute.

\- A universal statewide rule that unpaid restitution, fines, fees, or costs always bar filing or always determine final discharge.



Corrected Candidate Interpretation:

\- Treat final discharge as a legal/evidentiary event.

\- Preserve financial-obligation status if known.

\- Do not convert unknown financial status into automatic exclusion or automatic nonissue.



Why It Matters:

\- A simplified rule could wrongly delay, deny, or encourage filing.



Recommended Engineering Treatment:

\- Member fact plus evidence status.

\- Manual review on unresolved sentence-completion/financial-obligation questions.



Automatic Publication Must Be Blocked:

\- YES when final discharge is unverified.



\# Conviction-Count / Multiple-Case Verification



\## Related Convictions



Authority:

\- R.C. 2953.32(A)(3).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Verified:

\- Multiple convictions arising from same act may be counted under special rule.

\- Certain two or three related convictions may be counted as one under specified conditions unless court finds not in public interest.



Red-Team Boundary:

\- A flat conviction list is insufficient.

\- Court public-interest decision cannot be automated.



\## Same-Act Charges With Different Dispositions



Authority:

\- R.C. 2953.61(A).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.61



Verified:

\- Charges arising from same act with different final dispositions can prevent relief until all charges are final, subject to statutory exception.



Red-Team Boundary:

\- Require incident/act relationships, case numbers, charge dispositions, and finality information.



\## Narrow Traffic Exception



Authority:

\- R.C. 2953.61(B).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.61



Verified:

\- Applies in specified R.C. 2953.33, R.C. 2953.39, and R.C. 2953.521 contexts.



Conditions:

\- Exactly one traffic conviction under specified chapters.

\- All other charges qualify under named statutes.

\- No OVI under R.C. 4511.19.

\- No physical control under R.C. 4511.194.

\- Person does not currently hold commercial driver’s license or temporary instruction permit.



Red-Team Boundary:

\- Do not apply as generic adult R.C. 2953.32 exception.



\# Filing Procedure Verification



\## Adult Conviction Relief



Authority:

\- R.C. 2953.32(B)-(D).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Confirmed:

\- Ohio conviction: sentencing court.

\- Federal/other-state qualifying conviction: Ohio court of common pleas.

\- More than one case may be included in one application.

\- Hearing 45–90 days after filing.

\- Prosecutor notice at least 60 days before hearing.

\- Prosecutor objection deadline as statute provides.



Red-Team Boundary:

\- Court-specific local filing procedure, documents, form, service, and e-filing cannot be assumed statewide.



\## Nonconviction Relief



Authority:

\- R.C. 2953.33.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Confirmed:

\- Court handling relevant finding/dismissal/no bill is filing venue.

\- Hearing 45–90 days after filing.

\- Prosecutor notification required.



Red-Team Boundary:

\- Dismissal finality and relief type require review.



\## Firearm and Trafficking Pathways



Authorities:

\- R.C. 2953.35.

\- R.C. 2953.36.

\- R.C. 2953.521.



Official URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



Confirmed:

\- Hearing and prosecutor notice exist where statute provides.



Red-Team Boundary:

\- Do not import 45–90-day hearing timeline unless statute specifically supplies it.



\# Fees Verification



\## Adult Conviction Sealing / Expungement



Authority:

\- R.C. 2953.32(D)(3).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Verified:

\- $50 application fee.

\- Poverty affidavit indigency exception.

\- Possible local fee up to $50.



Red-Team Treatment:

\- State fee fixed.

\- Local fee capped but not assumed.



\## Firearm-Law-Change Expungement



Authority:

\- R.C. 2953.35(C)(3).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35



Verified:

\- $50 fee.

\- Indigent applicant does not pay.



Red-Team Treatment:

\- No R.C. 2953.32-style local-fee rule should be inferred.



\## Human-Trafficking Conviction Expungement



Authority:

\- R.C. 2953.36(C).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36



Verified:

\- $50 fee.

\- Indigent applicant does not pay.



\## Prosecutor Low-Level Controlled-Substance Pathway



Authority:

\- R.C. 2953.39(C).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.39



Verified:

\- Prosecutor pays not more than $50 including court fees.

\- Court can direct waiver of some or all.



Red-Team Treatment:

\- Not member filing fee.



\## CQE



Authority:

\- R.C. 2953.25(B)(3).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Verified:

\- $50 fee.

\- Possible local fee up to $50.

\- Waiver authority for court or DRC designee upon poverty affidavit.



\## Unknown Fee Pathways



Authority:

\- R.C. 2953.33.

\- R.C. 2953.521.

\- R.C. 2151.358.



Official URLs:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521

\- https://codes.ohio.gov/ohio-revised-code/section-2151.358



Corrected Candidate Value:

\- UNKNOWN\_STATEWIDE\_VERIFY\_FILING\_COURT.



\# Forms Verification



\## Statewide Adult Record-Relief Form



Status:

\- NOT IDENTIFIED.



Candidate Interpretation:

\- No universal statewide court filing form identified for ordinary adult sealing/expungement or listed special judicial record-relief pathways.



Automatic Publication Must Be Blocked:

\- YES for statewide form display.



\## CQE Form



Authority:

\- R.C. 2953.25(B)(3), (J).



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



Status:

\- Statutorily required DRC-prescribed form.

\- Current direct official form and version not verified.



Corrected Candidate Interpretation:

\- STATUTORILY\_REQUIRED\_FORM\_NOT\_CURRENTLY\_VERIFIED.



Automatic Publication Must Be Blocked:

\- YES.



\## BCI Form



Source:

\- BCI Sealing/Expungement Request Form.



Official URL:

\- https://www.supremecourt.ohio.gov/docs/JCS/courtSvcs/NICS/resources/webinars/BCIReporting/sealingsExpungementsRequest.pdf



Status:

\- Official post-order administrative resource.

\- Not member filing form.



Automatic Publication Must Be Blocked:

\- YES as applicant filing document.



\# Statewide vs. Local Court/Form Issues



\## Franklin County Forms



Authority:

\- Franklin County Clerk of Courts.



Official URL:

\- https://clerk.franklincountyohio.gov/Legal-Divisions/General-Civil-Criminal



Fee Schedule URL:

\- https://clerk.franklincountyohio.gov/Legal-Divisions/General-Civil-Criminal/General-Division-Fee-Schedule



Scope:

\- Franklin County Court of Common Pleas General Division.

\- Local procedure.

\- Not statewide.



Red-Team Finding:

\- Local forms can be operationally useful after actual filing-court resolution.

\- Local narrative legal explanation must not override Revised Code.



Required Form Metadata:

\- Name.

\- Form number if shown.

\- Issuing authority.

\- Court.

\- Court division.

\- County/municipality.

\- Relief pathway.

\- Official URL.

\- Instructions URL.

\- File type.

\- Last updated if shown.

\- Retrieval date.

\- Last checked date.

\- Scope.

\- Staleness flag.

\- Direct-link permission.



\# Effective-Date and Versioning Risks



\## R.C. 2953.32



Current Effective Date:

\- September 30, 2025.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.32



Risk:

\- Do not apply current statutory timing/exclusion logic to historical case questions without preserving effective-date/version analysis.



\## R.C. 2953.33



Current Effective Date:

\- October 3, 2023.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.33



Risk:

\- Historical R.C. 2953.52 numbering and prior versions should not be treated as current law.



\## R.C. 2953.35



Current Effective Date:

\- April 4, 2023.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.35



Risk:

\- Historical firearms statutes and cross-referenced authorization provisions require version-specific review.



\## R.C. 2953.36



Current Effective Date:

\- October 24, 2024.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.36



Risk:

\- Special pathway may have changed after conviction; do not assume current rule application without legal review.



\## R.C. 2953.39



Current Effective Date:

\- October 3, 2023.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.39



Risk:

\- Depends on corresponding R.C. 2953.32 timing version.



\## R.C. 2953.521



Current Effective Date:

\- April 4, 2023.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.521



\## R.C. 2151.356



Current Effective Date:

\- September 30, 2025.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.356



\## R.C. 2151.358



Current Effective Date:

\- April 6, 2023.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2151.358



\## R.C. 2953.25



Current Effective Date:

\- September 23, 2026.



Official URL:

\- https://codes.ohio.gov/ohio-revised-code/section-2953.25



\## Ohio Laws Update Risk



Authority:

\- Ohio Laws / Legislative Service Commission.



Risk:

\- Ohio Laws indicates that code updates can lag review of enacted legislation.



Required Source Metadata:

\- Statute section.

\- Subsection.

\- Effective date.

\- Latest legislation.

\- Last updated if shown.

\- Retrieved date.

\- Authenticated PDF/source snapshot.

\- Source hash.

\- Staleness status.



Required Response to Change:

\- Mark candidate rule POSSIBLY\_STALE.

\- Preserve prior research version.

\- Require human review.

\- Create successor candidate version if supported.

\- Do not auto-publish.



\# Source and Provenance Problems



\## Problem: Historical Statute Source Mix



Finding:

\- Search results and local materials can surface repealed or historical versions of R.C. sections.



Example:

\- Historical R.C. 2953.33 pages may refer to former numbering or repealed versions.



Candidate Requirement:

\- Current rule must cite current official page and effective date.

\- Historical section only used when specific historical version is legally relevant.



\## Problem: Official Local Procedure Can Be Legally Stale



Finding:

\- Local clerk page may host current form but older explanatory statutory information.



Candidate Requirement:

\- Separate:

&#x20; - Statutory legal authority.

&#x20; - Local filing procedure.

&#x20; - Official form.

&#x20; - Local fee.

&#x20; - Older explanatory content.



\## Problem: Unverified CQE Form



Finding:

\- Statutory form requirement exists.

\- Current form file/version absent from candidate package.



Candidate Requirement:

\- Treat as unverified and block direct linking.



\## Problem: Null Fee Data



Finding:

\- Missing fee data can silently become zero.



Candidate Requirement:

\- Explicit unknown-fee enum/value required.



\# Items Requiring Human Verification



\- Final discharge in any adult timing path.

\- Exact offense statute/subsection where unavailable.

\- Similar municipal ordinance mapping.

\- Felony offense of violence classification.

\- Sexually oriented offense classification.

\- Chapter 2950 registration history/end/termination.

\- Victim age under 13.

\- Domestic violence degree.

\- Protection-order violation classification.

\- F3 count and prior-conviction history.

\- Same-act, same plea, same indictment, related-act, or different-disposition relationship.

\- CDL or temporary instruction permit for R.C. 2953.61(B) exception.

\- Dismissal with-prejudice / without-prejudice status and limitations analysis.

\- Bail forfeiture agreement by applicant and prosecutor.

\- Pardon authenticity and condition compliance.

\- Human-trafficking nexus and evidence.

\- Historical firearm statute and cross-reference analysis.

\- CQE collateral sanction and statutory exception mapping.

\- CQE current form and early-filing DRC rule.

\- Juvenile jurisdiction status.

\- Juvenile civil-action hold and appeal finality.

\- Actual filing court, court division, local form, local fee, e-filing process, and supporting-document requirements.

\- Any conflicting or stale government source.



\# Importer and Engineering Recommendations



\- Preserve v1 and v1.1 as distinct research versions.

\- Treat v1.1 as controlling only for candidate-research conflict resolution.

\- Do not delete v1 statements that v1.1 corrected; retain original claim, correction, source, and rationale.

\- Implement `source\_quality\_label` values:

&#x20; - PRIMARY\_BINDING.

&#x20; - PRIMARY\_OFFICIAL\_GUIDANCE.

&#x20; - OFFICIAL\_FORM.

&#x20; - LOCAL\_OFFICIAL\_PROCEDURE.

&#x20; - SECONDARY\_EXPLANATORY.

\- Implement explicit status values:

&#x20; - CANDIDATE\_RESEARCH.

&#x20; - POSSIBLY\_STALE.

&#x20; - CONFLICTING\_OFFICIAL\_SOURCES.

&#x20; - FORM\_NOT\_VERIFIED.

&#x20; - FEE\_UNKNOWN.

&#x20; - CLASSIFICATION\_REQUIRED.

&#x20; - MANUAL\_REVIEW\_REQUIRED.

&#x20; - COURT\_DECISION\_REQUIRED.

&#x20; - NOT\_APPROVED\_FOR\_PUBLICATION.

\- Separate:

&#x20; - Objective timing calculation.

&#x20; - Clock-start verification.

&#x20; - Offense classification.

&#x20; - Member assertion.

&#x20; - Manual legal review.

&#x20; - Court discretion.

&#x20; - Court order outcome.

\- Support dependent statutory date formulas.

\- Support pathway-specific relief-effect profiles.

\- Support case/charge/incident relationships.

\- Support court-specific forms and local procedure separately from statewide law.

\- Preserve section-level effective dates.

\- Require source snapshot or authenticated-PDF reference.

\- Do not allow null fee to become zero.

\- Do not allow form link without scope and last-checked metadata.

\- Do not allow candidate importer success to set publication state.



\# Publication-Blocking Issues



The following issues require automatic publication to remain blocked:



\- V1.1 blocker changes have not been incorporated.

\- Final-discharge start event is not verified.

\- Offense statute/subsection or degree is unknown.

\- Municipal ordinance requires equivalence classification.

\- F3 count rule cannot be evaluated from complete verified history.

\- Same-act/multiple-charge relationship is unresolved.

\- Dismissal without prejudice limitations question is unresolved.

\- Chapter 2950 status/end date is unresolved.

\- Victim-under-13 fact is unresolved where material.

\- Traffic/OVI/CDL classification is unresolved.

\- Bail-forfeiture agreement evidence is absent.

\- Trafficking nexus pathway involved.

\- Historical firearm-law-change pathway involved.

\- Pardon terms/conditions unresolved.

\- CQE collateral sanction or form not verified.

\- Juvenile civil-action hold unresolved.

\- Filing form/fee/local procedure not verified for actual court.

\- Official source conflict remains unresolved.

\- Statute/form source marked POSSIBLY\_STALE.

\- Court discretion is present and no court order exists.



\# Final Candidate Change Log from V1 → V1.1



```json

{

&#x20; "changeset\_id": "FAIRPATH-OH-CANDIDATE-V1.1-REDTEAM",

&#x20; "base\_package": "FAIRPATH-OH-RECORD-RELIEF-CANDIDATE-V1",

&#x20; "status": "required\_before\_candidate\_ingestion",

&#x20; "changes": \[

&#x20;   {

&#x20;     "change\_id": "OH-V11-001",

&#x20;     "action": "replace",

&#x20;     "target": "OH-RC-2953.39-PROSECUTOR-LOW-LEVEL-CONTROLLED-SUBSTANCE.waiting\_period",

&#x20;     "original\_v1\_position": "Corresponding R.C. 2953.32 period.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "formula\_type": "dependent\_statutory\_date",

&#x20;       "input\_event": "applicable\_R.C.\_2953.32(B)(1)\_filing\_date\_for\_subject\_offender\_and\_subject\_offense",

&#x20;       "authority": "R.C. 2953.39(B)(1)",

&#x20;       "status": "manual\_review\_required\_until\_dependency\_verified"

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-002",

&#x20;     "action": "split",

&#x20;     "target": "OH-RC-2151.356-2151.358-JUVENILE-RELIEF",

&#x20;     "original\_v1\_position": "Combined juvenile sealing and expungement object with a 2025-09-30 effective date.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "new\_rules": \[

&#x20;         "OH-RC-2151.356-JUVENILE-SEALING",

&#x20;         "OH-RC-2151.358-JUVENILE-EXPUNGEMENT-AFTER-SEALING"

&#x20;       ],

&#x20;       "reason": "Distinct statutory authority, effective dates, pathways, fees, and legal effects."

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-003",

&#x20;     "action": "add",

&#x20;     "target": "OH-RC-2151.356-JUVENILE-SEALING",

&#x20;     "original\_v1\_position": "Juvenile relief focused primarily on six-month/age path.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "new\_pathways": \[

&#x20;         "no\_complaint\_immediate\_sealing",

&#x20;         "successful\_4301.69\_diversion\_immediate\_sealing",

&#x20;         "dismissal\_or\_not\_delinquent\_unruly\_traffic\_court\_initiated\_sealing",

&#x20;         "qualifying\_unruly\_child\_age\_18\_path",

&#x20;         "application\_or\_court\_motion\_path\_under\_R.C.\_2151.356(C)"

&#x20;       ]

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-004",

&#x20;     "action": "add",

&#x20;     "target": "all\_R.C.\_2953.32\_waiting\_period\_rules",

&#x20;     "original\_v1\_position": "Final discharge identified as ambiguous but usable clock field.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "clock\_start\_evidence\_status": \[

&#x20;         "member\_asserted",

&#x20;         "document\_verified",

&#x20;         "human\_review\_accepted",

&#x20;         "unknown"

&#x20;       ],

&#x20;       "clock\_calculation\_output\_type": "waiting\_period\_milestone\_not\_legal\_eligibility"

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-005",

&#x20;     "action": "replace",

&#x20;     "target": "adult\_F4\_F5\_misdemeanor\_sealing\_lane",

&#x20;     "original\_v1\_position": "General one-year lane.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "required\_predicates": \[

&#x20;         "subject\_offense\_is\_F4\_or\_F5\_or\_misdemeanor",

&#x20;         "no\_subject\_offense\_is\_R.C.\_2921.43",

&#x20;         "no\_subject\_offense\_is\_felony\_offense\_of\_violence",

&#x20;         "no\_R.C.\_2953.32(A)(1)\_exclusion"

&#x20;       ]

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-006",

&#x20;     "action": "replace",

&#x20;     "target": "adult\_F3\_timing\_lane",

&#x20;     "original\_v1\_position": "One or two eligible F3 convictions.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "requires": \[

&#x20;         "complete\_relevant\_conviction\_history",

&#x20;         "R.C.\_2953.32(A)(1)(h)\_count\_analysis",

&#x20;         "R.C.\_2953.32(A)(3)\_same\_act\_and\_related\_conviction\_analysis",

&#x20;         "court\_public\_interest\_status\_when\_applicable"

&#x20;       ],

&#x20;       "default\_output\_when\_missing": "MANUAL\_REVIEW\_REQUIRED"

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-007",

&#x20;     "action": "scope",

&#x20;     "target": "R.C.\_2953.61(B)\_traffic\_exception",

&#x20;     "original\_v1\_position": "Discussed in general multiple-charge context.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "scope": \[

&#x20;         "R.C.\_2953.33",

&#x20;         "R.C.\_2953.39",

&#x20;         "R.C.\_2953.521"

&#x20;       ],

&#x20;       "explicit\_non\_scope": \[

&#x20;         "ordinary\_R.C.\_2953.32\_adult\_conviction\_relief"

&#x20;       ]

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-008",

&#x20;     "action": "add",

&#x20;     "target": "OH-RC-2953.32-MISDEMEANOR-BAIL-FORFEITURE",

&#x20;     "original\_v1\_position": "Bail forfeiture pathway without explicit agreed-forfeiture evidence requirement.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "required\_fact": "bail\_forfeiture\_agreed\_by\_applicant\_and\_prosecutor",

&#x20;       "evidence\_requirement": "court\_or\_case\_record",

&#x20;       "authority": "R.C. 2953.32(D)(1)(a)"

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-009",

&#x20;     "action": "add",

&#x20;     "target": "OH-RC-2953.33-NONCONVICTION-RELIEF",

&#x20;     "original\_v1\_position": "Nonconviction relief described without full distinction between DNA-only action and official-record relief.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "requested\_relief\_type": \[

&#x20;         "sealing",

&#x20;         "expungement"

&#x20;       ],

&#x20;       "court\_ordered\_relief\_type": \[

&#x20;         "sealing",

&#x20;         "expungement",

&#x20;         "DNA\_only\_action",

&#x20;         "none"

&#x20;       ],

&#x20;       "DNA\_order\_is\_not\_full\_record\_relief": true

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-010",

&#x20;     "action": "split",

&#x20;     "target": "OH-RC-2953.36-HUMAN-TRAFFICKING-CONVICTION",

&#x20;     "original\_v1\_position": "Combined specified prostitution-related and misdemeanor/F4/F5 routes.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "new\_rules": \[

&#x20;         "OH-RC-2953.36-A1-SPECIFIED-CONVICTION-ANY-REQUESTED-OFFENSE-EXCEPT-EXCLUSIONS",

&#x20;         "OH-RC-2953.36-A2-MISDEMEANOR-F4-F5-CONVICTION"

&#x20;       ],

&#x20;       "reason": "Different statutory predicates, requested-offense scope, proof standards, and F1/F2 treatment."

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-011",

&#x20;     "action": "replace",

&#x20;     "target": "OH-RC-2953.25-CQE.waiting\_period",

&#x20;     "original\_v1\_position": "Felony timing included supervision completion in incarceration branch.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "baseline\_felony\_filing\_clock": "One year after release from incarceration imposed for that offense, or if no incarceration, one year after final release from all other sanctions imposed for that offense.",

&#x20;       "baseline\_misdemeanor\_filing\_clock": "Six months after release from local incarceration and all post-release supervision, or if no incarceration, six months after final release from all sanctions including supervision.",

&#x20;       "rebuttable\_presumption\_clock": "Separate R.C. 2953.25(C)(5) rule; do not merge with baseline filing timing."

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-012",

&#x20;     "action": "replace",

&#x20;     "target": "OH-RC-2953.25-CQE.form\_status",

&#x20;     "original\_v1\_position": "Statewide form requirement with no current direct form URL.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "status": "STATUTORILY\_REQUIRED\_FORM\_NOT\_CURRENTLY\_VERIFIED",

&#x20;       "direct\_link\_permitted": false,

&#x20;       "authority": "R.C. 2953.25(B)(3), (J)"

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-013",

&#x20;     "action": "add",

&#x20;     "target": "all\_relief\_pathways",

&#x20;     "original\_v1\_position": "General sealing/expungement distinction but no required pathway-specific effect profile.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "record\_effect\_profile": "pathway\_specific",

&#x20;       "generic\_expungement\_effect\_prohibited": true,

&#x20;       "order\_required\_for\_effect": true

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-014",

&#x20;     "action": "replace",

&#x20;     "target": "unknown\_fee\_values",

&#x20;     "original\_v1\_position": "Null/unknown state fee notation.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "value": "UNKNOWN\_STATEWIDE\_VERIFY\_FILING\_COURT",

&#x20;       "display\_behavior": "do\_not\_display\_zero\_or\_free"

&#x20;     }

&#x20;   },

&#x20;   {

&#x20;     "change\_id": "OH-V11-015",

&#x20;     "action": "add",

&#x20;     "target": "all\_source\_records",

&#x20;     "original\_v1\_position": "Source URLs and dates present but source metadata not uniformly required.",

&#x20;     "v1\_1\_candidate\_correction": {

&#x20;       "required\_fields": \[

&#x20;         "effective\_date",

&#x20;         "latest\_legislation",

&#x20;         "last\_updated\_as\_shown",

&#x20;         "retrieved\_date",

&#x20;         "authenticated\_pdf\_or\_snapshot\_reference",

&#x20;         "source\_staleness\_status"

&#x20;       ]

&#x20;     }

&#x20;   }

&#x20; ]

}

```



\# Final Red-Team Conclusion



V1.1 controls over V1 for candidate-research conflict resolution.



V1.1 does not convert Ohio candidate research into production law.



V1.1 does not establish that any candidate rule has been loaded into FairPath, verified by FairPath, approved for publication, or cleared for member-facing use.



V1.1 requires:



\- Candidate research version preservation.

\- Source provenance preservation.

\- Engineering validation.

\- Effective-date validation.

\- Local form and fee validation.

\- Human legal-data verification.

\- Publication-gate approval.

\- Ongoing staleness monitoring.



PRODUCTION SAFETY BOUNDARY



This red-team package supersedes V1 only for candidate-research conflict resolution. It does not itself authorize publication. All legal rules, forms, fees, effective dates, and eligibility logic remain subject to FairPath's validation and human-verification gates before production use.

