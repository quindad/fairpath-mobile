-- Re-proves change detection with the fixed worker code (20261008220000 removed the constraint that silently
-- dropped the previous attempt's change_event insert). Version C simulates another real-world content change.
update public.program_sources set
  fixture_content = 'QA FIXTURE VERSION C. Illinois Test Workforce Credit. Administered by Illinois Department of Revenue. Benefit: tax_credit, 30 percent of qualified wages, maximum $6,000 per qualifying hire. Effective 2027-01-01. Supersedes the prior 25 percent / $5,000 version. This is fixture test data for Program Scout change detection, not a real program.',
  updated_at = now()
where official_url = 'https://fairpath.test/qa-fixture/program-scout-change-proof';
