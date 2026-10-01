-- Program Scout automation, schema support for the worker.
--
-- Adds: content-hash tracking on sources (for change detection), a 'fixture' crawl_strategy + fixture_content
-- column (so the controlled DEV change-detection proof never needs a fake public URL - it's an explicit,
-- clearly-labeled test-data path, not a workaround), a conservative verification-gate function, and an EXPLICIT
-- promotion function. Promotion is deliberately never automatic from the worker alone - "NO AUTO-PUBLISHING
-- RESEARCH" is enforced structurally: the worker can get a candidate to 'rule_verified' (gate passed), but only
-- a separate, explicitly-invoked call can create the incentive_programs/rule_version row a user ever sees.

alter table public.program_sources add column if not exists last_content_hash text;
alter table public.program_sources add column if not exists fixture_content text;

alter table public.program_sources drop constraint if exists program_sources_crawl_strategy_check;
alter table public.program_sources add constraint program_sources_crawl_strategy_check check (crawl_strategy in (
  'html', 'pdf', 'api', 'csv_json_xml', 'document_download', 'fixture', null
));
comment on column public.program_sources.fixture_content is
  'Only used when crawl_strategy=fixture - the retrieval adapter returns this directly instead of making a '
  'network call. Exists so Program Scout''s change-detection path can be proven with explicit, clearly-labeled '
  'DEV test data rather than a fake public URL or a falsified government change.';

-- Conservative gate: a candidate may only be marked gate-passed (lifecycle_status='rule_verified') when its
-- source is tier_1/tier_2 AND every fact the directive calls "required" is present. Anything else -> needs_review,
-- never forced. This function only ever MOVES a candidate to rule_verified or needs_review - it never touches
-- incentive_programs.
create or replace function public.program_scout_evaluate_candidate(p_candidate_id uuid)
returns text -- 'rule_verified' or 'needs_review'
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

  if v_source_tier not in ('tier_1', 'tier_2') then v_reasons := v_reasons || 'source_not_authoritative_tier'; end if;
  if v_candidate.program_name is null then v_reasons := v_reasons || 'missing_program_name'; end if;
  if v_candidate.program_domain is null then v_reasons := v_reasons || 'missing_domain'; end if;
  if v_candidate.benefit_type is null then v_reasons := v_reasons || 'missing_benefit_type'; end if;
  if v_candidate.jurisdiction_level is null then v_reasons := v_reasons || 'missing_jurisdiction_level'; end if;
  if v_candidate.jurisdiction_level = 'state' and v_candidate.jurisdiction_state is null then v_reasons := v_reasons || 'missing_jurisdiction_state'; end if;
  if v_candidate.effective_date is null then v_reasons := v_reasons || 'missing_effective_date'; end if;
  if v_candidate.administering_authority is null then v_reasons := v_reasons || 'missing_administering_authority'; end if;
  if v_candidate.extraction_confidence is not null and v_candidate.extraction_confidence < 0.75 then v_reasons := v_reasons || 'low_extraction_confidence'; end if;

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
revoke all on function public.program_scout_evaluate_candidate(uuid) from public, anon, authenticated;
grant execute on function public.program_scout_evaluate_candidate(uuid) to service_role;

