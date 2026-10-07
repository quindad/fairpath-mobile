# Record Relief Batch 01 — OH / MD / PA / MI / IN

Status date: 2026-10-07. Production rule promotion requires primary/official source verification and tests.

| Jurisdiction | Current batch status | Executable answer gate |
| --- | --- | --- |
| Ohio | Reference implementation in progress; current R.C. 2953.32, 2953.33, 2953.34, 2953.36, 2953.61 and 2953.321 identified | Only branches represented by verified/versioned rules may calculate |
| Maryland | Official Judiciary expungement forms/process and fees identified; statutory offense matrix still being normalized | Review fallback until substantive matrix is promoted |
| Pennsylvania | Official UJS expungement/limited-access forms and 18 Pa.C.S. §§ 9122.1–9122.3 family identified | Review fallback until exceptions and Clean Slate matrix are normalized |
| Michigan | MCL 780.621 and 780.621d plus SCAO MC 227 workflow identified | Review fallback until prohibited-offense and automatic-set-aside branches are complete |
| Indiana | IC 35-38-9 official 2026 court-services publication identified; arrest/nonconviction automatic branch and local-court routing identified | Review fallback until conviction-level sections are normalized |

## Engineering rules
1. Authority, charge, remedy, venue, filing profile and explanation are separate records.
2. One case may have many counts. Never reduce the case to the most serious count.
3. A city/county selects venue; it does not create a new statewide eligibility rule.
4. A local fee/form/filing instruction requires its own official source and verification date.
5. Old law is append-only: new effective law creates a new rule version.
6. Mixed-state/federal records are evaluated independently.
7. Unknown or ambiguous facts return additional-facts/review, never a guessed answer.
8. Federal is never passed through a state rule.
9. Member language says likely/verified-rule result; FairPath does not represent a court decision.
10. County/court inventory can be complete before its local filing profile is verified; those are different completeness dimensions.

## Ohio reference implementation — current verified source targets
- R.C. 2953.32: general conviction sealing/expungement, exclusions, conviction aggregation, waiting periods.
- R.C. 2953.33: not guilty/dismissal/no bill/pardon records.
- R.C. 2953.34: effect/access after relief.
- R.C. 2953.36: human-trafficking-victim pathway.
- R.C. 2953.61: multiple charges with different dispositions.
- R.C. 2953.321: marijuana/hashish possession expungement, effective 2026-03-20.
- Supreme Court/BCI materials: court reporting and accepted forms where current.

## Batch completion definition
A state is not COMPLETE because its name exists. Complete means: remedies inventoried; active and historical rule versions; exclusions; waiting anchors; count/incident logic; pending/subsequent conviction logic; special pathways; legal effect; official forms; court hierarchy; county/independent-city inventory; local filing profile source status; hostile fixtures; source dates; and calculation gate all reviewed.
