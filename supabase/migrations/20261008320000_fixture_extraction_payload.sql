-- Sets a deterministic, hand-authored "extraction engine output" on the QA fixture source, shaped exactly like
-- what a real model call would return (matching EXTRACTION_TOOL_SCHEMA). Proves the worker's own
-- extraction-handling code (validateCandidateExtraction -> insertCandidate -> program_scout_evaluate_candidate)
-- runs for real today, without a live ANTHROPIC_API_KEY. The content_type stays 'discovery_only' authority-wise
-- (fixture source), so the gate must correctly route this to needs_review, not rule_verified - proving the gate
-- also still enforces source trust even when extraction itself succeeds cleanly.
update public.program_sources set fixture_extraction = '{
  "program_name": "Illinois Test Workforce Credit",
  "program_domain": "employment",
  "administering_authority": "Illinois Department of Revenue",
  "jurisdiction_level": "state",
  "jurisdiction_state": "IL",
  "benefit_type": "tax_credit",
  "benefit_percentage": 30,
  "benefit_maximum": 6000,
  "effective_date": "2027-01-01",
  "eligibility_criteria": "QA FIXTURE VERSION C test data - not a real program.",
  "confidence": 0.92,
  "uncertain_fields": []
}'::jsonb
where official_url = 'https://fairpath.test/qa-fixture/program-scout-change-proof';
