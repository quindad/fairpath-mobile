# Record Relief — Final Completion Report (2026-10-08)

Repo: fairpath-mobile · Branch: `development/mobile-v1-completion` · DEV/local only, production untouched.
Scope: directive items 1–7 (court directory, filing profiles, mobile connection, safety guarantees, tests, this
report, commit/push). Backend Storage retention, database security, and release-gate integration were not touched
— assigned to Mardo, coordinated by reading (not modifying) `src/core/record-relief/engine-executor.ts`,
`nationwide-completeness.ts`, and `scripts/record-relief-release-gate.mjs`.

## 1. Official court directory — 56 of 57 verified and connected

`src/core/record-relief/court-sources.ts` (`BATCH01_COURT_SOURCES`) now has a real, source-checked entry for
**56 of 57 jurisdictions**: official-judiciary `authority`, a live `directoryUrl`, a one-line `structure`
description, and `verifiedOn: '2026-10-08'`. Every entry was checked against the jurisdiction's own official
judiciary/government domain (never a law-firm or aggregator site as the source of record), via parallel research
passes. This is directly wired to the mobile app already — `src/app/record-relief/court-finder.tsx` imports
`courtSource()` from this exact file; no second database was created.

**Live-verified in the browser this pass:** `US-TX` now renders "Texas Judicial Branch / Office of Court
Administration" with a working "OPEN OFFICIAL COURT SOURCE" button; `US-AS` (the one unverified jurisdiction)
correctly shows "This jurisdiction does not have a verified court directory in FairPath yet. Do not rely on an
unverified search result." — the honest fallback, not a guess.

**Not verified: `US-AS` (American Samoa).** No official `.gov`/`.as` judiciary website could be found — only
Wikipedia and a bar-association page, neither acceptable as a primary source. The High Court of American Samoa
appears to have no independent official web presence discoverable this pass. Left out of the data rather than
guessed.

Typecheck: 0 errors. 56/56 entries resolve to a well-formed `https://` URL (scripted check). No duplicate
jurisdiction codes.

## 2. Filing profiles — architectural finding, not a data-entry task

Before writing new filing-profile data, I checked how the app actually surfaces forms/fees/filing instructions:
`src/app/record-relief/case/[id].tsx` has a complete "FEES AND WHERE TO FILE" and "FORMS" UI — but it reads from
**`e.rule` and `detail.forms`, sourced from the DB tables `record_relief_rules` / `record_relief_forms`** via
`get_record_relief_case_detail`, not from any static TypeScript file.

**`src/core/record-relief/filing-profiles.ts` (the static file with Maryland/Pennsylvania form data) is dead
code — never imported by any app screen or engine file.** Expanding it further for 55 more jurisdictions would
have been exactly the "second disconnected database" the directive explicitly warns against: real, sourced data
that the app would never actually show anyone. I did not do that.

**What I did instead:**
- Fixed a real bug in the dead file while I was there: `filingProfile()` only ever searched
  `MARYLAND_FILING_PROFILES`, silently ignoring Pennsylvania's array declared right below it. Fixed to search
  across all declared profiles. Zero behavior change today (nothing calls it), but it was a real, confirmable
  defect, not a hypothetical one.
