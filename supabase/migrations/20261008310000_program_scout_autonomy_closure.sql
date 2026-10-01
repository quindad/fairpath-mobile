-- Program Scout autonomy closure, schema half. Closes three real gaps identified before touching code:
--
-- 1. "Never silently preserve stale money claims" - a change_event on an already-promoted program's source
--    previously only created a review-queue item; it never touched the member/employer-facing
--    opportunity_matches rows already relying on the old rule version. Adds a function that marks them stale.
-- 2. Document-type classification (statute/regulation vs official agency guidance vs official program page vs
--    official application document vs local-government page vs secondary explanation vs discovery-only) is a
--    different axis than source_tier (which authority administers the source) - a tier_1 state agency can still
--    host a secondary explainer page alongside its actual regulation text. Added to program_candidates, since
--    document type is a property of what was actually read, not fixed per source.
-- 3. Deterministic fixture-extraction support: program_sources.fixture_extraction lets the worker prove its
--    FULL candidate-creation/confidence/review-queue code path today, without a live model call, using
--    explicit DEV test data - distinct from "nothing extracted" (the honest state for every real source right
--    now) and distinct from fabricating a live AI result.

alter table public.program_candidates add column if not exists source_document_type text
  check (source_document_type in (
    'statute_regulation', 'official_agency_guidance', 'official_program_page', 'official_application_document',
    'local_government_page', 'secondary_explanation', 'discovery_only_source', null
  ));

alter table public.program_sources add column if not exists fixture_extraction jsonb;
comment on column public.program_sources.fixture_extraction is
  'Only meaningful when crawl_strategy=fixture. When set, the worker uses this as the extraction engine''s raw '
  'output directly (no network/model call) - proves the full candidate-creation/validation/gate/review-queue '
  'code path deterministically. Never set on a real (non-fixture) source.';

-- Marks every opportunity_matches row relying on a program whose source just changed as stale, so Mobile/Partner
-- can flag "this opportunity needs re-verification" instead of silently continuing to show a now-questionable
-- amount. Does NOT delete or hide the match - stale is a status to surface, not a reason to vanish (needs
-- real-user testing before deciding to flag the match visibly in that state).
create or replace function public.program_scout_mark_matches_stale(p_program_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.opportunity_matches
    set stale = true, updated_at = now()
    where program_id = p_program_id and stale = false;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.program_scout_review_queue (item_type, reference_id, reason, priority)
    values ('program_status', p_program_id, format('%s existing opportunity_matches marked stale: %s', v_count, p_reason), 'high');
  end if;
  return v_count;
end;
$$;
revoke all on function public.program_scout_mark_matches_stale(uuid, text) from public, anon, authenticated;
grant execute on function public.program_scout_mark_matches_stale(uuid, text) to service_role;
