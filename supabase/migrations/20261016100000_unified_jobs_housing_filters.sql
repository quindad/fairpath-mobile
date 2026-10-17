-- Product direction change (2026-10-16, Sterling): stop presenting Jobs/Housing as split "felon app" /
-- "veteran app" experiences. One shared Jobs board and one shared Housing board for everyone, with
-- felony-friendly and veteran-friendly as FILTERS sitting side by side on the same screen -- the same
-- pattern search_jobs already uses for p_second_chance via eligibility_rules->>'second_chance_evidence'.
-- This migration adds the matching veteran_friendly_evidence filter to both search_jobs and search_housing,
-- additive and backward compatible (new param has a DEFAULT, existing callers are unaffected).

-- Must DROP first, not just CREATE OR REPLACE: adding a trailing parameter (even with a default) changes the
-- argument-type signature, which Postgres treats as a distinct overload rather than a replacement. Without the
-- drop, both the old 9-arg and new 10-arg search_jobs would coexist, and any call passing only the original 9
-- named arguments would be ambiguous between them (PostgREST error 42725, "function is not unique").
drop function if exists public.search_jobs(text, text, integer, text, boolean, text, boolean, integer, integer);

create or replace function public.search_jobs(
  p_query text default null,
  p_zip text default null,
  p_radius_miles integer default 25,
  p_location text default null,
  p_remote boolean default false,
  p_employment_type text default null,
  p_second_chance boolean default false,
  p_limit integer default 20,
  p_offset integer default 0,
  p_veteran_friendly boolean default false
)
returns table(job jsonb, distance_miles double precision, total_count bigint, second_chance_count bigint, veteran_friendly_count bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  loc text := nullif(lower(btrim(coalesce(p_location, ''))), '');
  z text := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  radius integer := least(greatest(coalesce(p_radius_miles, 25), 1), 500);
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  off integer := greatest(coalesce(p_offset, 0), 0);
  clat double precision;
  clng double precision;
begin
  if length(z) = 5 then
    select c.latitude, c.longitude into clat, clng from public.resolve_postal_center(z) c;
  else
    z := null;
  end if;

  return query
  with base as (
    select
      j.*,
      case
        when clat is not null and j.latitude is not null and j.longitude is not null then
          3958.8 * 2 * asin(sqrt(least(1,
            power(sin(radians(j.latitude - clat) / 2), 2)
            + cos(radians(clat)) * cos(radians(j.latitude)) * power(sin(radians(j.longitude - clng) / 2), 2)
          )))
        else null
      end as dist
    from public.jobs j
    where j.status = 'published'
      and (j.expires_at is null or j.expires_at > now())
      and (q is null
           or position(q in lower(j.title)) > 0
           or position(q in lower(j.company_name)) > 0
           or position(q in lower(j.description)) > 0)
      and (not coalesce(p_remote, false) or j.workplace_type = 'remote')
      and (p_employment_type is null or j.employment_type = p_employment_type)
      and (z is not null or loc is null
           or position(loc in lower(coalesce(j.location_text, ''))) > 0
           or position(loc in lower(coalesce(j.city, ''))) > 0
           or position(loc in lower(coalesce(j.state, ''))) > 0)
  ),
  located as (
    select b.*,
           count(*) over () as all_count,
           count(*) filter (where b.eligibility_rules ->> 'second_chance_evidence' = 'explicit') over () as sc_count,
           count(*) filter (where b.eligibility_rules ->> 'veteran_friendly_evidence' = 'explicit') over () as vf_count
    from base b
    where z is null
       or b.workplace_type = 'remote'
       or b.postal_code = z
       or (b.dist is not null and b.dist <= radius)
  )
  select
    jsonb_build_object(
      'id', l.id, 'title', l.title, 'company_name', l.company_name,
      'description', left(l.description, 400),
      'location_text', l.location_text, 'city', l.city, 'state', l.state, 'postal_code', l.postal_code,
      'workplace_type', l.workplace_type, 'employment_type', l.employment_type,
      'pay_min', l.pay_min, 'pay_max', l.pay_max, 'pay_period', l.pay_period,
      'benefits', coalesce(l.benefits, '{}'), 'skills', coalesce(l.skills, '{}'), 'requirements', coalesce(l.requirements, '{}'),
      'background_policy_summary', l.background_policy_summary,
      'eligibility_rules', l.eligibility_rules,
      'application_method', l.application_method, 'external_apply_url', l.external_apply_url,
      'company_website_url', l.company_website_url,
      'source_label', l.source_label, 'source_url', l.source_url,
      'featured', l.featured, 'created_at', l.created_at, 'status', l.status,
      'published_at', l.published_at, 'expires_at', l.expires_at, 'closed_at', l.closed_at,
      'latitude', l.latitude, 'longitude', l.longitude, 'location_precision', l.location_precision,
      'easy_apply_enabled', l.easy_apply_enabled, 'application_questions', l.application_questions
    ),
    l.dist,
    l.all_count,
    l.sc_count,
    l.vf_count
  from located l
  where (not coalesce(p_second_chance, false) or l.eligibility_rules ->> 'second_chance_evidence' = 'explicit')
    and (not coalesce(p_veteran_friendly, false) or l.eligibility_rules ->> 'veteran_friendly_evidence' = 'explicit')
  order by l.featured desc, l.dist asc nulls last, l.created_at desc, l.id
  limit lim offset off;
end;
$$;

revoke all on function public.search_jobs(text, text, integer, text, boolean, text, boolean, integer, integer, boolean) from public;
grant execute on function public.search_jobs(text, text, integer, text, boolean, text, boolean, integer, integer, boolean)
  to anon, authenticated, service_role;

-- Housing side: second_chance_policy already existed (added 2026-10-04) but was never surfaced in any screen or
-- filter -- this migration is what finally does that, plus adds the matching veteran_friendly_policy column
-- using the identical unknown/landlord_asserted/fairpath_verified provenance pattern (never inferred from a
-- listing merely existing).
alter table public.housing_listings
  add column if not exists veteran_friendly_policy text not null default 'unknown'
    check (veteran_friendly_policy in ('unknown', 'landlord_asserted', 'fairpath_verified'));

comment on column public.housing_listings.veteran_friendly_policy is
  'Same provenance pattern as second_chance_policy: unknown (default) makes no claim. landlord_asserted is self-reported by the landlord. fairpath_verified means FairPath confirmed it directly. Never inferred from the listing existing.';

-- search_housing() signature is unchanged (p_filters jsonb already covers new filter keys) -- only the body
-- changes, adding felonyFriendly/veteranFriendly to the existing boolean-filter block. Every other filter,
-- the expires_at check, and the sort/media logic are preserved exactly as the prior version (20261004100000).
create or replace function public.search_housing(
  p_query text default null,
  p_zip text default null,
  p_radius_miles integer default 25,
  p_location text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'featured',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  listing jsonb,
  distance_miles double precision,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  loc text := nullif(lower(btrim(coalesce(p_location, ''))), '');
  z text := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  radius integer := least(greatest(coalesce(p_radius_miles, 25), 1), 500);
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  off integer := greatest(coalesce(p_offset, 0), 0);
  f jsonb := case when jsonb_typeof(p_filters) = 'object' then p_filters else '{}'::jsonb end;
  num_re constant text := '^[0-9]+(\.[0-9]+)?$';
  min_rent numeric := case when f ->> 'minRent' ~ num_re then (f ->> 'minRent')::numeric end;
  max_rent numeric := case when f ->> 'maxRent' ~ num_re then (f ->> 'maxRent')::numeric end;
  min_sqft numeric := case when f ->> 'minSqft' ~ num_re then (f ->> 'minSqft')::numeric end;
  beds_text text := upper(coalesce(f ->> 'beds', 'ANY'));
  baths_text text := upper(coalesce(f ->> 'baths', 'ANY'));
  min_beds numeric := case when beds_text ~ '^[0-9]+(\.[0-9]+)?\+$' then replace(beds_text, '+', '')::numeric end;
  min_baths numeric := case when baths_text ~ '^[0-9]+(\.[0-9]+)?\+$' then replace(baths_text, '+', '')::numeric end;
  types text[] := case
    when jsonb_typeof(f -> 'types') = 'array' then array(select lower(jsonb_array_elements_text(f -> 'types')))
    else '{}'::text[]
  end;
  sort_key text := case when p_sort in ('featured', 'nearest', 'price_low', 'price_high', 'newest') then p_sort else 'featured' end;
  clat double precision;
  clng double precision;
begin
  if length(z) = 5 then
    select c.latitude, c.longitude into clat, clng from public.resolve_postal_center(z) c;
  else
    z := null;
  end if;

  return query
  with base as (
    select
      h.*,
      case
        when clat is not null and h.latitude is not null and h.longitude is not null then
          3958.8 * 2 * asin(sqrt(least(1,
            power(sin(radians(h.latitude - clat) / 2), 2)
            + cos(radians(clat)) * cos(radians(h.latitude)) * power(sin(radians(h.longitude - clng) / 2), 2)
          )))
        else null
      end as dist
    from public.housing_listings h
    where h.status = 'published'
      and (h.expires_at is null or h.expires_at > now())
      and (q is null
           or position(q in lower(h.title)) > 0
           or position(q in lower(h.description)) > 0
           or position(q in lower(h.property_type)) > 0)
      and (z is not null or loc is null
           or position(loc in lower(h.city || ', ' || h.state)) > 0
           or position(loc in lower(coalesce(h.postal_code, ''))) > 0)
      and (min_rent is null or h.rent_monthly >= min_rent)
      and (max_rent is null or h.rent_monthly <= max_rent)
      and (beds_text <> 'STUDIO' or coalesce(h.bedrooms, 0) = 0)
      and (min_beds is null or coalesce(h.bedrooms, 0) >= min_beds)
      and (min_baths is null or coalesce(h.bathrooms, 0) >= min_baths)
      and (cardinality(types) = 0 or lower(h.property_type) = any (types))
      and (not coalesce((f ->> 'fastTrack')::boolean, false) or h.fasttrack_enabled)
      and (not coalesce((f ->> 'pets')::boolean, false)
           or (btrim(coalesce(h.pet_policy, '')) <> '' and lower(h.pet_policy) !~ 'no pets|not allowed'))
      and (not coalesce((f ->> 'accessible')::boolean, false) or coalesce(cardinality(h.accessibility_features), 0) > 0)
      and (not coalesce((f ->> 'garage')::boolean, false) or coalesce(h.garage_spaces, 0) > 0)
      and (not coalesce((f ->> 'parking')::boolean, false)
           or coalesce(cardinality(h.parking_types), 0) > 0 or btrim(coalesce(h.parking, '')) <> '')
      and (not coalesce((f ->> 'furnished')::boolean, false) or h.furnished)
      and (not coalesce((f ->> 'basement')::boolean, false) or h.has_basement)
      and (not coalesce((f ->> 'yard')::boolean, false) or h.has_yard)
      and (not coalesce((f ->> 'balcony')::boolean, false) or h.has_balcony_patio)
      and (not coalesce((f ->> 'laundry')::boolean, false) or nullif(btrim(coalesce(h.laundry_type, '')), '') is not null)
      and (not coalesce((f ->> 'centralAir')::boolean, false) or h.has_central_air)
      and (not coalesce((f ->> 'moveInReady')::boolean, false) or h.move_in_ready)
      and (not coalesce((f ->> 'felonyFriendly')::boolean, false) or h.second_chance_policy <> 'unknown')
      and (not coalesce((f ->> 'veteranFriendly')::boolean, false) or h.veteran_friendly_policy <> 'unknown')
      and (min_sqft is null or coalesce(h.square_feet, 0) >= min_sqft)
  ),
  located as (
    select b.*, count(*) over () as all_count
    from base b
    where z is null
       or b.postal_code = z
       or (b.dist is not null and b.dist <= radius)
  )
  select
    jsonb_build_object(
      'id', l.id, 'title', l.title, 'property_type', l.property_type,
      'city', l.city, 'state', l.state, 'postal_code', l.postal_code,
      'bedrooms', l.bedrooms, 'bathrooms', l.bathrooms, 'square_feet', l.square_feet,
      'rent_monthly', l.rent_monthly, 'fasttrack_enabled', l.fasttrack_enabled,
      'second_chance_policy', l.second_chance_policy, 'veteran_friendly_policy', l.veteran_friendly_policy,
      'featured', l.featured, 'source_label', l.source_label, 'created_at', l.created_at,
      'latitude', l.latitude, 'longitude', l.longitude,
      'housing_media', coalesce((
        select jsonb_agg(jsonb_build_object('url', m.url, 'media_type', m.media_type, 'sort_order', m.sort_order))
        from (
          select url, media_type, sort_order
          from public.housing_media
          where listing_id = l.id and media_type = 'photo'
          order by sort_order
          limit 1
        ) m
      ), '[]'::jsonb)
    ),
    l.dist,
    l.all_count
  from located l
  order by
    (case when sort_key = 'price_low' then l.rent_monthly end) asc nulls last,
    (case when sort_key = 'price_high' then l.rent_monthly end) desc nulls last,
    (case when sort_key = 'newest' then l.created_at end) desc nulls last,
    (case when sort_key = 'nearest' then l.dist end) asc nulls last,
    l.featured desc,
    l.dist asc nulls last,
    l.created_at desc,
    l.id
  limit lim offset off;
end;
$$;
