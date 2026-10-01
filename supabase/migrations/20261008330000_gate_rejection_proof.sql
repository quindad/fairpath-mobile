-- Proves the other half of the verification gate for real: a discovery_only-tier source can produce a
-- perfectly complete, high-confidence extraction and still must NOT pass the gate - "activation must remain
-- impossible from discovery-only evidence" is enforced by program_scout_evaluate_candidate's source-tier check,
-- not by hoping the extraction happens to be incomplete.
insert into public.program_sources (
  name, authority_type, source_tier, jurisdiction_level, jurisdiction_state, official_url,
  discovery_method, crawl_strategy, check_cadence, active, fixture_content, fixture_extraction
) values (
  'QA FIXTURE — discovery-only gate-rejection proof (not a real program)', 'approved_nonprofit_institutional',
  'discovery_only', 'state', 'TX', 'https://fairpath.test/qa-fixture/discovery-only-gate-proof',
  'manual', 'fixture', 'manual_only', true,
  'QA FIXTURE. A blog post mentioning a Texas workforce program. Discovery-only - not authoritative.',
  '{"program_name":"Texas Test Workforce Mention","program_domain":"employment","administering_authority":"Texas Workforce Commission","jurisdiction_level":"state","jurisdiction_state":"TX","benefit_type":"tax_credit","benefit_maximum":5000,"effective_date":"2027-01-01","eligibility_criteria":"QA FIXTURE test data.","confidence":0.95,"uncertain_fields":[]}'::jsonb
);
