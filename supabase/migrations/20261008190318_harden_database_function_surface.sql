-- Pin helper-function name resolution and remove internal trigger functions from the API surface.
alter function public.credit_norm(text) set search_path = pg_catalog, public;
alter function public.document_file_name(text, text, integer, date) set search_path = pg_catalog, public;
alter function public.document_safe_token(text) set search_path = pg_catalog, public;
alter function public.entitlement_audit_log_immutable() set search_path = pg_catalog, public;
alter function public.member_meetings_touch() set search_path = pg_catalog, public;
alter function public.member_profile_validate() set search_path = pg_catalog, public;
alter function public.member_resumes_limit() set search_path = pg_catalog, public;
alter function public.member_resumes_touch() set search_path = pg_catalog, public;
alter function public.member_row_cap() set search_path = pg_catalog, public;
alter function public.referral_events_block_change() set search_path = pg_catalog, public;
alter function public.resource_verification_events_block_change() set search_path = pg_catalog, public;
alter function public.resources_touch_updated_at() set search_path = pg_catalog, public;

do $$
declare
  function_signature regprocedure;
begin
  for function_signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      function_signature
    );
  end loop;
end
$$;
