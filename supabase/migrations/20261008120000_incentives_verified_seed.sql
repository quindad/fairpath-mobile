-- Verified seed: federal baseline (3 programs) + 4 justice-specific state programs, independently re-verified
-- against primary .gov sources on 2026-10-01 (not just trusting the secondhand research this pass started
-- from). Every number below was checked against the cited official source before being written here.
--
-- WOTC is included for registry completeness/history but seeded with research_status='authorization_lapsed' -
-- the RLS read policy on incentive_programs only exposes research_status='verified_active' rows to Partner, so
-- this is structurally invisible to any employer screen without additional app logic, matching "no active WOTC
-- dollar estimate for 2026 hires." If Congress reauthorizes WOTC, a NEW program row or rule version gets added
-- with a new effective_from - this row and its rule version are never edited to pretend it was always active.
--
-- WIOA OJT is seeded with its federal floor (50%) as the verified program-level fact. The up-to-75% (or higher,
-- via state waiver) figures are LOCAL WORKFORCE BOARD POLICY, not a federal entitlement - representing that
-- requires a separate local-level program row per workforce area with its own verified source, which is out of
-- scope for this foundation seed. benefit_formula_detail notes this explicitly so the gap is visible in data,
-- not just in a comment.

-- ---------------------------------------------------------------------
-- FEDERAL
-- ---------------------------------------------------------------------

insert into public.incentive_programs (
  program_code, program_name, program_domain, benefit_type, jurisdiction_level, jurisdiction_state,
  justice_specific, administering_authority, research_status, requires_employer_application,
  requires_government_certification, requires_member_documentation, last_verified_at, last_verified_by
) values (
  'US-FEDERAL-BONDING', 'Federal Bonding Program', 'employment', 'bond_coverage', 'federal', null,
  true, 'U.S. Department of Labor, Employment and Training Administration', 'verified_active', false, false, false,
  now(), 'juice-2026-10-01'
), (
  'US-WIOA-OJT', 'WIOA On-the-Job Training (federal floor)', 'employment', 'wage_reimbursement', 'federal', null,
  false, 'U.S. Department of Labor, Employment and Training Administration', 'verified_active', true, false, false,
  now(), 'juice-2026-10-01'
), (
  'US-WOTC', 'Work Opportunity Tax Credit', 'employment', 'tax_credit', 'federal', null,
  true, 'Internal Revenue Service / U.S. Department of Labor', 'authorization_lapsed', true, true, true,
  now(), 'juice-2026-10-01'
);

insert into public.incentive_program_rule_versions (
  program_id, version_number, effective_from, effective_through, eligibility_requirements, employer_requirements,
  worker_requirements, application_deadline, benefit_formula_type, benefit_formula_detail, maximum_value,
  minimum_value, official_source_url, official_source_title, source_authority, verified_at, verified_by, research_notes
) values (
  (select id from public.incentive_programs where program_code = 'US-FEDERAL-BONDING'), 1, '1966-01-01', null,
  'Job seeker faces a barrier to employment and is otherwise unbondable through commercial channels; justice-involved individuals are an explicitly eligible population.',
  'No cost to the employer. Apply through the state bonding coordinator before the employee''s start date.',
  'Must be job-ready and placed in an at-will position (not self-employment).',
  'Must be arranged before the employee starts work; the bond cannot be issued retroactively.',
  'flat_amount', '{"standard_coverage": 5000, "max_coverage_with_program_manager_approval": 25000, "deductible": 0}'::jsonb,
  25000, 5000,
  'https://www.dol.gov/agencies/eta/federal-bonding-program', 'Federal Bonding Program', 'U.S. Department of Labor',
  now(), 'juice-2026-10-01',
  'Coverage, not cash - never included in a tax-credit total. First 6 months of employment. $5,000 standard, up to $25,000 with Program Manager approval, no deductible. Re-verified 2026-10-01 against dol.gov and multiple state workforce-agency bonding brochures (NY, WI, MT, SC, HI DOL/workforce sites) citing the same federal figures.'
), (
  (select id from public.incentive_programs where program_code = 'US-WIOA-OJT'), 1, '2014-07-01', null,
  'Participant meets WIOA eligibility and is hired into a position requiring training the employer provides on the job.',
  'Employer must have an OJT contract with the local workforce board before training begins; reimbursement covers the extraordinary cost of training, not general wages.',
  'Must be a WIOA-eligible participant placed in a bona fide job with the contracting employer.',
  'Contract must be executed before or at the start of OJT; local board timelines vary.',
  'percent_of_wages', '{"federal_floor_percent": 50, "state_local_discretion_up_to_percent": 75, "waiver_possible_above_75": true, "note": "The 50% floor is the only figure verified at the federal level in this seed. 75%+ figures are state/local workforce-board policy and require a separate, independently-sourced local program row before being shown to any employer."}'::jsonb,
  null, null,
  'https://www.dol.gov/agencies/eta/employers/train', 'On-the-Job Training - Employers', 'U.S. Department of Labor, Employment and Training Administration',
  now(), 'juice-2026-10-01',
  'Standard reimbursement up to 50% of wages. WIOA Sec. 134(c)(3)(H) permits state/local areas to raise this to up to 75% based on participant characteristics, employer size, and training quality; some states (e.g. CT) have waivers above 75% for small employers. Do not display 75% or higher as a nationwide figure - that requires the specific local workforce board''s current policy, not yet modeled in this seed.'
), (
  (select id from public.incentive_programs where program_code = 'US-WOTC'), 1, '2021-01-01', '2025-12-31',
  'Hire from one of several targeted groups (veterans, long-term unemployed, SNAP/TANF recipients, ex-felons, etc.) within statutory hire-date windows.',
  'Employer must file Form 8850 with the state workforce agency within 28 days of the employee''s start date, then claim the credit on the federal return.',
  'Must belong to a qualifying targeted group under IRC Section 51.',
  'Form 8850 due within 28 days of start date.',
  'percent_of_wages', '{"percent_first_year_wages": 25, "percent_if_retained_400_hours": 40, "wage_cap_general": 6000, "note": "Historical rule - authorization lapsed for hires beginning after 2025-12-31. No dollar value may be estimated for 2026+ hires under this version."}'::jsonb,
  9600, null,
  'https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2025/TEGL%2009-25/TEGL%2009-25%20%28Complete%20Document%29.pdf', 'TEGL 09-25: WOTC Authorization Lapse', 'U.S. Department of Labor / Internal Revenue Service',
  now(), 'juice-2026-10-01',
  'Congress has not extended WOTC for new hires beginning after 2025-12-31 (DOL TEGL 09-25). Program row kept with research_status=authorization_lapsed, which the RLS read policy already excludes from Partner visibility - no additional app-layer filtering should be relied on as the only gate. Historical pattern: Congress has renewed WOTC roughly 15 times since 1996, often retroactively. If reauthorized, add a NEW rule version (and flip program research_status to verified_active) rather than editing this one.'
);

