-- DRAFT ONLY — professional headline for Opportunity Profile (not applied to shared DEV).
-- Requires separate approval; do not combine with canonical justice migration apply.
--
-- Security review (read-only):
--   * profiles.professional_headline: member-owned row; existing profiles RLS unchanged (owner update only).
--   * build_opportunity_snapshot: SECURITY DEFINER, service_role only; whitelist sections unchanged except optional summary.
--   * summary section exposes headline, career interests, ZIP only — no DOB, address, pay_min_hourly, justice tables.
--   * Clients cannot inject snapshot JSON (submit_job_application ignores client snapshot body).
-- Compatibility: replaces build_opportunity_snapshot body; safe to apply after 20261001130000_opportunity_profile.sql.

alter table public.profiles
  add column if not exists professional_headline text
  check (professional_headline is null or length(btrim(professional_headline)) between 2 and 120);

comment on column public.profiles.professional_headline is
  'Member-authored professional headline for Opportunity Profile preview and optional application snapshot. Self-reported; never verified by FairPath.';

-- Extend employer snapshot whitelist (optional section "summary" — headline + career interests only).
create or replace function public.build_opportunity_snapshot(p_user uuid, p_sections text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed text[] := array['experience', 'education', 'credentials', 'skills', 'preferences', 'availability', 'transportation', 'summary'];
  wanted text[] := array(select s from unnest(coalesce(p_sections, '{}'::text[])) s where s = any (allowed));
  prefs public.member_job_preferences%rowtype;
  prof public.profiles%rowtype;
  snap jsonb := jsonb_build_object('taken_at', now(), 'sections', to_jsonb(wanted));
begin
  if cardinality(wanted) = 0 then return null; end if;
  select * into prefs from public.member_job_preferences mp where mp.user_id = p_user;
  select * into prof from public.profiles p where p.id = p_user;

  if 'summary' = any (wanted) then
    snap := snap || jsonb_build_object('summary', jsonb_build_object(
      'professional_headline', prof.professional_headline,
      'career_interests', coalesce(to_jsonb(prefs.desired_titles), '[]'::jsonb),
      'location_hint', case when prof.zip_code is not null then jsonb_build_object('zip_code', prof.zip_code) else null end
    ));
  end if;

  if 'experience' = any (wanted) then
    snap := snap || jsonb_build_object('work_experience', coalesce((
      select jsonb_agg(jsonb_build_object('job_title', e.job_title, 'employer_name', e.employer_name, 'location', e.location_text,
        'start_date', e.start_date, 'end_date', e.end_date, 'is_current', e.is_current, 'description', e.description)
        order by e.start_date desc)
      from public.member_work_experience e where e.user_id = p_user), '[]'::jsonb));
  end if;
  if 'education' = any (wanted) then
    snap := snap || jsonb_build_object('education', coalesce((
      select jsonb_agg(jsonb_build_object('school_name', e.school_name, 'credential', e.credential, 'field_of_study', e.field_of_study,
        'start_year', e.start_year, 'end_year', e.end_year, 'status', e.status) order by e.end_year desc nulls first)
      from public.member_education e where e.user_id = p_user), '[]'::jsonb));
  end if;
  if 'credentials' = any (wanted) then
    snap := snap || jsonb_build_object('credentials', coalesce((
      select jsonb_agg(jsonb_build_object('credential_type', c.credential_type, 'name', c.name, 'issuer', c.issuer,
        'issued_date', c.issued_date, 'expires_date', c.expires_date) order by c.name)
      from public.member_credentials c where c.user_id = p_user), '[]'::jsonb));
  end if;
  if 'skills' = any (wanted) then
    snap := snap || jsonb_build_object('skills', coalesce((
      select jsonb_agg(s.skill order by lower(s.skill)) from public.member_skills s where s.user_id = p_user), '[]'::jsonb));
  end if;
  if 'preferences' = any (wanted) then
    snap := snap || jsonb_build_object('preferences', jsonb_build_object(
      'desired_titles', coalesce(to_jsonb(prefs.desired_titles), '[]'::jsonb),
      'employment_types', coalesce(to_jsonb(prefs.employment_types), '[]'::jsonb),
      'workplace_types', coalesce(to_jsonb(prefs.workplace_types), '[]'::jsonb)));
  end if;
  if 'availability' = any (wanted) then
    snap := snap || jsonb_build_object('availability', jsonb_build_object(
      'available_days', coalesce(to_jsonb(prefs.available_days), '[]'::jsonb),
      'shift_preferences', coalesce(to_jsonb(prefs.shift_preferences), '[]'::jsonb),
      'earliest_start_date', prefs.earliest_start_date));
  end if;
  if 'transportation' = any (wanted) then
    snap := snap || jsonb_build_object('transportation', jsonb_build_object(
      'transportation_modes', coalesce(to_jsonb(prefs.transportation_modes), '[]'::jsonb),
      'has_drivers_license', prefs.has_drivers_license));
  end if;
  return snap;
end;
$$;