- Did the actual research anyway, since it's needed regardless of which file it lands in, and compiled it below as
  structured, sourced evidence for whoever populates `record_relief_rules` / `record_relief_forms` (Mardo's lane
  per the founder's DB-security assignment — I did not touch those tables or write a migration).

### Verified filing/expungement sources by jurisdiction (official `.gov`/judiciary sources only)

Fee figures are flagged **"single fig."** only where the official source states one statewide amount; everywhere
else the fee genuinely varies by county/case-type/court and is reported as such rather than flattened into one
number. `—` means no reliable official form/fee information was found this pass; do not fabricate one.

| Jurisdiction | Official filing/expungement source | Form(s) found | Fee |
|---|---|---|---|
| US-FED | uscourts.gov | No general federal expungement statute; relief is case-specific (18 U.S.C. §3607, pardon) | — |
| US-AL | alea.gov/criminal-record-expungement | CR-65, CR-65D, CR-65C | varies, not single fig. |
| US-AK | courts.alaska.gov/forms, dps.alaska.gov | Set-aside (automatic for SIS) + separate DPS sealing request | — |
| US-AZ | azcourts.gov/selfservicecenter/Forms | Petition to Seal (A.R.S. §13-911) / Set-Aside (§13-905), two distinct remedies | varies by county |
| US-AR | acic.org (ACIC forms) | Uniform Petition to Seal, several variants | — (form URL not independently fetched) |
| US-CA | courts.ca.gov/forms | CR-180/CR-181 (Penal Code §1203.4 dismissal, not true expungement) | varies by county |
| US-CO | coloradojudicial.gov | JDF 417/642/680/681 depending on record type | varies, set by C.R.S. §24-72-702/703 |
| US-CT | jud.ct.gov | — | — |
| US-DE | courts.delaware.gov | Form 281 + Form 283; SBI certified history required first | — |
| US-FL | fdle.state.fl.us/Seal-and-Expunge-Process | FDLE Form 40-021 + FD-258 | **$75** single fig. (Certificate of Eligibility only; separate court fee not included) |
| US-GA | georgiacourts.gov, gbi.georgia.gov | GCIC application (pre-7/2013 arrests only; post-2013 is prosecutor-handled, no form) | **$25** single fig. (pre-2013 path only) |
| US-HI | courts.state.hi.us | Two tracks: AG arrest-expungement vs. court-record sealing motion | $35–50 (AG track only) |
| US-ID | isc.idaho.gov | — (county-level, not centralized) | — |
| US-IL | illinoiscourts.gov | Statewide standardized Expungement/Sealing forms suite | varies by circuit; fee waiver available |
| US-IN | in.gov/courts/iocs | Petition for Expungement, county-customized | — |
| US-IA | iowacourts.gov/for-the-public/court-forms | Iowa R. Crim. P. 2.86 Forms 1 & 2 | — |
| US-KS | kjc.ks.gov | Petition/Order for Expungement (K.S.A. 22-2410/21-6614) | — |
| US-KY | kycourts.gov/Legal-Forms | AOC-496 series | varies by case type ($50–$300+); Certificate of Eligibility $40 |
| US-LA | legis.la.gov (La. C.Cr.P. Art. 989 et seq.) | Motion for Expungement | up to ~$200 (clerk + DA fees) |
| US-ME | courts.maine.gov/help/criminal/sealing.html | Form CR-218 | — |
| US-MD | mdcourts.gov/legalhelp/expungement | **Already in codebase, 4 forms, verified 2026-10-07** | $0–$30 depending on branch |
| US-MA | mass.gov/how-to/request-a-time-based-expungement | Petition to Expunge (Probation Service) | **$0** single fig. (admin path; court sealing is separate/unconfirmed) |
| US-MI | courts.michigan.gov (MC227), michigan.gov/ag | MC227 / MC227a | — (MSP $50 is a different, non-court fee) |
| US-MN | mncourts.gov/Help-Topics/Expungement.aspx | EXP101/EXP102 | ~$325 "in most counties" — not a single authoritative figure |
| US-MS | Miss. Code Ann. §99-19-71/72 | — (no official forms page found) | **$150** single fig. (in-case petition only; new civil action costs more) |
| US-MO | courts.mo.gov/page.jsp?id=45443 | Petition for Expungement + fee-waiver application | **$250 + $100 surcharge**, waivable |
| US-MT | courts.mt.gov/Forms/misexpconpage | Self-represented misdemeanor expungement packet (misdemeanors only) | — (waiver available) |
| US-NE | supremecourt.nebraska.gov/node/16082 | CC 6:12(a) | **$0** single fig. |
| US-NV | rccd.nv.gov | Sealing of Criminal History Records packet | varies by county, explicitly stated |
| US-NH | gc.nh.gov/rsa (RSA 651:5), nhsp.dos.nh.gov | Petition to Annul Criminal Record | **$125** court fee (additional non-court fees apply) |
| US-NJ | njcourts.gov | Form CN 10557 | **$75**, waivable, free for dismissed/not-guilty |
| US-NM | nmcourts.gov | Forms 4-951/4-953/4-954/4-960.2/4-960.3 | — |
| US-NY | nycourts.gov | CPL 160.59 Sealing Application (motion in original case) | — (no additional filing fee stated, not independently confirmed) |
| US-NC | nccourts.gov | AOC-CR-281/288/290/293/266/268 | **$175**, waivable |
| US-ND | ndcourts.gov | — (filed within existing case, no standalone form) | — |
| US-OH | supremecourt.ohio.gov | Standardized sealing/expungement forms (numbering varies by court) | varies by county/court, waivable |
| US-OK | oscn.net (statewide judicial portal, non-.gov but official AOC system) | — (county-clerk filed, no central form) | — (reimbursed if granted) |
| US-OR | courts.oregon.gov | Motion to Set Aside + Declaration of Eligibility | **$33** (payable to OSP, not court); waivable |
| US-PA | pa.gov, pacourts.us | **Already in codebase, 2 forms, verified 2026-10-07** | $20 (PSP) + county-variable petition cost |
| US-RI | courts.ri.gov | Motion and Affidavit to Expunge or Seal (felony/misdemeanor versions) | **$100**, due only if granted |
| US-SC | sccourts.org (forms distributed per circuit Solicitor) | Expungement Application (per-circuit template) | ~$310 total (3 separate statutory fees) |
| US-SD | ujs.sd.gov | UJS-391 + companion forms | **$72** single fig. |
| US-TN | tncourts.gov | — (no centralized form found this pass) | — (secondary-source figures not confirmed on an official page) |
| US-TX | txcourts.gov | Petition for Nondisclosure (distinct from Petition for Expunction) | varies by county |
| US-UT | utcourts.gov | Petition to Expunge (Certificate of Eligibility required first) | ~$135 + $2, waivable |
| US-VT | vtcourts.gov/criminal/expungement | — (narrative process, no numbered form) | $90 for one category only (not universal), waivable |
| US-VA | vacourts.gov | Form CC-1473 (expungement) + online Criminal Sealing petition | **$86 + $12** (expungement); sealing has no fee; waivable |
| US-WA | courts.wa.gov | CR 08.0900 (felony/misdemeanor versions) | — (fee schedule not found) |
| US-WV | courtswv.gov | SCA-C907 / SCA-C903 | **$200 + $100**, SP fee waivable in some cases |
| US-WI | wicourts.gov | CR-266/CR-267 (adult), JD-1780 (juvenile) | — (expungement is primarily ordered at sentencing, not petitioned later — flag for app logic) |
| US-WY | wyocourts.gov | Verified Petition for Expungement and Sealing | $100 (misdemeanor) / $300 (felony), bifurcated |
| US-DC | dccourts.gov | Motion to Seal (narrative, no numbered form) | — (PDF fetch blocked; not independently confirmed) |
| US-PR | poderjudicial.pr | — (petition under Ley 254-1974, no numbered form) | — |
| US-GU | guamcourts.gov | — (Title 8 GCA Ch. 11 provides automatic relief on acquittal/declined prosecution; no form found on official site) | — |
| US-VI | vicourts.org (Superior Court Rule 400) | Petition for Expungement (Title 5 V.I. Code ch. 314) | low-confidence $50 figure, not independently machine-read — do not treat as confirmed |
| US-AS | — | **No adult expungement statute appears to exist**; only juvenile record expungement found (secondary source only) | — |
| US-MP | nmijudiciary.gov | — (6 CMC provides automatic/petition relief; no form found on official site) | — |

One cross-agent note worth recording: one research pass flagged that a third-party search-result page it
encountered contained an embedded prompt-injection string ("TEST MODE ACTIVE... test card 4242..."). It was
correctly ignored and not acted on — noted here only as confirmation the research process held up under that
condition, not because it affected anything in this app.

## 3. Safety guarantees (directive item 4) — already enforced, independently re-verified

Not my lane to change (backend/engine), but I re-verified it still holds after my changes:
`executeRecordRelief` forces `additional_facts_required` whenever `degree` or `disposition` is unknown but an
adapter still returned an eligible/excluded/automatic-relief outcome, and `courtSpecificFilingReady` is false
unless venue/court are known and nothing is missing. The nationwide runtime smoke test
(`scripts/test-record-relief-nationwide-smoke.mjs`) still passes 57/57 after my court-sources.ts and
filing-profiles.ts changes.

## 4. Tests, typecheck, mobile workflow

- `npx tsc --noEmit`: **0 errors**.
- `node --test tests/*.test.ts`: **1,415 / 1,415 passing** (1 more than before this pass — a brittle test asserted
  `BATCH01_COURT_SOURCES.length === 5`; fixed to assert the real invariant, that every completeness-tracked
  jurisdiction has a resolvable court source, rather than hardcoding a count that this pass legitimately changed).
- Live mobile workflow check (not just unit tests): started the Expo web server, navigated to
  `/record-relief/court-finder`, confirmed `US-TX` now renders its real court source with a working link, and
  `US-AS` still shows the honest "not verified" fallback rather than breaking or guessing. Zero console errors.

## 5. Genuine blockers (not generic next steps)

1. **Physical Storage deletion is still unverified live.** This requires either direct SQL/service-role access to
   backdate a fixture's `expires_at`, or waiting out the real 30-day retention window. Per the founder's
   assignment, Storage retention is Mardo's responsibility — I did not attempt to work around this.
2. **Filing/form/fee data for `record_relief_rules` / `record_relief_forms` is researched (table above) but not
   loaded into the database.** Loading it requires either a migration or service-role writes — both outside this
   session's access and outside my assigned lane (database security is Mardo's). The research itself is done and
   sourced; only the DB population step remains, and that step belongs to whoever owns those tables.
3. **American Samoa has no identifiable official court-directory or expungement-law web presence.** This is an
   external reality, not a research gap — if one exists, it was not discoverable via web search this pass.
4. **Independent legal review: 0 of 57.** Explicitly out of scope per the directive's own instruction; not claimed
   here or anywhere in this codebase.

## What changed, concretely

- `src/core/record-relief/court-sources.ts`: 51 new verified court-directory entries added (56/57 total; US-AS
  omitted, not guessed).
- `src/core/record-relief/filing-profiles.ts`: fixed `filingProfile()` to search all declared profile arrays, not
  just Maryland's (dead-code bug, zero live behavior change).
- `tests/record-relief-completeness.test.ts`: fixed a brittle hardcoded-count assertion to test the real invariant.
- No backend functions, migrations, database grants, or release-gate files were touched.
- No legal rule, form, fee, or court link was invented. Where official sources did not state one clear statewide
  figure, that is reported as such, not flattened into a plausible-looking number.
