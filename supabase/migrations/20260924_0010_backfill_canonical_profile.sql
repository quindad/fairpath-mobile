-- Step 1 Canonical Profile: backfill.
--
-- NON-DESTRUCTIVE. Reads from profile_answers, profiles.justice_impacted,
-- and user_convictions; writes into the new canonical tables. Does NOT
-- delete, truncate, or modify any row in profile_answers or
-- user_convictions. profiles.justice_impacted is read, never written.
--
-- IDEMPOTENT. Every insert is guarded with `where not exists`, and every
-- profiles column update only fills currently-null values, so this file
-- is safe to run more than once.
--
-- Sterling decision #2: this migration does NOT create a placeholder
-- convictions row for users with profiles.justice_impacted = 'Yes' but
-- no structured profile_answers['convictions.*'] data. That legacy
-- signal is preserved as-is on profiles.justice_impacted (read-only,
-- never converted here) and surfaced as a profile-completion prompt by
-- application code (src/core/profile/profile-service.ts,
-- hasUnconvertedLegacyJusticeSignal) rather than a fabricated row.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

-- ---------------------------------------------------------------------
-- 1. profiles.phone / profiles.date_of_birth <- profile_answers
-- ---------------------------------------------------------------------

update public.profiles p
set phone = pa.answer #>> '{}'
from public.profile_answers pa
where pa.user_id = p.id
  and pa.question_id = 'identity.phone'
  and p.phone is null
  and coalesce(pa.answer #>> '{}', '') <> '';

update public.profiles p
set date_of_birth = to_date(pa.answer #>> '{}', 'MM/DD/YYYY')
from public.profile_answers pa
where pa.user_id = p.id
  and pa.question_id = 'identity.date_of_birth'
  and p.date_of_birth is null
  and (pa.answer #>> '{}') ~ '^\d{2}/\d{2}/\d{4}$';

-- ---------------------------------------------------------------------
-- 2. addresses <- profile_answers['identity.address' / 'identity.current_location']
--    Free-text source only: line1/city/state/postal_code stay null,
--    the raw text goes into `formatted`, marked needs_review
--    (Sterling decision #4 — progressive confirmation, never blocking).
-- ---------------------------------------------------------------------

with raw_address as (
  select
    user_id,
    max(case when question_id = 'identity.address' then nullif(answer #>> '{}', '') end) as address_text,
    max(case when question_id = 'identity.current_location' then nullif(answer #>> '{}', '') end) as location_text
  from public.profile_answers
  where question_id in ('identity.address', 'identity.current_location')
  group by user_id
)
insert into public.addresses (user_id, label, formatted, is_current, source, verification_state)
select r.user_id, 'home', coalesce(r.address_text, r.location_text), true, 'user', 'needs_review'
from raw_address r
where coalesce(r.address_text, r.location_text) is not null
  and not exists (
    select 1 from public.addresses a
    where a.user_id = r.user_id and a.label = 'home' and a.is_current = true
  );

-- ---------------------------------------------------------------------
-- 3. convictions <- profile_answers['convictions.*']
--    Only where convictions.has_felony = true. One row per user
--    (origin = 'questionnaire'), taxonomy_category_id left null
--    (needs the categorization pass). Does NOT consult
--    profiles.justice_impacted (decision #2).
-- ---------------------------------------------------------------------

with felony_users as (
  select user_id
  from public.profile_answers
  where question_id = 'convictions.has_felony'
    and answer = 'true'::jsonb
),
fields as (
  select
    f.user_id,
    max(case when pa.question_id = 'convictions.offense_name' then pa.answer #>> '{}' end) as offense_title,
    max(case when pa.question_id = 'convictions.offense_code' then pa.answer #>> '{}' end) as offense_code,
    max(case when pa.question_id = 'convictions.jurisdiction_state' then pa.answer #>> '{}' end) as state_code,
    max(case when pa.question_id = 'convictions.conviction_date' then pa.answer #>> '{}' end) as conviction_date_text
  from felony_users f
  left join public.profile_answers pa on pa.user_id = f.user_id
  group by f.user_id
)
insert into public.convictions (
  user_id, origin, offense_title, offense_code, state_code, conviction_date,
  source_type, verification_state
)
select
  fl.user_id,
  'questionnaire',
  nullif(fl.offense_title, ''),
  nullif(fl.offense_code, ''),
  nullif(fl.state_code, ''),
  case when fl.conviction_date_text ~ '^\d{2}/\d{2}/\d{4}$'
       then to_date(fl.conviction_date_text, 'MM/DD/YYYY') else null end,
  'self_reported',
  'needs_review'
from fields fl
where not exists (
  select 1 from public.convictions c
  where c.user_id = fl.user_id and c.origin = 'questionnaire'
);

-- ---------------------------------------------------------------------
-- 4. convictions <- user_convictions (pre-existing structured table,
--    already unused by any live code path). Straight copy, origin =
--    'manual'. share_with_employers is intentionally NOT selected
--    (Sterling decision #3: retired).
-- ---------------------------------------------------------------------

insert into public.convictions (
  user_id, offense_catalog_id, origin, jurisdiction_type, state_code, county,
  court_name, case_number, offense_code, offense_title, offense_level,
  offense_degree, offense_class, disposition, conviction_date, sentence_date,
  release_date, sentence_summary, supervision_status, source_type,
  verification_state, source_reference, user_notes, legacy_user_conviction_id,
  created_at, updated_at
)
select
  uc.user_id, uc.offense_catalog_id, 'manual', uc.jurisdiction_type, uc.state_code, uc.county,
  uc.court_name, uc.case_number, uc.offense_code, uc.offense_title, uc.offense_level,
  uc.offense_degree, uc.offense_class, uc.disposition, uc.conviction_date, uc.sentence_date,
  uc.release_date, uc.sentence_summary, uc.supervision_status, uc.source_type,
  case when uc.verification_state = 'official_record_verified' then 'official_record_verified'
       when uc.verification_state = 'document_verified' then 'document_verified'
       when uc.verification_state = 'user_confirmed' then 'user_confirmed'
       else 'needs_review' end,
  uc.source_reference, uc.user_notes, uc.id, uc.created_at, uc.updated_at
from public.user_convictions uc
where not exists (
  select 1 from public.convictions c where c.legacy_user_conviction_id = uc.id
);

-- ---------------------------------------------------------------------
-- 5. supervision_records <- profile_answers['restrictions.supervision_status']
--    Raw text preserved in source_notes; status left 'unknown' unless a
--    confident keyword match is found. origin = 'questionnaire'.
-- ---------------------------------------------------------------------

insert into public.supervision_records (
  user_id, origin, supervision_type, status, source_notes, source_type, verification_state
)
select
  pa.user_id,
  'questionnaire',
  case
    when lower(pa.answer #>> '{}') like '%parole%' then 'parole'
    when lower(pa.answer #>> '{}') like '%probation%' then 'probation'
    when lower(pa.answer #>> '{}') like '%post-release%' or lower(pa.answer #>> '{}') like '%post release%' then 'post_release_control'
    else 'other'
  end,
  case
    when lower(pa.answer #>> '{}') like '%complete%' then 'completed'
    when lower(pa.answer #>> '{}') like '%active%' or lower(pa.answer #>> '{}') like '%current%' then 'active'
    else 'unknown'
  end,
  pa.answer #>> '{}',
  'self_reported',
  'needs_review'
from public.profile_answers pa
where pa.question_id = 'restrictions.supervision_status'
  and coalesce(pa.answer #>> '{}', '') <> ''
  and not exists (
    select 1 from public.supervision_records sr
    where sr.user_id = pa.user_id and sr.origin = 'questionnaire'
  );

-- ---------------------------------------------------------------------
-- 6. registration_records <- profile_answers['restrictions.sex_offender_registration']
--    Only where the answer is explicitly true. origin = 'questionnaire'.
-- ---------------------------------------------------------------------

insert into public.registration_records (
  user_id, origin, registration_type, source_type, verification_state
)
select
  pa.user_id, 'questionnaire', 'sex_offender', 'self_reported', 'needs_review'
from public.profile_answers pa
where pa.question_id = 'restrictions.sex_offender_registration'
  and pa.answer = 'true'::jsonb
  and not exists (
    select 1 from public.registration_records rr
    where rr.user_id = pa.user_id and rr.origin = 'questionnaire'
  );

-- ---------------------------------------------------------------------
-- Verification summary (informational only, does not fail the migration)
-- ---------------------------------------------------------------------

do $$
declare
  v_legacy_unconverted integer;
  v_convictions_from_questionnaire integer;
  v_convictions_from_user_convictions integer;
begin
  select count(*) into v_legacy_unconverted
  from public.profiles p
  where p.justice_impacted = 'Yes'
    and not exists (select 1 from public.convictions c where c.user_id = p.id);

  select count(*) into v_convictions_from_questionnaire
  from public.convictions where origin = 'questionnaire';

  select count(*) into v_convictions_from_user_convictions
  from public.convictions where origin = 'manual';

  raise notice 'Canonical profile backfill summary: % users have justice_impacted=Yes with no convictions row (expected — preserved per decision #2, surfaced as a profile-completion prompt, not auto-converted); % convictions rows backfilled from the questionnaire; % convictions rows copied from user_convictions.',
    v_legacy_unconverted, v_convictions_from_questionnaire, v_convictions_from_user_convictions;
end $$;
