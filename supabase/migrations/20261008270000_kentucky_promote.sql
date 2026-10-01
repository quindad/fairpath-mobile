-- Explicit, deliberate promotion - the human/process review step. Fails loudly if the gate didn't actually pass
-- (program_scout_promote_candidate raises CANDIDATE_NOT_GATE_PASSED), which is itself a useful assertion.
select public.program_scout_promote_candidate(
  (select id from public.program_candidates where source_section = 'Employer''s Unemployment Tax Credit page'),
  'KY-UNEMPLOYMENT-TAX-CREDIT',
  'juice-2026-10-01-vertical-proof'
);
