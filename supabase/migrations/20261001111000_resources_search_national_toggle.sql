-- Resources search fix (forward-only). Migration 2b.
--
-- Bug found in DEV QA: a national service-area row matched even when the member turned OFF "include national",
-- so national resources leaked into local-only searches. The toggle now governs national service areas as well as
-- the is_national flag and virtual/phone delivery. ZIP, state and radius service areas remain explicit coverage.
--
-- Ranking improvement found in interactive QA: "somewhere to stay" ranked a meals program above the shelter because
-- both share the emergency category. A match on the resource's PRIMARY category now counts extra, and each matched
-- category adds weight, so the best-fitting resource leads.

create or replace function public.search_resources(
  p_query text default null,
  p_zip text default null,
  p_radius_miles integer default 25,
  p_category text default null,
  p_free_only boolean default false,
  p_urgent boolean default false,
  p_delivery text[] default null,
  p_include_national boolean default true,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  resource_row jsonb,
  distance_miles double precision,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
  z text := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  radius integer := least(greatest(coalesce(p_radius_miles, 25), 1), 500);
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  off integer := greatest(coalesce(p_offset, 0), 0);
  clat double precision;
  clng double precision;
  zstate text;
  need_cats text[] := '{}';
  tsq tsquery;
begin
  if length(z) = 5 then
    select c.latitude, c.longitude into clat, clng from public.resolve_postal_center(z) c;
    select pc.state_code into zstate from public.postal_codes pc where pc.postal_code = z;
  else
    z := null;
  end if;

  if q is not null then
    select coalesce(array_agg(distinct cat), '{}') into need_cats
    from public.resolve_resource_needs(q) n, unnest(n.category_slugs) cat;
    tsq := websearch_to_tsquery('english', q);
  end if;

  return query
  with visible as (
    select r.*, o.name as org_name, o.slug as org_slug, o.org_type as org_type,
           public.resource_freshness(r.last_verified_at, r.verify_by) as fresh_state
    from public.resources r
    join public.resource_organizations o on o.id = r.organization_id and o.status = 'active'
    where r.publish_status = 'published'
      and r.verification_state = 'verified'
      and public.resource_freshness(r.last_verified_at, r.verify_by) in ('fresh', 'stale')
      and (not coalesce(p_urgent, false)
           or (r.urgency_tier > 0 and public.resource_freshness(r.last_verified_at, r.verify_by) = 'fresh'))
      and (not coalesce(p_free_only, false) or r.cost_type = 'free')
      and (p_delivery is null or cardinality(p_delivery) = 0 or r.delivery_mode = any (p_delivery))
      and (p_category is null or exists (
             select 1 from public.resource_category_links l where l.resource_id = r.id and l.category_slug = p_category))
  ),
  matched as (
    select v.*,
      (q is not null and cardinality(need_cats) > 0 and exists (
         select 1 from public.resource_category_links l where l.resource_id = v.id and l.category_slug = any (need_cats))) as need_hit,
      (select count(*) from public.resource_category_links l where l.resource_id = v.id and l.category_slug = any (need_cats)) as need_hits,
      exists (select 1 from public.resource_category_links l where l.resource_id = v.id and l.is_primary and l.category_slug = any (need_cats)) as need_primary,
      case when q is not null then ts_rank(v.search_tsv, tsq) else 0 end as text_rank,
      (q is not null and v.search_tsv @@ tsq) as text_hit
    from visible v
  ),
  located as (
    select m.*,
      loc.location_id, loc.city as loc_city, loc.state_code as loc_state, loc.postal_code as loc_zip, loc.phone as loc_phone,
      loc.address_line as loc_address, loc.dist,
      (
        z is not null and (
          (loc.dist is not null and loc.dist <= radius)
          or exists (
            select 1 from public.resource_service_areas a
            where a.resource_id = m.id and (
              (a.area_type = 'national' and coalesce(p_include_national, true))
              or (a.area_type = 'zip' and a.postal_code = z)
              or (a.area_type = 'state' and zstate is not null and a.state_code = zstate)
              or (a.area_type = 'radius' and clat is not null and
                  3958.8 * 2 * asin(sqrt(least(1,
                    power(sin(radians(a.center_latitude - clat) / 2), 2)
                    + cos(radians(clat)) * cos(radians(a.center_latitude)) * power(sin(radians(a.center_longitude - clng) / 2), 2)
                  ))) <= a.radius_miles)
            ))
          or (coalesce(p_include_national, true) and (m.is_national or m.delivery_mode in ('virtual', 'phone')))
        )
      ) as geo_ok
    from matched m
    left join lateral (
      select l.id as location_id, l.city, l.state_code, l.postal_code, l.phone, l.address_line,
        case when clat is not null and l.latitude is not null and l.longitude is not null then
          3958.8 * 2 * asin(sqrt(least(1,
            power(sin(radians(l.latitude - clat) / 2), 2)
            + cos(radians(clat)) * cos(radians(l.latitude)) * power(sin(radians(l.longitude - clng) / 2), 2)
          )))
        end as dist
      from public.resource_locations l
      where l.resource_id = m.id and not l.is_virtual
      order by dist asc nulls last, l.id
      limit 1
    ) loc on true
    where q is null
       or m.text_hit
       or m.need_hit
       or position(lower(q) in lower(m.title)) > 0
  ),
  filtered as (
    select l.* from located l where z is null or l.geo_ok
  ),
  scored as (
    select f.*,
      (case when f.need_hit then 20 else 0 end)
      + f.need_hits * 8
      + (case when f.need_primary then 15 else 0 end)
      + f.text_rank * 20
      + f.urgency_tier * (case when coalesce(p_urgent, false) then 15 else 3 end)
      + (case f.fresh_state when 'fresh' then 6 else -8 end)
      + (case when f.dist is not null then greatest(0, 20 - f.dist) + 8 else 0 end) as score,
      count(*) over () as all_count
    from filtered f
  )
  select
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'summary', s.summary,
      'organization', jsonb_build_object('id', s.organization_id, 'name', s.org_name, 'slug', s.org_slug, 'org_type', s.org_type),
      'resource_kind', s.resource_kind,
      'delivery_mode', s.delivery_mode,
      'is_national', s.is_national,
      'cost_type', s.cost_type,
      'cost_notes', s.cost_notes,
      'urgency_tier', s.urgency_tier,
      'eligibility_summary', s.eligibility_summary,
      'official_source_url', s.official_source_url,
      'source_authority', s.source_authority,
      'last_verified_at', s.last_verified_at,
      'verify_by', s.verify_by,
      'freshness', s.fresh_state,
      'accessibility', s.accessibility,
      'languages', s.languages,
      'categories', (select coalesce(jsonb_agg(l.category_slug order by l.is_primary desc, l.category_slug), '[]'::jsonb)
                     from public.resource_category_links l where l.resource_id = s.id),
      'nearest_location', case when s.location_id is null then null else jsonb_build_object(
          'id', s.location_id, 'city', s.loc_city, 'state_code', s.loc_state, 'postal_code', s.loc_zip,
          'address_line', s.loc_address, 'phone', s.loc_phone,
          'open_now', public.resource_location_open_now(s.location_id)) end,
      'data_origin', s.data_origin
    ),
    s.dist,
    s.all_count
  from scored s
  order by s.score desc, s.dist asc nulls last, s.title, s.id
  limit lim offset off;
end;
$$;
revoke all on function public.search_resources(text, text, integer, text, boolean, boolean, text[], boolean, integer, integer) from public;
grant execute on function public.search_resources(text, text, integer, text, boolean, boolean, text[], boolean, integer, integer)
  to anon, authenticated, service_role;
