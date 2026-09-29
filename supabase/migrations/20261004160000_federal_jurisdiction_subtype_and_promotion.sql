-- Federal candidate-data processing pass. Read the full Federal V1 + V1.1 red-team packages
-- (docs/research/record-relief/federal/) before writing this. Two real gaps found and closed:
--
-- 1. record_relief_federal_pathways had no jurisdiction_subtype - the red-team's own BLOCKER-severity finding
--    (FED-RT-002) is explicit: United States Code, D.C. Code, Code of Federal Regulations, and Uniform Code of
--    Military Justice offenses must never be collapsed into one generic "federal_conviction" field, because they
--    have different courts, records, and procedures even where they share presidential clemency authority.
-- 2. pathway_type/effect_summary/rights_not_restored (added earlier this session, before the Federal package
--    arrived) were never actually wired into the member-facing get_record_relief_case_detail() query - the
--    columns existed but nothing read them. A member looking at a case would see a pathway's title and
--    description but not its structural "this is not expungement" distinction. Closed by rewriting the function
--    identically except adding those three fields to the pathways jsonb_build_object.

alter table public.record_relief_federal_pathways
  add column if not exists jurisdiction_subtype text not null default 'unknown'
    check (jurisdiction_subtype in ('united_states_code', 'district_of_columbia_code', 'code_of_federal_regulations',
                                     'uniform_code_of_military_justice', 'unknown'));

comment on column public.record_relief_federal_pathways.jurisdiction_subtype is
  'Required distinction per Federal red-team finding FED-RT-002 (BLOCKER severity): federal, D.C. Code, CFR, and '
  'military convictions have different courts, record systems, and procedures even where presidential clemency '
  'authority is shared. Never collapsed into one generic "federal conviction." Defaults to unknown, which is the '
  'honest state until a candidate specifically classifies it - never a guess.';

