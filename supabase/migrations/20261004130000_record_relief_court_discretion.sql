-- Real gap found reading the Ohio candidate research (RT-CONF-002, OHIO_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md):
-- "Adult Court Discretion Is a Hard Boundary" - CONFIRMED finding, explicit engineering treatment recommended:
-- "Require court_discretion: true. Output POTENTIALLY_ELIGIBLE or MANUAL_REVIEW_REQUIRED. Do not output
-- LEGALLY_ELIGIBLE or GUARANTEED_TO_BE_GRANTED."
--
-- The evaluation engine (public.evaluate_record_relief_case, read in full from the real migration file before
-- writing this one - a near-miss caught here: an earlier draft of this file guessed the wrong parameter name
-- (p_case_id instead of the real p_case) and a materially different function body, which would have created a
-- duplicate overloaded function instead of replacing the real one) already never emits an unqualified "eligible"
-- outcome - 'potentially_eligible_now' already always carries the reason text "That is not a guarantee: a court
-- decides." for every rule, universally. So this is not a blocking safety gap; the hard requirement was already
-- structurally satisfied. It IS a real gap for honesty and future data-ops: nothing distinguishes a rule where
-- satisfying objective elements is close to sufficient from one where, per Ohio research, a court must still
-- make an individualized rehabilitation/balancing finding regardless.
--
-- Purely additive. This migration is IDENTICAL to the existing evaluate_record_relief_case() body except for one
-- new line appending a 'court_discretion' reason when the flag is set - every other line is unchanged.

alter table public.record_relief_rules
  add column if not exists court_discretion boolean not null default false;

comment on column public.record_relief_rules.court_discretion is
  'true when satisfying this rule''s objective/statutory elements does not guarantee the court grants relief - '
  'an individualized judicial finding (e.g. rehabilitation, interest-balancing) remains required regardless. '
  'Named directly by Ohio red-team finding RT-CONF-002. The evaluation engine already never outputs an '
  'unqualified "eligible" result for any rule (see the universal court-decides disclaimer on '
  'potentially_eligible_now) - this column is for honest differentiation and future filtering/reporting, not a '
  'change to evaluation safety, which was already structurally sound.';

create or replace function public.evaluate_record_relief_case(p_case uuid)
returns setof public.record_relief_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.record_relief_cases%rowtype;
  r public.record_relief_rules%rowtype;
  any_rules boolean;
  matched integer := 0;
  anchor date;
  elig date;
  missing text[];
  reasons jsonb;
  inputs jsonb;
  outcome text;
  stale boolean;
  ev public.record_relief_evaluations%rowtype;
