-- Records actual research progress against the 51-jurisdiction queue. Federal and the 4 states below have only
-- had their justice-specific (and, for federal, the named baseline) programs verified so far - marked
-- in_progress, not completed, since the other 14 research categories per the standing research checklist
-- (apprenticeship, OJT, job-creation, unemployment-hiring, sector-specific, etc.) have not yet been swept for
-- any of them. No jurisdiction is marked completed in this pass.

update public.incentive_research_queue set
  research_status = 'in_progress',
  categories_researched = array['justice_involved_hiring_credits', 'federal_bonding', 'wioa_ojt_federal_floor', 'wotc_authorization_status'],
  last_researched_at = now(),
  notes = 'Federal baseline verified: Federal Bonding Program (active), WIOA OJT federal floor (active, 50%), WOTC (authorization lapsed for hires after 2025-12-31). Other 11 research categories (apprenticeship incentives, job-creation credits, sector-specific, local workforce-board programs, etc.) not yet swept.'
where jurisdiction_code = 'US';

update public.incentive_research_queue set
  research_status = 'in_progress',
  categories_researched = array['justice_involved_hiring_credits', 'formerly_incarcerated_returning_citizen_credits'],
  last_researched_at = now(),
  notes = 'Verified: Credit for Wages Paid to Returning Citizens (tax.illinois.gov FY 2026-08). Remaining 13 categories not yet researched.'
where jurisdiction_code = 'IL';

update public.incentive_research_queue set
  research_status = 'in_progress',
  categories_researched = array['justice_involved_hiring_credits', 'formerly_incarcerated_returning_citizen_credits'],
  last_researched_at = now(),
  notes = 'Verified: Income Tax Benefit for Employers Who Hire Ex-Offenders (revenue.iowa.gov) - a DEDUCTION, not a credit. Remaining 13 categories not yet researched.'
where jurisdiction_code = 'IA';

update public.incentive_research_queue set
  research_status = 'in_progress',
  categories_researched = array['justice_involved_hiring_credits', 'formerly_incarcerated_returning_citizen_credits'],
  last_researched_at = now(),
  notes = 'Verified: Employer Tax Credit for Employing Convicted Felons (revenue.nebraska.gov), statewide $5M annual cap. Remaining 13 categories not yet researched.'
where jurisdiction_code = 'NE';

update public.incentive_research_queue set
  research_status = 'in_progress',
  categories_researched = array['justice_involved_hiring_credits', 'apprenticeship_tax_credits'],
  last_researched_at = now(),
  notes = 'Verified: Formerly Incarcerated Apprenticeship Credit (dor.sc.gov Form TC-64), hiring window through 2026-12-31. Remaining 13 categories not yet researched.'
where jurisdiction_code = 'SC';