-- Identical to the existing get_record_relief_case_detail() except the pathways block now also selects
-- jurisdiction_subtype, pathway_type, effect_summary, and rights_not_restored - every other line unchanged.
create or replace function public.get_record_relief_case_detail(p_case uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.record_relief_cases%rowtype;
  result jsonb;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into c from public.record_relief_cases x where x.id = p_case and x.user_id = uid;
  if not found then raise exception 'CASE_UNAVAILABLE'; end if;
  select jsonb_build_object(
    'evaluations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'outcome', e.outcome, 'remedy', e.remedy, 'eligibility_date', e.eligibility_date, 'days_remaining', case when e.eligibility_date is null then null else greatest(0, e.eligibility_date - current_date) end,
        'inputs_used', e.inputs_used, 'missing_inputs', e.missing_inputs, 'reasons', e.reasons, 'rule_stale', e.rule_stale, 'evaluated_at', e.evaluated_at,
        'rule_key', e.rule_key, 'rule_version', e.rule_version,
        'rule_changed', (e.rule_id is not null and not exists (select 1 from public.record_relief_active_rules(c.jurisdiction_code) a where a.id = e.rule_id)),
        'rule', (select jsonb_build_object('title', r.title, 'summary', r.summary, 'citation_text', r.citation_text, 'source_url', r.source_url, 'source_authority', r.source_authority,
                   'effective_from', r.effective_from, 'last_verified_at', r.last_verified_at, 'rule_version', r.rule_version, 'fees', r.fees, 'filing', r.filing,
                   'required_documents', r.required_documents, 'steps', r.steps, 'form_keys', r.form_keys, 'data_origin', r.data_origin)
                 from public.record_relief_rules r where r.id = e.rule_id))
        order by e.remedy nulls last, e.rule_key)
      from public.record_relief_evaluations e where e.case_id = c.id and not e.superseded), '[]'::jsonb),
    'forms', coalesce((
      select jsonb_agg(jsonb_build_object('form_key', f.form_key, 'name', f.name, 'kind', f.kind, 'revision', f.revision, 'effective_date', f.effective_date,
        'official_source_url', f.official_source_url, 'last_verified_at', f.last_verified_at, 'auto_fillable', f.auto_fillable, 'data_origin', f.data_origin) order by f.name)
      from public.record_relief_forms f where f.jurisdiction_code = c.jurisdiction_code and f.status = 'verified'), '[]'::jsonb),
    'pathways', case when c.jurisdiction_code = 'US-FED' then coalesce((
      select jsonb_agg(jsonb_build_object('pathway_key', p.pathway_key, 'title', p.title, 'description', p.description, 'is_general_expungement', p.is_general_expungement,
        'applies_to', p.applies_to, 'source_url', p.source_url, 'citation_text', p.citation_text, 'last_verified_at', p.last_verified_at, 'data_origin', p.data_origin,
        'jurisdiction_subtype', p.jurisdiction_subtype, 'pathway_type', p.pathway_type, 'effect_summary', p.effect_summary, 'rights_not_restored', p.rights_not_restored) order by p.title)
      from public.record_relief_federal_pathways p where p.status = 'verified'), '[]'::jsonb) else '[]'::jsonb end,
    'checklist', coalesce((select jsonb_agg(jsonb_build_object('kind', k.item_kind, 'key', k.item_key, 'done', k.done)) from public.record_relief_case_checklist k where k.case_id = c.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('event_type', v.event_type, 'detail', v.detail, 'created_at', v.created_at) order by v.created_at) from public.record_relief_case_events v where v.case_id = c.id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Extend promotion to support federal_pathway candidates (was rule-only). Same safety shape: always inserts
-- status='draft', never 'verified'. Requires lifecycle_state='verified' and not schema_blocked, identical to
-- the rule path.
create or replace function public.promote_legal_rule_candidate(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cand public.legal_rule_candidates%rowtype;
  p jsonb;
  new_id uuid;
begin
  select * into cand from public.legal_rule_candidates where id = p_candidate_id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  if cand.lifecycle_state <> 'verified' then raise exception 'CANDIDATE_NOT_VERIFIED'; end if;
  if cand.schema_blocked then raise exception 'CANDIDATE_SCHEMA_BLOCKED'; end if;
  if cand.kind not in ('rule', 'federal_pathway') then raise exception 'UNSUPPORTED_CANDIDATE_KIND'; end if;

  p := cand.payload;

  if cand.kind = 'rule' then
    insert into public.record_relief_rules (
      rule_key, rule_version, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes,
      excluded_offense_classes, waiting_years, waiting_months, waiting_days, waiting_anchor,
      requires_fines_paid, requires_restitution_paid, requires_no_pending_charges, max_other_convictions,
      manual_review_flags, fees, filing, required_documents, steps, form_keys,
      source_authority, source_url, citation_text, effective_from, effective_to,
      researched_by, next_review_at, staff_notes, court_discretion, data_origin, fixture_set, status
    ) values (
      p ->> 'rule_key', coalesce((p ->> 'rule_version')::integer, 1), cand.jurisdiction_code, p ->> 'remedy',
      p ->> 'title', p ->> 'summary',
      coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'applies_dispositions') x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'applies_offense_classes') x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'excluded_offense_classes') x), '{}'),
      coalesce((p ->> 'waiting_years')::integer, 0), coalesce((p ->> 'waiting_months')::integer, 0), coalesce((p ->> 'waiting_days')::integer, 0),
      coalesce(p ->> 'waiting_anchor', 'latest_completion'),
      coalesce((p ->> 'requires_fines_paid')::boolean, false), coalesce((p ->> 'requires_restitution_paid')::boolean, false),
      coalesce((p ->> 'requires_no_pending_charges')::boolean, false), (p ->> 'max_other_convictions')::integer,
      coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'manual_review_flags') x), '{}'),
      coalesce(p -> 'fees', '{}'::jsonb), coalesce(p -> 'filing', '{}'::jsonb), coalesce(p -> 'required_documents', '[]'::jsonb), coalesce(p -> 'steps', '[]'::jsonb),
      coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'form_keys') x), '{}'),
      p ->> 'source_authority', p ->> 'source_url', p ->> 'citation_text', (p ->> 'effective_from')::date, (p ->> 'effective_to')::date,
      coalesce(p ->> 'researched_by', cand.researched_by), (p ->> 'next_review_at')::date, p ->> 'staff_notes',
      coalesce((p ->> 'court_discretion')::boolean, false),
      coalesce(p ->> 'data_origin', 'production'), p ->> 'fixture_set', 'draft'
    ) returning id into new_id;
  else
    insert into public.record_relief_federal_pathways (
      pathway_key, pathway_version, title, description, is_general_expungement, applies_to,
      source_authority, source_url, citation_text, effective_from, jurisdiction_subtype, pathway_type,
      effect_summary, rights_not_restored, data_origin, fixture_set, status
    ) values (
      p ->> 'pathway_key', coalesce((p ->> 'pathway_version')::integer, 1), p ->> 'title', p ->> 'description',
      coalesce((p ->> 'is_general_expungement')::boolean, false), p ->> 'applies_to',
      p ->> 'source_authority', p ->> 'source_url', p ->> 'citation_text', (p ->> 'effective_from')::date,
      coalesce(p ->> 'jurisdiction_subtype', 'unknown'), coalesce(p ->> 'pathway_type', 'other'),
      p ->> 'effect_summary', p ->> 'rights_not_restored',
      coalesce(p ->> 'data_origin', 'production'), p ->> 'fixture_set', 'draft'
    ) returning id into new_id;
  end if;

  update public.legal_rule_candidates set lifecycle_state = 'promoted', promoted_rule_id = new_id, updated_at = now() where id = p_candidate_id;
  if cand.change_candidate_id is not null then
    update public.legal_change_candidates set status = 'promoted', updated_at = now() where id = cand.change_candidate_id;
  end if;
  return new_id;
end;
$$;