begin
  if uid is null then raise exception 'SIGNED_OUT'; end if;
  select * into c from public.record_relief_cases x where x.id = p_case and x.user_id = uid;
  if not found then raise exception 'CASE_UNAVAILABLE'; end if;

  update public.record_relief_evaluations e set superseded = true where e.case_id = c.id and not e.superseded;

  -- Federal branch: never run through a state calculator.
  if c.jurisdiction_code = 'US-FED' then
    insert into public.record_relief_evaluations (case_id, user_id, jurisdiction_code, outcome, reasons)
    values (c.id, uid, c.jurisdiction_code, 'federal_separate',
      jsonb_build_array(jsonb_build_object('code', 'federal_separate', 'text', 'Federal cases are handled separately from state record relief. State expungement rules do not apply to federal convictions. See the federal pathways listed for this case; where none are verified, FairPath does not yet have verified federal information to show.')))
    returning * into ev;
    return next ev;
    insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (c.id, uid, 'evaluated', 'federal');
    return;
  end if;

  select exists (select 1 from public.record_relief_active_rules(c.jurisdiction_code)) into any_rules;
  if not any_rules then
    insert into public.record_relief_evaluations (case_id, user_id, jurisdiction_code, outcome, reasons)
    values (c.id, uid, c.jurisdiction_code, 'rule_unavailable',
      jsonb_build_array(jsonb_build_object('code', 'no_verified_rules', 'text', 'FairPath does not have verified record-relief rules for this jurisdiction yet, so it cannot tell you anything about eligibility. That does not mean relief is unavailable. A legal aid organization or the court clerk can tell you what applies.')))
    returning * into ev;
    return next ev;
    insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (c.id, uid, 'evaluated', 'no rules');
    return;
  end if;

  for r in select * from public.record_relief_active_rules(c.jurisdiction_code) order by remedy, rule_key loop
    -- Only rules that describe this kind of disposition / offense are relevant.
    if cardinality(r.applies_dispositions) > 0 and not (c.disposition = any (r.applies_dispositions)) then continue; end if;
    if cardinality(r.applies_offense_classes) > 0 and not (c.offense_class = any (r.applies_offense_classes)) and not (c.offense_class = any (r.excluded_offense_classes)) then continue; end if;
    matched := matched + 1;

    stale := r.last_verified_at is null or r.last_verified_at < (current_date - 365);
    reasons := '[]'::jsonb;
    missing := '{}';
    inputs := jsonb_build_object('offense_class', c.offense_class, 'disposition', c.disposition);
    anchor := null; elig := null; outcome := null;

    -- 1. definite exclusions / conditions that are already known to fail
    if c.offense_class = any (r.excluded_offense_classes) then
      outcome := 'potentially_ineligible';
      reasons := reasons || jsonb_build_object('code', 'excluded_offense', 'text', 'This rule lists this kind of offense as excluded.');
    end if;
    if r.requires_no_pending_charges then
      if c.pending_charges is true then outcome := 'potentially_ineligible'; reasons := reasons || jsonb_build_object('code', 'pending_charges', 'text', 'This rule requires no pending charges.');
      elsif c.pending_charges is null then missing := array_append(missing, 'pending_charges'); end if;
      inputs := inputs || jsonb_build_object('pending_charges', c.pending_charges);
    end if;
    if r.max_other_convictions is not null then
      if c.other_convictions_count is null then missing := array_append(missing, 'other_convictions_count');
      elsif c.other_convictions_count > r.max_other_convictions then
        outcome := 'potentially_ineligible';
        reasons := reasons || jsonb_build_object('code', 'other_convictions', 'text', 'This rule allows at most ' || r.max_other_convictions || ' other conviction(s); you entered ' || c.other_convictions_count || '.');
      end if;
      inputs := inputs || jsonb_build_object('other_convictions_count', c.other_convictions_count);
    end if;
    if r.requires_fines_paid then
      if c.fines_paid is false then outcome := 'potentially_ineligible'; reasons := reasons || jsonb_build_object('code', 'fines_unpaid', 'text', 'This rule requires fines to be paid.');
      elsif c.fines_paid is null then missing := array_append(missing, 'fines_paid'); end if;
      inputs := inputs || jsonb_build_object('fines_paid', c.fines_paid);
    end if;
    if r.requires_restitution_paid then
      if c.restitution_paid is false then outcome := 'potentially_ineligible'; reasons := reasons || jsonb_build_object('code', 'restitution_unpaid', 'text', 'This rule requires restitution to be paid.');
      elsif c.restitution_paid is null then missing := array_append(missing, 'restitution_paid'); end if;
      inputs := inputs || jsonb_build_object('restitution_paid', c.restitution_paid);
    end if;

    -- 2. the date the waiting period starts from
    anchor := case r.waiting_anchor
      when 'disposition_date' then c.disposition_date
      when 'conviction_date' then c.conviction_date
      when 'sentence_completion_date' then c.sentence_completion_date
      when 'supervision_completion_date' then c.supervision_completion_date
      when 'release_date' then c.release_date
      else (select max(d) from unnest(array[c.sentence_completion_date, c.supervision_completion_date, c.release_date]) d) end;
    inputs := inputs || jsonb_build_object('waiting_anchor', r.waiting_anchor, 'anchor_date', anchor);
    if anchor is null and (r.waiting_years + r.waiting_months + r.waiting_days) > 0 then
      missing := array_append(missing, replace(r.waiting_anchor, 'latest_completion', 'completion_dates'));
    end if;

    -- 3. flags that make an automatic answer inappropriate
    if (c.is_juvenile and 'juvenile' = any (r.manual_review_flags)) or (c.out_of_state_conviction and 'out_of_state_conviction' = any (r.manual_review_flags)) then
      if outcome is null then outcome := 'manual_review'; end if;
      reasons := reasons || jsonb_build_object('code', 'manual_review', 'text', 'Something about this case (for example a juvenile record or a conviction from another state) can change which rules apply. Have a legal aid organization or the court clerk review it.');
    end if;

    if outcome is null and cardinality(missing) > 0 then
      outcome := 'insufficient_information';
      reasons := reasons || jsonb_build_object('code', 'missing_inputs', 'text', 'Add the missing information so this rule can be checked.');
    end if;

    if outcome is null then
      if anchor is not null then elig := anchor + make_interval(years => r.waiting_years, months => r.waiting_months, days => r.waiting_days); end if;
      if elig is null or elig <= current_date then
        outcome := 'potentially_eligible_now';
        reasons := reasons || jsonb_build_object('code', 'conditions_met', 'text', 'Based on what you entered, you appear to meet this rule''s conditions. That is not a guarantee: a court decides.');
      else
        outcome := 'waiting_period';
        reasons := reasons || jsonb_build_object('code', 'waiting', 'text', 'This rule requires a waiting period counted from ' || replace(r.waiting_anchor, '_', ' ') || ' (' || anchor::text || ').');
      end if;
    end if;
    if outcome = 'potentially_ineligible' then
      -- also compute the date when the only remaining barrier is time, so the member can still see it
      elig := null;
    end if;
    -- NEW: the one addition this migration makes. Every other line above/below is unchanged from the original.
    if r.court_discretion then
      reasons := reasons || jsonb_build_object('code', 'court_discretion', 'text', 'Even when the timing and other conditions are met, the court must still make its own individualized decision on this type of case. Meeting the conditions does not guarantee the court will grant it.');
    end if;
    if stale then reasons := reasons || jsonb_build_object('code', 'rule_stale', 'text', 'This rule was last verified on ' || coalesce(r.last_verified_at::text, 'an unknown date') || ', which is over a year ago. Confirm it is still current with the source.'); end if;

    insert into public.record_relief_evaluations (case_id, user_id, rule_id, rule_key, rule_version, jurisdiction_code, remedy, outcome, eligibility_date, days_remaining, inputs_used, missing_inputs, reasons, rule_stale)
    values (c.id, uid, r.id, r.rule_key, r.rule_version, c.jurisdiction_code, r.remedy, outcome, elig,
            case when elig is not null then greatest(0, elig - current_date) end, inputs, missing, reasons, stale)
    returning * into ev;
    return next ev;
  end loop;

  if matched = 0 then
    insert into public.record_relief_evaluations (case_id, user_id, jurisdiction_code, outcome, reasons)
    values (c.id, uid, c.jurisdiction_code, 'manual_review',
      jsonb_build_array(jsonb_build_object('code', 'no_matching_rule', 'text', 'None of the verified rules FairPath has for this jurisdiction covers this offense type and disposition. That does not mean relief is unavailable. A legal aid organization or the court clerk can tell you what applies.')))
    returning * into ev;
    return next ev;
  end if;
  insert into public.record_relief_case_events (case_id, user_id, event_type, detail) values (c.id, uid, 'evaluated', matched::text || ' rule(s)');
  return;
end;
$$;