-- The ONLY path a candidate can ever become a real, user-visible incentive_programs row. Never called by the
-- worker automatically - this pass invokes it explicitly as the human/process review step, logged as such via
-- p_verified_by. Creates a NEW rule version (never edits an existing program's prior version) and triggers a
-- scoped rematch for the newly-activated program.
create or replace function public.program_scout_promote_candidate(p_candidate_id uuid, p_program_code text, p_verified_by text)
returns uuid -- new incentive_programs.id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate record;
  v_program_id uuid;
  v_rule_version_id uuid;
begin
  select * into v_candidate from program_candidates where id = p_candidate_id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  if v_candidate.lifecycle_status <> 'rule_verified' then raise exception 'CANDIDATE_NOT_GATE_PASSED'; end if;

  insert into incentive_programs (
    program_code, program_name, program_domain, benefit_type, jurisdiction_level, jurisdiction_state,
    justice_specific, administering_authority, research_status, requires_employer_application,
    requires_government_certification, requires_member_documentation, last_verified_at, last_verified_by
  ) values (
    p_program_code, v_candidate.program_name, v_candidate.program_domain, v_candidate.benefit_type,
    v_candidate.jurisdiction_level, v_candidate.jurisdiction_state, coalesce(v_candidate.program_subtype = 'justice_specific', false),
    v_candidate.administering_authority, 'verified_active', coalesce(v_candidate.application_process is not null, false),
    false, false, now(), p_verified_by
  ) returning id into v_program_id;

  insert into incentive_program_rule_versions (
    program_id, version_number, effective_from, effective_through, eligibility_requirements, application_deadline,
    benefit_formula_type, benefit_formula_detail, maximum_value, minimum_value, official_source_url,
    official_source_title, source_authority, verified_at, verified_by, research_notes
  )
  select v_program_id, 1, v_candidate.effective_date, v_candidate.expiration_date, v_candidate.eligibility_criteria,
    v_candidate.application_period, 'agency_determined',
    jsonb_build_object('amount', v_candidate.benefit_amount, 'percent', v_candidate.benefit_percentage, 'min', v_candidate.benefit_minimum, 'max', v_candidate.benefit_maximum),
    v_candidate.benefit_maximum, v_candidate.benefit_minimum, s.official_url, s.name, s.name, now(), p_verified_by,
    'Promoted from program_candidates ' || p_candidate_id || ' via program_scout_promote_candidate.'
  from program_sources s where s.id = v_candidate.source_id
  returning id into v_rule_version_id;

  update program_candidates set lifecycle_status = 'active', promoted_program_id = v_program_id, promoted_rule_version_id = v_rule_version_id, updated_at = now()
  where id = p_candidate_id;

  perform public.program_scout_rematch_program(v_program_id);
  return v_program_id;
end;
$$;
revoke all on function public.program_scout_promote_candidate(uuid, text, text) from public, anon, authenticated;
grant execute on function public.program_scout_promote_candidate(uuid, text, text) to service_role;

-- Scoped rematch: given one newly-activated/changed program, find the member contexts whose current home
-- address jurisdiction qualifies, and upsert their opportunity_matches row. Reusable for every future
-- state/federal program - never hardcoded to one state. Organization (job/housing) contexts are not yet wired
-- to persisted matches (still query-time only, as in the prior pass) - that remains a known gap, not silently
-- skipped.
create or replace function public.program_scout_rematch_program(p_program_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program record;
  v_rule_version_id uuid;
  v_count integer;
begin
  select * into v_program from incentive_programs where id = p_program_id and research_status = 'verified_active';
  if not found then return 0; end if;
  select id into v_rule_version_id from incentive_program_rule_versions where program_id = p_program_id order by version_number desc limit 1;
  if v_rule_version_id is null then return 0; end if;

  insert into opportunity_matches (context_type, context_id, member_id, program_id, rule_version_id, geography_match_basis, match_status, assessed_at, stale)
  select 'member', a.user_id, a.user_id, p_program_id, v_rule_version_id,
    jsonb_build_object('matched_on', 'home_address_state', 'state', a.state), 'potential_match', now(), false
  from public.addresses a
  where a.label = 'home' and a.is_current = true
    and (v_program.jurisdiction_level = 'federal' or a.state = v_program.jurisdiction_state)
  on conflict (context_type, context_id, program_id) do update set
    rule_version_id = excluded.rule_version_id, geography_match_basis = excluded.geography_match_basis,
    assessed_at = now(), stale = false, updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.program_scout_rematch_program(uuid) from public, anon, authenticated;
grant execute on function public.program_scout_rematch_program(uuid) to service_role;

-- Fires when a member's current home address changes - rematches them against every currently verified_active
-- program whose jurisdiction now covers them (growing their opportunity list reactively, not waiting for the
-- member to re-open the app and re-trigger a query). Does not retract matches for a state they've left (a known,
-- reported limitation) - growing coverage correctly is proven; shrinking it is not yet handled.
create or replace function public.addresses_rematch_on_current_home_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.label = 'home' and new.is_current = true then
    insert into public.opportunity_matches (context_type, context_id, member_id, program_id, rule_version_id, geography_match_basis, match_status, assessed_at, stale)
    select 'member', new.user_id, new.user_id, p.id,
      (select id from incentive_program_rule_versions where program_id = p.id order by version_number desc limit 1),
      jsonb_build_object('matched_on', 'home_address_state', 'state', new.state), 'potential_match', now(), false
    from incentive_programs p
    where p.research_status = 'verified_active'
      and (p.jurisdiction_level = 'federal' or p.jurisdiction_state = new.state)
    on conflict (context_type, context_id, program_id) do update set
      geography_match_basis = excluded.geography_match_basis, assessed_at = now(), stale = false, updated_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists addresses_rematch_trigger on public.addresses;
create trigger addresses_rematch_trigger
  after insert or update of state, is_current, label on public.addresses
  for each row execute function public.addresses_rematch_on_current_home_change();
