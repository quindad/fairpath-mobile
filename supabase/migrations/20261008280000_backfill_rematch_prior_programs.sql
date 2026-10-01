-- Backfill: the 6 programs seeded in the prior pass (before program_scout_rematch_program existed) were
-- inserted directly into incentive_programs, never through program_scout_promote_candidate - so no
-- opportunity_matches row was ever created for them, and a member with a matching address saw nothing from the
-- new persisted-matches read path even though the old query-time path would have shown them. Runs the same
-- rematch function promotion already calls, once per existing verified_active program, so persisted matches
-- catch up to what was already true.
do $$
declare v_program record;
begin
  for v_program in select id from public.incentive_programs where research_status = 'verified_active' loop
    perform public.program_scout_rematch_program(v_program.id);
  end loop;
end $$;
