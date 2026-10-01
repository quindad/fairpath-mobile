-- Strict verification: fails the migration (and therefore this push) if the change-detection proof did not
-- actually persist. A clean "Finished" response from `supabase db push` after this migration IS the proof.
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.program_change_events pce
    join public.program_sources ps on ps.id = pce.source_id
    where ps.official_url = 'https://fairpath.test/qa-fixture/program-scout-change-proof'
      and pce.change_type = 'new_document_version';
  if v_count < 1 then raise exception 'VERIFICATION_FAILED: no change_event persisted for fixture source'; end if;
end $$;
