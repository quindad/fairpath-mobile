-- Convert the evaluator's JSON missing-input list to the evaluations table's text[] type.
create or replace function public.replace_record_relief_evaluations(p_case uuid,p_user uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;
begin
 if p_user is null or not exists(select 1 from public.record_relief_cases where id=p_case and user_id=p_user) then raise exception 'CASE_UNAVAILABLE'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>100 then raise exception 'INVALID_ROWS'; end if;
 update public.record_relief_evaluations set superseded=true where case_id=p_case and user_id=p_user and not superseded;
 insert into public.record_relief_evaluations(case_id,user_id,jurisdiction_code,remedy,outcome,eligibility_date,days_remaining,inputs_used,missing_inputs,reasons,rule_stale,engine_version,next_reevaluate_at)
 select p_case,p_user,x.jurisdiction_code,x.remedy,x.outcome,x.eligibility_date,x.days_remaining,
 coalesce(x.inputs_used,'{}'::jsonb),
 coalesce((select array_agg(e.value order by e.ordinality) from jsonb_array_elements_text(coalesce(x.missing_inputs,'[]'::jsonb)) with ordinality as e(value,ordinality)),array[]::text[]),
 coalesce(x.reasons,'[]'::jsonb),coalesce(x.rule_stale,false),x.engine_version,x.next_reevaluate_at
 from jsonb_to_recordset(p_rows) as x(jurisdiction_code text,remedy text,outcome text,eligibility_date date,days_remaining integer,inputs_used jsonb,missing_inputs jsonb,reasons jsonb,rule_stale boolean,engine_version text,next_reevaluate_at timestamptz);
 get diagnostics n=row_count;return n;
end$$;
