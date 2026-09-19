# FairPath Protection + Incentives Blueprint

## Purpose

FairPath should not be only a marketplace that introduces applicants to employers and housing providers. The long-term product should reduce the practical and financial friction of saying yes.

The protection and incentives system has four layers:

1. **FairPath Mobile** — consumer-facing eligibility, readiness, disclosures, consent, application status, and protection/incentive indicators.
2. **FairPath Partner** — employer, property owner, reentry organization, and institutional workflows.
3. **FairPath Admin** — internal program administration, rule management, verification, exceptions, claims, fraud review, reporting, carrier/program configuration, and 50-state program maintenance.
4. **FairPath Core** — shared eligibility engine, rules registry, audit log, partner verification, program matching, calculation engine, document requirements, and state/federal effective-date controls.

Protection products and public incentive programs are related but must stay separate in the data model. A user may qualify for one, both, or neither.

---

## Product 1: FairPath Employment Protection

### Goal

Give verified employers a defined protection benefit when they hire an eligible FairPath candidate, subject to program rules and final carrier/program approval where required.

### Initial conceptual tiers

- **FP Employment 5** — up to $5,000
- **FP Employment 10** — up to $10,000
- **FP Employment 20** — up to $20,000
- **Custom Review** — higher or specialized limits only after manual underwriting/program review

These are product-design tiers, not promises of insurance coverage. Final limits, covered causes of loss, exclusions, pricing, waiting periods, deductibles, and legal language must be approved with a licensed carrier/surety/program partner before launch.

### Candidate eligibility inputs

- FairPath profile completion
- identity verified
- contact information verified
- work eligibility / onboarding requirements completed where applicable
- job offer or hire verified
- employer verified
- employer account in good standing
- role category
- role access to money, inventory, vehicles, confidential data, property, or customers
- wage/salary
- hours and employment type
- start date
- reentry-program participation/completion where relevant to the selected program
- applicable public bonding-program criteria
- prior FairPath protection claims
- duplicate or conflicting active protection
- required acknowledgments completed

### Employer eligibility inputs

- business identity verified
- valid address
- authorized representative verified
- job listing verified
- no unresolved fraud/safety suspension
- required program agreement accepted
- payroll/employment evidence available when required
- claim cooperation agreement accepted

### Coverage design boundaries

The FairPath product must define covered events precisely. It must not casually imply protection for all employer losses.

Possible employment protection categories for carrier/program design:
- employee dishonesty
- theft
- forgery
- larceny
- embezzlement

Possible exclusions/other-policy territory:
- ordinary poor performance
- workmanship
- workplace injury
- vehicle accidents
- general liability
- discrimination/employment-practices liability
- cyber incidents unless separately underwritten
- inventory shrinkage without evidence
- losses outside the active protection period

---

## Product 2: FairPath Housing Protection

### Goal

Help qualified renters receive consideration from housing providers by reducing defined financial risk for verified participating landlords/property managers.

### Initial conceptual tiers

- **FP Housing 5** — up to $5,000
- **FP Housing 10** — up to $10,000
- **FP Housing 20** — up to $20,000
- **Custom Review** — larger properties, higher rents, or specialized cases

These are design tiers only. Final legal classification may differ by state and carrier structure.

### Renter eligibility inputs

- FairPath profile complete
- identity verified
- current contact information
- target property and lease terms identified
- income and/or subsidy source documented when required
- rent amount
- household size
- employment/income history
- available deposit amount
- voucher/subsidy status when applicable
- prior FairPath housing protection claims
- duplicate active protection
- housing-readiness requirements completed
- required renter disclosures and consent completed

### Property-provider eligibility inputs

- owner/property manager identity verified
- ownership or management authority verified
- property/listing verified
- lease uploaded or validated
- rent amount verified
- property address verified
- no unresolved fraud/safety suspension
- program agreement accepted
- claim cooperation requirements accepted

### Housing protection categories to explore with carrier/program partners

Potentially coverable categories:
- defined unpaid-rent loss
- tenant-caused physical damage beyond ordinary wear
- certain turnover/repair costs if specifically approved
- limited legal/filing costs if expressly included

Must not be presented as automatically covered:
- normal wear and tear
- pre-existing damage
- unverified cash rent
- landlord code violations
- discriminatory or illegal lease provisions
- losses before activation or after expiration
- amounts above the approved limit
- categories excluded by the carrier/program contract

---

## FairPath Incentive Check

### Goal

For every eligible hire or housing placement, FairPath should check for active financial incentives, reimbursements, bonding programs, training support, apprenticeship incentives, and state/local programs.

### Program categories

- federal hiring incentives
- federal bonding
- workforce-system reimbursements
- WIOA/OJT-style training reimbursement
- apprenticeship incentives
- veteran/disability/targeted-worker programs
- state hiring tax credits
- state wage/training subsidies
- local workforce grants
- state housing incentives
- landlord incentive funds
- security-deposit assistance
- damage-mitigation funds
- voucher-related landlord incentives
- reentry-specific grants/programs

### Required 50-state registry fields

Every program record should store:

- program id
- official program name
- program category
- jurisdiction level: federal / state / county / city
- state code
- administering agency
- official source URL
- authority type: statute / regulation / agency program / grant
- current status: active / paused / lapsed / closed / pending verification
- effective start date
- effective end date
- application window
- employer/property-provider eligibility rules
- worker/renter eligibility rules
- justice-history criteria if any
- residency criteria
- work-location criteria
- wage/hour requirements
- employment-type requirements
- industry restrictions
- employer-size restrictions
- apprenticeship/training requirements
- benefit type
- benefit formula
- maximum benefit
- refundable/nonrefundable where relevant
- reimbursement percentage
- duration
- stacking restrictions
- preapproval requirement
- application deadline relative to hire/lease date
- required forms
- required documents
- who submits
- who certifies
- automation level: automatic / assisted / manual review
- last verified date
- next review date
- reviewer
- confidence/status notes
- legal/compliance notes

