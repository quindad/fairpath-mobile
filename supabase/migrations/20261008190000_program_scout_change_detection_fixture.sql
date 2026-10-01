-- Controlled DEV proof for change detection (program_change_events), per explicit instruction: never falsify a
-- real government change - use a fixture source clearly designated as test data instead. crawl_strategy='fixture'
-- means the worker's retrieval adapter returns fixture_content directly, no network call, no real URL claimed
-- to be authoritative.
insert into public.program_sources (
  name, authority_type, source_tier, jurisdiction_level, jurisdiction_state, official_url,
  discovery_method, crawl_strategy, check_cadence, active, fixture_content
) values (
  'QA FIXTURE — Program Scout change-detection proof (not a real program)', 'other_verified_authority', 'tier_1',
  'state', 'IL', 'https://fairpath.test/qa-fixture/program-scout-change-proof',
  'manual', 'fixture', 'manual_only', true,
  'QA FIXTURE VERSION A. Illinois Test Workforce Credit. Administered by Illinois Department of Revenue. Benefit: tax_credit, 20 percent of qualified wages, maximum $4,000 per qualifying hire. Effective 2026-01-01. This is fixture test data for Program Scout change detection, not a real program.'
);
