-- Automated-vertical-adjacent proof: a NEW real program (Kentucky Unemployment Tax Credit), independently
-- verified against revenue.ky.gov/kcc.ky.gov on 2026-10-01, run through the full pipeline this pass built:
-- source registry -> candidate (extraction_method='manual', since no ANTHROPIC_API_KEY is configured in this
-- DEV environment - the AI extraction call itself is built and wired but cannot be proven live without that key,
-- which is a product/provider decision, not something to fake) -> program_scout_evaluate_candidate (gate) ->
-- program_scout_promote_candidate (explicit, never automatic) -> scoped rematch (fires automatically inside
-- promotion) -> opportunity_matches. Not justice-specific - proves the pipeline handles a general workforce
-- incentive, not only the justice-specific seeds from the prior pass.

insert into public.program_sources (
  name, authority_type, source_tier, jurisdiction_level, jurisdiction_state, official_url,
  discovery_method, crawl_strategy, check_cadence, active, last_checked_at, last_successful_retrieval_at, source_health
) values (
  'Kentucky Department of Revenue', 'tax_revenue_agency', 'tier_1', 'state', 'KY',
  'https://revenue.ky.gov/Business/Pages/Employer''s-Unemployment-Tax-Credit.aspx',
  'manual', 'html', 'monthly', true, now(), now(), 'healthy'
);

insert into public.program_source_domains (source_id, program_domain)
values ((select id from public.program_sources where official_url like '%Employer''s-Unemployment-Tax-Credit%'), 'employment');

insert into public.program_source_retrieval_runs (source_id, started_at, completed_at, status, http_status, retrieved_summary)
values (
  (select id from public.program_sources where official_url like '%Employer''s-Unemployment-Tax-Credit%'),
  now(), now(), 'success', 200,
  'KUTC: $100 credit per eligible hire against KY income tax. Employee must be unemployed 60 days before hire and remain full-time employed 180 consecutive calendar days in the tax year the credit is claimed. Certified by the Office of Employment and Training. Relatives, dependents, and OJT recipients are ineligible.'
);

insert into public.program_candidates (
  source_id, retrieval_run_id, lifecycle_status, program_name, program_domain, program_subtype,
  administering_authority, jurisdiction_level, jurisdiction_state, target_recipient, benefit_type,
  benefit_amount, effective_date, eligibility_criteria, required_documentation, application_process,
  source_section, extracted_at, extraction_confidence, extraction_method, extraction_notes, verified_at, verified_by
) values (
  (select id from public.program_sources where official_url like '%Employer''s-Unemployment-Tax-Credit%'),
  (select id from public.program_source_retrieval_runs where source_id = (select id from public.program_sources where official_url like '%Employer''s-Unemployment-Tax-Credit%')),
  'extracted', 'Kentucky Unemployment Tax Credit', 'employment', 'unemployment_hiring_credit',
  'Kentucky Department of Revenue / Office of Employment and Training', 'state', 'KY',
  'Employers hiring Kentucky residents unemployed 60+ days', 'tax_credit',
  100, '2001-01-01',
  'Hired individual must have been unemployed for 60 days immediately prior to hire into full-time employment, and remain employed full-time for 180 consecutive calendar days in the tax year the credit is claimed. Relatives, dependents, and on-the-job-training recipients are not eligible.',
  'Certification by the KY Office of Employment and Training (Schedule UTC).', 'File Schedule UTC with KY income tax return after certification.',
  'Employer''s Unemployment Tax Credit page', now(), 0.9, 'manual',
  'Verified directly against revenue.ky.gov and kcc.ky.gov on 2026-10-01. Not justice-specific - general unemployment-hiring incentive. extraction_method=manual because ANTHROPIC_API_KEY is not configured in this DEV environment; the AI extraction call path exists and is wired (program-scout-worker/index.ts runExtraction) but has not been exercised live.',
  now(), 'juice-2026-10-01'
);

select public.program_scout_evaluate_candidate(
  (select id from public.program_candidates where source_section = 'Employer''s Unemployment Tax Credit page')
);
