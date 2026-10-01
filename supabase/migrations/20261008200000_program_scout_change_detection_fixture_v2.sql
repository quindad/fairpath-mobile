-- Simulates the source's real-world content changing - the controlled "version B" half of the change-detection
-- proof. A real government page changing is out of FairPath's control; this fixture update is the stand-in for
-- that, on data already explicitly labeled as a QA fixture, not a real program.
update public.program_sources set
  fixture_content = 'QA FIXTURE VERSION B. Illinois Test Workforce Credit. Administered by Illinois Department of Revenue. Benefit: tax_credit, 25 percent of qualified wages, maximum $5,000 per qualifying hire. Effective 2026-07-01. Supersedes the prior 20 percent / $4,000 version. This is fixture test data for Program Scout change detection, not a real program.',
  updated_at = now()
where official_url = 'https://fairpath.test/qa-fixture/program-scout-change-proof';
