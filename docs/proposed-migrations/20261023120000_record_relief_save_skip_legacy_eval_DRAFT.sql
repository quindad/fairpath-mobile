-- DRAFT ONLY — DO NOT APPLY without counsel + backend approval.
-- DEF-RR-001: stop save_record_relief_case from persisting misleading legacy DB evaluations
-- before the evaluate-record-relief Edge function runs (mobile already treats Edge as authoritative).

create or replace function public.save_record_relief_case(p_id uuid, p jsonb)
returns public.record_relief_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.record_relief_cases%rowtype;
  n integer;
  skip_legacy boolean := coalesce((p ->> 'skip_legacy_eval')::boolean, true);
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  if not exists (select 1 from public.record_relief_jurisdictions j where j.code = p ->> 'jurisdiction_code') then raise exception 'INVALID_JURISDICTION'; end if;

  if p_id is null then
    select count(*) into n from public.record_relief_cases x where x.user_id = uid;
    if n >= 30 then raise exception 'CASE_LIMIT'; end if;
    insert into public.record_relief_cases (
      user_id, jurisdiction_code, label, court_name, case_number, offense_description, offense_class, disposition, is_juvenile, out_of_state_conviction,
      conviction_date, disposition_date, sentence_completion_date, supervision_completion_date, release_date, fines_paid, restitution_paid, other_convictions_count, pending_charges, notes)
    values (uid, p ->> 'jurisdiction_code', btrim(p ->> 'label'), nullif(btrim(p ->> 'court_name'), ''), nullif(btrim(p ->> 'case_number'), ''), nullif(btrim(p ->> 'offense_description'), ''),
      coalesce(p ->> 'offense_class', 'other'), coalesce(p ->> 'disposition', 'conviction'), coalesce((p ->> 'is_juvenile')::boolean, false), coalesce((p ->> 'out_of_state_conviction')::boolean, false),
      nullif(p ->> 'conviction_date', '')::date, nullif(p ->> 'disposition_date', '')::date, nullif(p ->> 'sentence_completion_date', '')::date,
      nullif(p ->> 'supervision_completion_date', '')::date, nullif(p ->> 'release_date', '')::date, (p ->> 'fines_paid')::boolean, (p ->> 'restitution_paid')::boolean,
      nullif(p ->> 'other_convictions_count', '')::integer, (p ->> 'pending_charges')::boolean, nullif(btrim(p ->> 'notes'), ''))
    returning * into result;
    insert into public.record_relief_case_events (case_id, user_id, event_type) values (result.id, uid, 'created');
  else
    update public.record_relief_cases x set
      jurisdiction_code = p ->> 'jurisdiction_code', label = btrim(p ->> 'label'), court_name = nullif(btrim(p ->> 'court_name'), ''), case_number = nullif(btrim(p ->> 'case_number'), ''),
      offense_description = nullif(btrim(p ->> 'offense_description'), ''), offense_class = coalesce(p ->> 'offense_class', 'other'), disposition = coalesce(p ->> 'disposition', 'conviction'),
      is_juvenile = coalesce((p ->> 'is_juvenile')::boolean, false), out_of_state_conviction = coalesce((p ->> 'out_of_state_conviction')::boolean, false),
      conviction_date = nullif(p ->> 'conviction_date', '')::date, disposition_date = nullif(p ->> 'disposition_date', '')::date, sentence_completion_date = nullif(p ->> 'sentence_completion_date', '')::date,
      supervision_completion_date = nullif(p ->> 'supervision_completion_date', '')::date, release_date = nullif(p ->> 'release_date', '')::date,
      fines_paid = (p ->> 'fines_paid')::boolean, restitution_paid = (p ->> 'restitution_paid')::boolean, other_convictions_count = nullif(p ->> 'other_convictions_count', '')::integer,
      pending_charges = (p ->> 'pending_charges')::boolean, notes = nullif(btrim(p ->> 'notes'), ''), updated_at = now()
    where x.id = p_id and x.user_id = uid returning * into result;
    if not found then raise exception 'CASE_UNAVAILABLE'; end if;
    insert into public.record_relief_case_events (case_id, user_id, event_type) values (result.id, uid, 'inputs_updated');
  end if;

  -- Legacy path (phased rollback): set skip_legacy_eval=false in payload to restore evaluate_record_relief_case on save.
  if not skip_legacy then
    perform public.evaluate_record_relief_case(result.id);
  end if;

  return result;
end;
$$;

comment on function public.save_record_relief_case(uuid, jsonb) is
  'Persists member case inputs. Default skip_legacy_eval=true avoids rule_unavailable placeholders when the shared Edge engine will evaluate immediately after save.';
