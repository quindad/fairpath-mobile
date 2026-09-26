-- Housing production pass (forward-only): server-side, paginated, radius-aware search.
--
-- Replaces the client-side "load 100 rows, then filter on the phone" approach.
-- Reuses public.resolve_postal_center() from the Jobs pass for ZIP -> coordinates.
--
-- Runs as the caller (SECURITY INVOKER), so the existing RLS on
-- public.housing_listings ("Published housing is readable") still applies.
--
-- Only filters backed by real columns are supported. Walk/transit/bike scores
-- are intentionally NOT filterable: no provider populates them yet.
--
-- p_filters keys (all optional): minRent, maxRent, beds ('ANY'|'STUDIO'|'N+'),
-- baths ('ANY'|'N+'), types (array), fastTrack, pets, accessible, garage, parking,
-- furnished, basement, yard, balcony, laundry, centralAir, moveInReady, minSqft.

create index if not exists housing_listings_published_idx
  on public.housing_listings (featured desc, created_at desc, id)
  where status = 'published';

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

revoke all on function public.search_housing(text, text, integer, text, jsonb, text, integer, integer) from public;
grant execute on function public.search_housing(text, text, integer, text, jsonb, text, integer, integer)
  to anon, authenticated, service_role;
