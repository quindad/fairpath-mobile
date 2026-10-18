-- record_document_consent wrote consent_events only; routing reads profiles.*_accepted_*.
-- Keep ledger + denormalized profile pointers in sync inside the RPC.
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
  v_granted boolean := coalesce(p_granted, true);
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
  values (v_user_id, p_event_type, p_document_version, v_granted);

  if not v_granted then
    return;
  end if;

  if p_event_type = 'terms_accepted' then
    update public.profiles
    set
      terms_accepted_at = now(),
      terms_accepted_version = p_document_version
    where id = v_user_id;
  else
    update public.profiles
    set
      privacy_accepted_at = now(),
      privacy_accepted_version = p_document_version
    where id = v_user_id;
  end if;
end;
$$;

revoke all on function public.record_document_consent(text, text, boolean) from public;
grant execute on function public.record_document_consent(text, text, boolean) to authenticated;