### Match statuses shown in product

Use cautious statuses:
- **Potential match**
- **Likely eligible — verify**
- **Needs review**
- **Application required**
- **Unavailable**
- **Program paused/lapsed**
- **Not eligible**

Do not display a guaranteed dollar amount unless FairPath has enough verified inputs and the program rules support the calculation.

---

## FairPath Partner experience

### Employer view

For a candidate/hire:

**Protection & Incentives**
- FairPath Employment Protection: eligibility status
- approved/potential protection tier
- federal/state incentive matches
- training reimbursement matches
- apprenticeship matches
- required next actions
- deadlines
- required forms/documents

### Housing provider view

For an applicant/lease:

**Protection & Incentives**
- FairPath Housing Protection: eligibility status
- approved/potential protection tier
- landlord incentive matches
- deposit/damage mitigation matches
- voucher-related incentives
- deadlines
- required next actions
- required forms/documents

Partner users should never see sensitive justice information simply because the rules engine used it. The engine should output only the minimum necessary eligibility result unless law/program rules and user consent require disclosure.

---

## FairPath Admin experience

### Core modules

1. **Program Registry**
   - federal programs
   - 50 states
   - local programs
   - active dates
   - source links
   - version history

2. **Protection Programs**
   - employment/housing product definitions
   - carrier/program partner
   - active states
   - tier/limit configuration
   - underwriting rules
   - exclusions
   - documents

3. **Eligibility Review Queue**
   - auto-approved rule checks where permitted
   - manual review cases
   - missing documentation
   - exceptions
   - adverse/declined reason codes

4. **Claims**
   - claim intake
   - protection record
   - event date
   - requested amount
   - evidence checklist
   - carrier/program status
   - FairPath internal status
   - payout/recovery fields if applicable
   - fraud flags
   - audit history

5. **Fraud + Risk**
   - duplicate claims
   - duplicate identities
   - duplicate properties/businesses
   - suspicious document reuse
   - unusual claim frequency
   - account holds
   - manual escalation

6. **Reporting**
   - placements protected
   - employers/landlords using protection
   - approved limits
   - claims frequency
   - claims severity
   - incentive dollars identified
   - incentive dollars confirmed
   - state/program utilization
   - conversion lift
   - loss ratios if FairPath eventually participates in risk

---

## FairPath Mobile experience

Mobile should remain simple.

### Jobs

Possible UI states:
- **Protection eligible**
- **Employer incentive match available**
- **Complete profile to unlock Easy Apply**
- **Application protected by FairPath** only after actual approval/activation

Do not expose internal underwriting scores.

### Housing

Possible UI states:
- **Housing Protection available**
- **Potential landlord incentive**
- **Complete profile to check eligibility**
- **Protection approved** only after actual program approval

### User consent

Before FairPath sends data to a protection provider, carrier, government program, or partner:
- identify the destination
- explain the purpose
- show what information is being shared where practical
- require consent when required
- record timestamp and policy/version accepted

---

## Rules-engine structure

A program evaluation should return:

- program id
- subject id
- subject type: person / hire / lease / employer / property
- eligibility status
- matched rules
- failed rules
- missing inputs
- potential benefit
- calculation explanation
- required actions
- application deadline
- verification level
- last evaluated timestamp
- rules version

Rule evaluation should be deterministic. AI may summarize requirements and help extract documents, but AI should not make final underwriting, legal, benefit, or eligibility determinations by itself.

---

## Data entities

Core entities:

- incentive_programs
- incentive_program_versions
- incentive_rules
- incentive_evaluations
- incentive_applications
- protection_programs
- protection_program_versions
- protection_tiers
- protection_eligibility_evaluations
- protection_certificates_or_records
- protection_claims
- protection_claim_documents
- protection_claim_events
- partner_verifications
- properties
- employment_placements
- housing_placements
- consent_records
- audit_events

Each consequential record should preserve the exact rule/program version used.

---

## Launch strategy

### Phase 1 — Design + partner validation
- finalize employment and housing product briefs
- define pilot states
- interview employers and landlords
- interview specialty insurance/surety/program brokers
- identify carrier/program administrator options
- determine licensing/distribution requirements by pilot state
- price-test partner demand

### Phase 2 — Public-program engine
- federal registry
- all 50 states represented
- active/inactive status fields
- source URLs
- last-verified dates
- admin maintenance workflow
- no unsupported “guaranteed savings” language

### Phase 3 — Pilot protection
- employment protection in selected states
- housing protection in selected states
- limited tiers
- strict verification
- manual review
- claims handled with carrier/program partner

### Phase 4 — Automation
- employer/landlord onboarding
- automatic program matching
- document checklists
- deadline reminders
- assisted filing
- claims intake
- analytics

### Phase 5 — Risk participation
Only after credible volume and loss history:
- evaluate captive/program structures
- evaluate retained risk
- evaluate reinsurance
- evaluate expansion into additional states

---

## Non-negotiable design rules

- Never imply insurance/bond coverage exists before activation.
- Never show an incentive as guaranteed unless the administering program actually confirms it.
- Effective dates matter.
- A lapsed program stays in the registry with a lapsed status; it is not deleted.
- Preserve source URLs and last-verified dates.
- Never expose sensitive justice data to partners simply because it informed a match.
- Claims, underwriting, and government-program determinations need auditable human controls.
- Build one shared rules engine; do not duplicate logic independently in Mobile, Partner, and Admin.
- FairPath owns the experience and intelligence layer even when a licensed third party carries the regulated risk.