-- ---------------------------------------------------------------------
-- STATE: JUSTICE-SPECIFIC
-- ---------------------------------------------------------------------

insert into public.incentive_programs (
  program_code, program_name, program_domain, benefit_type, jurisdiction_level, jurisdiction_state,
  justice_specific, administering_authority, research_status, requires_employer_application,
  requires_government_certification, requires_member_documentation, last_verified_at, last_verified_by
) values (
  'IL-RETURNING-CITIZEN-CREDIT', 'Credit for Wages Paid to Returning Citizens', 'employment', 'tax_credit', 'state', 'IL',
  true, 'Illinois Department of Revenue', 'verified_active', true, true, true, now(), 'juice-2026-10-01'
), (
  'IA-EX-OFFENDER-DEDUCTION', 'Income Tax Benefit for Employers Who Hire Ex-Offenders', 'employment', 'tax_deduction', 'state', 'IA',
  true, 'Iowa Department of Revenue', 'verified_active', false, false, true, now(), 'juice-2026-10-01'
), (
  'NE-FELON-HIRE-CREDIT', 'Employer Tax Credit for Employing Convicted Felons', 'employment', 'tax_credit', 'state', 'NE',
  true, 'Nebraska Department of Revenue', 'verified_active', true, true, true, now(), 'juice-2026-10-01'
), (
  'SC-FORMERLY-INCARCERATED-APPRENTICESHIP', 'Formerly Incarcerated Apprenticeship Credit', 'employment', 'tax_credit', 'state', 'SC',
  true, 'South Carolina Department of Revenue', 'verified_active', true, true, true, now(), 'juice-2026-10-01'
);

