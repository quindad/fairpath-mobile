alter table public.record_relief_evaluations drop constraint if exists record_relief_evaluations_outcome_check;
alter table public.record_relief_evaluations add constraint record_relief_evaluations_outcome_check check(outcome in(
'likely_eligible_verified','waiting_period','likely_excluded_verified','automatic_relief_may_apply','court_or_prosecutor_discretion','additional_facts_required','rule_not_verified','legal_review_recommended',
'potentially_eligible_now','potentially_ineligible','insufficient_information','manual_review','rule_unavailable','federal_separate'
));
alter table public.record_relief_evaluations add column if not exists engine_version text;
alter table public.record_relief_evaluations add column if not exists next_reevaluate_at timestamptz;
comment on column public.record_relief_evaluations.rule_version is 'Numeric published legal rule/data version. Distinct from engine_version.';
comment on column public.record_relief_evaluations.engine_version is 'Shared TypeScript engine/code version used for this evaluation. Legacy rows may be null.';
