# FairPath Profile, Readiness, and Matching Model

## Product principle

FairPath collects detailed eligibility information once, explains why each required question matters, and reuses confirmed answers across onboarding, applications, matching, Pre-Release, AI assistance, and permitted partner workflows.

The experience must not present one giant questionnaire. Required questions are organized into readiness areas and progressively completed. Users can save and continue later.

## Readiness areas

The consumer sees one FairPath Readiness percentage. Internally it is composed of:
- Identity
- Employment
- Housing
- Reentry
- Documents
- Eligibility

Incomplete required sections remain visible from Home. The interface explains what completing a section can improve: matching accuracy, application autofill, program/incentive screening, document readiness, or reentry planning. It must not promise eligibility or a tax benefit before applicable rules are evaluated.

## Sensitive information

Criminal history, incarceration/release information, registration/restriction data, and other sensitive answers are not general partner-visible profile fields. Matching services may use permitted data without automatically disclosing the underlying sensitive record to employers, property owners, or other partners.

## Answer provenance

Important answers carry a source and verification state. AI/document extraction may propose an answer, but extracted sensitive information should be presented for confirmation rather than silently becoming verified fact.

## Matching architecture

Matching should separate:
1. deterministic legal/program restrictions,
2. verified provider eligibility requirements,
3. user preferences,
4. ranking/recommendation signals.

AI can explain and assist, but should not invent eligibility rules or independently make consequential eligibility decisions.

## Autofill

Confirmed canonical profile data should populate downstream forms. Users should not repeatedly enter the same identity, address, employment, release, conviction, household, or document information.

Business and property profiles follow the same principle: enter canonical organization/property information once and reuse it across listings, applications, billing, and permitted forms.

## Pre-Release

Pre-Release uses the same canonical user profile and readiness model. A participant can begin the profile inside an institution, save progress, prepare documents/plans, and later activate/continue the same FairPath account after release.
