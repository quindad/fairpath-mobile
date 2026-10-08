-- Legacy metadata-only cleanup must never masquerade as physical Storage deletion.
-- Daily cleanup uses invoke_record_relief_retention() -> Edge Function -> Storage remove -> row scrub.
create or replace function public.record_relief_mark_expired()
returns integer language plpgsql security definer set search_path=public as $$
begin
 raise exception 'RECORD_RELIEF_RETENTION_USE_STORAGE_SWEEP' using errcode='P0001';
end$$;
revoke all on function public.record_relief_mark_expired() from public,anon,authenticated;
