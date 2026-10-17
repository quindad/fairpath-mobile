-- FP-C001 (fairpath-integration-hub CONTRACTS.md): record_document_consent(text,text,boolean)
-- Mobile client (src/core/profile/consent-service.ts) calls this RPC for terms/privacy acceptance.
-- A SECURITY DEFINER wrapper (rather than a direct insert, which RLS already allows) so the server -
-- not the client - decides which event types this narrow path can record, and so proof of terms/
-- privacy acceptance can't silently use an untracked signature. Every other consent_events event type
-- still goes through the direct insert path in consent-service.ts, unchanged.
create or replace function public.record_document_consent(
  p_event_type text,
  p_document_version text,
  p_granted boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_event_type not in ('terms_accepted', 'privacy_accepted') then
    raise exception 'INVALID_EVENT_TYPE';
  end if;
  if p_document_version is null or btrim(p_document_version) = '' then
    raise exception 'DOCUMENT_VERSION_REQUIRED';
  end if;

  insert into public.consent_events (user_id, event_type, document_version, granted)
  values (v_user_id, p_event_type, p_document_version, coalesce(p_granted, true));
end;
$$;

revoke all on function public.record_document_consent(text, text, boolean) from public;
grant execute on function public.record_document_consent(text, text, boolean) to authenticated;
