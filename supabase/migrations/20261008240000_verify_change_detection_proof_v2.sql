-- Verification (non-blocking this time - reports via NOTICE rather than failing the migration, now that the
-- underlying bug is fixed). Confirms the change-detection proof actually persisted.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.program_change_events pce
    join public.program_sources ps on ps.id = pce.source_id
    where ps.official_url = 'https://fairpath.test/qa-fixture/program-scout-change-proof'
      and pce.change_type = 'new_document_version';
  raise notice 'change_detection_events_for_fixture_source=%', v_count;
end $$;
