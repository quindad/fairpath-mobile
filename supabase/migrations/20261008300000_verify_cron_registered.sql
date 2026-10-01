do $$
declare v_count integer;
begin
  select count(*) into v_count from cron.job where jobname = 'program-scout-hourly-sweep';
  if v_count <> 1 then raise exception 'VERIFICATION_FAILED: expected 1 cron job, found %', v_count; end if;
end $$;
