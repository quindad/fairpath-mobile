-- Bug fix, caught by its own gate-rejection proof: `v_reasons := v_reasons || 'some_string'` fails with
-- "malformed array literal" because Postgres can't resolve the || operator between a text[] and an untyped
-- string literal unambiguously in this context. array_append() is unambiguous and is the correct way to add one
-- element to an array.
create or replace function public.program_scout_evaluate_candidate(p_candidate_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate record;
  v_source_tier text;
  v_result text;
  v_reasons text[] := '{}';
begin
  select c.* into v_candidate from program_candidates c where c.id = p_candidate_id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  select s.source_tier into v_source_tier from program_sources s where s.id = v_candidate.source_id;

  if v_source_tier not in ('tier_1', 'tier_2') then v_reasons := array_append(v_reasons, 'source_not_authoritative_tier'); end if;
  if v_candidate.program_name is null then v_reasons := array_append(v_reasons, 'missing_program_name'); end if;
  if v_candidate.program_domain is null then v_reasons := array_append(v_reasons, 'missing_domain'); end if;
  if v_candidate.benefit_type is null then v_reasons := array_append(v_reasons, 'missing_benefit_type'); end if;
  if v_candidate.jurisdiction_level is null then v_reasons := array_append(v_reasons, 'missing_jurisdiction_level'); end if;
  if v_candidate.jurisdiction_level = 'state' and v_candidate.jurisdiction_state is null then v_reasons := array_append(v_reasons, 'missing_jurisdiction_state'); end if;
  if v_candidate.effective_date is null then v_reasons := array_append(v_reasons, 'missing_effective_date'); end if;
  if v_candidate.administering_authority is null then v_reasons := array_append(v_reasons, 'missing_administering_authority'); end if;
  if v_candidate.extraction_confidence is not null and v_candidate.extraction_confidence < 0.75 then v_reasons := array_append(v_reasons, 'low_extraction_confidence'); end if;

  if array_length(v_reasons, 1) is null then
    v_result := 'rule_verified';
    update program_candidates set lifecycle_status = 'rule_verified', updated_at = now() where id = p_candidate_id;
  else
    v_result := 'needs_review';
    update program_candidates set lifecycle_status = 'needs_review', updated_at = now() where id = p_candidate_id;
    insert into program_scout_review_queue (item_type, reference_id, reason, priority)
    values ('extraction_uncertainty', p_candidate_id, array_to_string(v_reasons, ', '), 'normal');
  end if;
  return v_result;
end;
$$;