insert into public.incentive_program_rule_versions (
  program_id, version_number, effective_from, effective_through, eligibility_requirements, employer_requirements,
  worker_requirements, application_deadline, benefit_formula_type, benefit_formula_detail, maximum_value,
  minimum_value, official_source_url, official_source_title, source_authority, verified_at, verified_by, research_notes
) values (
  (select id from public.incentive_programs where program_code = 'IL-RETURNING-CITIZEN-CREDIT'), 1, '2025-01-01', null,
  'Hired Illinois resident was convicted in IL or any jurisdiction, incarcerated in an Illinois adult correctional facility, is not a sex offender, and was hired within 5 years of release.',
  'Must apply online with IDOR via MyTax Illinois for approval before claiming (application requirement begins 2026-01-01). Statewide annual program cap applies - approval is not guaranteed on a first-come basis once the cap is reached.',
  'Illinois resident; qualifying returning-citizen status as defined above.',
  'Application required via MyTax Illinois (requirement effective 2026-01-01).',
  'percent_of_wages', '{"percent": 15, "wage_base": "qualified_wages_irc_3306_first_12_months_of_employment", "excludes_wages_with_federal_ojt_payment": true}'::jsonb,
  7500, null,
  'https://tax.illinois.gov/research/publications/bulletins/fy-2026-08.html', 'FY 2026-08: Credit for Wages Paid to Returning Citizens', 'Illinois Department of Revenue',
  now(), 'juice-2026-10-01',
  '15% of qualified wages, $7,500 cap per qualifying returning citizen, statewide annual cap, state approval required (online application via MyTax Illinois beginning 2026-01-01). Qualifying wages are federal-unemployment-tax wages (IRC 3306) attributable to the 1-year period starting the employee''s start date, reduced by Section 482(e)(1) Social Security Act payments and excluding any wages covered by a federally funded OJT payment.'
), (
  (select id from public.incentive_programs where program_code = 'IA-EX-OFFENDER-DEDUCTION'), 1, '2000-01-01', null,
  'Qualifying ex-offender: convicted of a felony in Iowa, another state, or DC; or on parole/probation (other than simple misdemeanor)/work release/still incarcerated/interstate compact; or certified economically disadvantaged ex-offender for the targeted jobs tax credit.',
  'New hire only - cannot replace an employee terminated in the prior 12 months (unless for misconduct). Must pass the business'' probationary period (6 months absent a written policy). Employer submits a separate sheet with the return: employee name, address, SSN, hire date, total wages paid.',
  'No age restriction. May be full or part time, and may hold more than one job.',
  'Claimed with the Iowa 1040 (individual) or Iowa corporation income tax return.',
  'percent_of_wages', '{"percent": 65, "wage_base": "first_12_months_wages", "benefit_is_deduction_not_credit": true}'::jsonb,
  20000, null,
  'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/employers-who-hire-ex-offenders', 'Employers Who Hire Ex-Offenders', 'Iowa Department of Revenue',
  now(), 'juice-2026-10-01',
  'ADDITIONAL DEDUCTION, not a credit - 65% of first-12-months wages, $20,000 maximum deduction per qualifying employee. Partner-facing copy must say "deduction," never "credit" or imply a $20,000 cash/tax-savings figure (deduction value depends on the employer''s marginal tax rate, which FairPath does not know).'
), (
  (select id from public.incentive_programs where program_code = 'NE-FELON-HIRE-CREDIT'), 1, '2022-01-01', null,
  'Employee convicted of a felony in Nebraska or any other state ("eligible employee").',
  'Employer applies to the Nebraska DOR; applications processed in order received each year until the statewide $5,000,000 annual approved-credit cap is reached.',
  'Felony conviction in any state.',
  'Annual application to DOR; statewide cap is first-come, first-served by application date.',
  'percent_of_wages', '{"percent": 10, "wage_base": "first_12_months_wages", "nonrefundable": true, "statewide_annual_cap_usd": 5000000}'::jsonb,
  20000, null,
  'https://revenue.nebraska.gov/tax-credits/nebraska-employer-tax-credit-employing-convicted-felons', 'Nebraska Employer Tax Credit for Employing Convicted Felons', 'Nebraska Department of Revenue',
  now(), 'juice-2026-10-01',
  'Nonrefundable credit, 10% of wages paid in the first 12 months, $20,000 max per eligible employee, statewide $5M annual approved-credit cap (LB 917). Employer must apply to DOR; approval is not automatic once the statewide cap is reached in a given year, so "likely eligible" should not be upgraded to "eligibility verified" without confirming the current year''s cap has capacity.'
), (
  (select id from public.incentive_programs where program_code = 'SC-FORMERLY-INCARCERATED-APPRENTICESHIP'), 1, '2022-01-01', '2026-12-31',
  'Formerly incarcerated individual hired as a new employee into a USDOL-registered apprenticeship.',
  'Hire must occur between 2022-01-01 and 2026-12-31 under the current statutory window. Credit is first earned only after the employee completes 12 consecutive months of employment, and may not be claimed beyond the employee''s third year.',
  'Formerly incarcerated status; placement in a registered apprenticeship validated by the U.S. Department of Labor.',
  'Claimed via Form TC-64; pre-screening available via Form I-64.',
  'tiered_by_year', '{"year_1": 3000, "year_2": 2500, "year_3": 1000, "credit_first_earned_after_months": 12}'::jsonb,
  3000, 1000,
  'https://dor.sc.gov/sites/dor/files/SoftwareDeveloperForms/TC64.pdf', 'Form TC-64: Formerly Incarcerated Apprenticeship Credit', 'South Carolina Department of Revenue',
  now(), 'juice-2026-10-01',
  'Tiered credit: $3,000 year 1, $2,500 year 2, $1,000 year 3. Current hiring window is 2022-01-01 through 2026-12-31 under the presently published program - do not assume continuation past 2026-12-31 without a new verified rule version. Credit is not realized until the 12th consecutive month of employment, so a fresh placement should show as a future-dated opportunity, not an immediately claimable amount.'
);
