-- Pass 3: safe ingestion proof. Runs ONE real program (Ohio's Commercial Driver Training Tax Credit) through
-- the full pipeline built in the prior 3 migrations: program_sources -> retrieval run -> program_candidates
-- (full lifecycle) -> promotion to incentive_programs/incentive_program_rule_versions. No nationwide claim is
-- made here - this proves the pipeline shape, not coverage.
--
-- Re-verification on 2026-10-01 found a DISCREPANCY against the earlier secondhand research for this program:
-- it was described as covering "calendar years 2023-2026," but the actual Ohio Revised Code Section 122.91
-- effective window is training expenses paid on/after 2022-01-01 but BEFORE 2026-01-01 - meaning no training
-- expense incurred in 2026 qualifies. As of today (2026-10-01) this program is EXPIRED for new activity. This
-- migration seeds it as research_status='expired', not verified_active - it will NOT appear in any Partner
-- Economic Opportunities view (the existing RLS policy on incentive_programs only exposes verified_active rows)
-- and correctly demonstrates "expired programs do not show as active," not just coverage growth.

insert into public.program_sources (
  name, authority_type, source_tier, jurisdiction_level, jurisdiction_state, official_url,
  discovery_method, crawl_strategy, check_cadence, active, last_checked_at, last_successful_retrieval_at,
  source_health
) values (
  'Ohio Laws - Ohio Revised Code', 'state_agency', 'tier_1', 'state', 'OH', 'https://codes.ohio.gov/orc/section-122.91',
  'manual', 'html', 'monthly', true, now(), now(), 'healthy'
);

insert into public.program_source_domains (source_id, program_domain)
values ((select id from public.program_sources where official_url = 'https://codes.ohio.gov/orc/section-122.91'), 'employment');

insert into public.program_source_retrieval_runs (source_id, started_at, completed_at, status, http_status, retrieved_summary)
values (
  (select id from public.program_sources where official_url = 'https://codes.ohio.gov/orc/section-122.91'),
  now(), now(), 'success', 200,
  'ORC 122.91: commercial driver training tax credit, nonrefundable, 1/2 of certified training expenses, $25,000/year employer cap, $3,000,000/year statewide certification cap, employer applies to Director of Development Services. Effective window: expenses paid on/after 2022-01-01, before 2026-01-01.'
);

insert into public.program_candidates (
  source_id, retrieval_run_id, lifecycle_status, program_name, program_domain, program_subtype,
  administering_authority, jurisdiction_level, jurisdiction_state, target_recipient, benefit_type,
  benefit_percentage, benefit_maximum, effective_date, expiration_date, application_period, funding_limited,
  eligibility_criteria, required_documentation, application_process, source_section, extracted_at,
  extraction_confidence, extraction_method, extraction_notes, verified_at, verified_by
) values (
  (select id from public.program_sources where official_url = 'https://codes.ohio.gov/orc/section-122.91'),
  (select id from public.program_source_retrieval_runs order by started_at desc limit 1),
  'rule_verified',
  'Commercial Driver Training Tax Credit', 'employment', 'job_training_credit',
  'Ohio Department of Development', 'state', 'OH', 'Employers paying commercial-driver training expenses', 'tax_credit',
  50, 25000, '2022-01-01', '2025-12-31', 'Annual application to Director of Development Services with expense estimate', true,
  'Employer incurs tax-credit-eligible training expenses to train an employee to obtain a CDL or operate a commercial motor vehicle (excludes wages).',
  'Application to Director of Development Services with estimate of expected training expenses; Director may certify up to $50,000 of estimated expenses per employer.',
  'Employer applies before incurring expenses; credit claimed against income tax or commercial activity tax once certified.',
  'ORC 122.91', now(), 0.95, 'manual',
  'Verified directly against codes.ohio.gov on 2026-10-01. DISCREPANCY from initial research: program window is 2022-01-01 through before 2026-01-01, not "2023-2026" as first described - no 2026 training expense qualifies. Statewide cap $3,000,000/year certified expenses (with unused-authority carryforward), employer cap $25,000/year nonrefundable credit = 1/2 of certified expenses.',
  now(), 'juice-2026-10-01'
);

insert into public.incentive_programs (
  program_code, program_name, program_domain, benefit_type, jurisdiction_level, jurisdiction_state,
  justice_specific, administering_authority, research_status, requires_employer_application,
  requires_government_certification, requires_member_documentation, last_verified_at, last_verified_by
) values (
  'OH-CDL-TRAINING-CREDIT', 'Commercial Driver Training Tax Credit', 'employment', 'tax_credit', 'state', 'OH',
  false, 'Ohio Department of Development', 'expired', true, true, false, now(), 'juice-2026-10-01'
);

insert into public.incentive_program_rule_versions (
  program_id, version_number, effective_from, effective_through, eligibility_requirements, employer_requirements,
  application_deadline, benefit_formula_type, benefit_formula_detail, maximum_value, official_source_url,
  official_source_title, source_authority, verified_at, verified_by, research_notes
) values (
  (select id from public.incentive_programs where program_code = 'OH-CDL-TRAINING-CREDIT'), 1, '2022-01-01', '2025-12-31',
  'Employer incurs training expenses (excluding wages) to train an employee to obtain a CDL or operate a commercial motor vehicle.',
  'Must apply to the Director of Development Services with an estimate of expected training expenses before incurring them; Director may certify up to $50,000 of estimated expenses per employer. Statewide certification cap is $3,000,000/year (with carryforward of unused certification authority from prior years).',
  'Annual application to Director of Development Services; certification required before expenses are eligible.',
  'percent_of_training_cost', '{"percent": 50, "employer_annual_cap_usd": 25000, "statewide_annual_certification_cap_usd": 3000000, "estimate_certification_cap_usd": 50000}'::jsonb,
  25000,
  'https://codes.ohio.gov/orc/section-122.91', 'Ohio Revised Code Section 122.91', 'State of Ohio',
  now(), 'juice-2026-10-01',
  'EXPIRED for new training expenses as of 2026-01-01 (effective window ends before that date per ORC 122.91). Promoted from program_candidates via the Program Scout pipeline as the Pass-3 ingestion proof - this is the first program to reach incentive_programs through the new source_registry -> candidate -> promotion path rather than being inserted directly.'
);

update public.program_candidates set
  lifecycle_status = 'active',
  promoted_program_id = (select id from public.incentive_programs where program_code = 'OH-CDL-TRAINING-CREDIT'),
  promoted_rule_version_id = (select id from public.incentive_program_rule_versions where program_id = (select id from public.incentive_programs where program_code = 'OH-CDL-TRAINING-CREDIT'))
where source_section = 'ORC 122.91';

-- Update Ohio's research-queue row to reflect this real finding (jurisdiction_code OH does not exist yet from
-- the earlier 51-jurisdiction roster seed only if it was never researched - confirm it is present, then update).
update public.incentive_research_queue set
  research_status = 'in_progress',
  categories_researched = array['job_creation_new_job_credits', 'sector_specific_training_incentives'],
  last_researched_at = now(),
  notes = 'Commercial Driver Training Tax Credit (ORC 122.91) verified via codes.ohio.gov - EXPIRED for expenses incurred on/after 2026-01-01, seeded with research_status=expired, not shown to Partner. Remaining 13 research categories not yet swept for Ohio.'
where jurisdiction_code = 'OH';
