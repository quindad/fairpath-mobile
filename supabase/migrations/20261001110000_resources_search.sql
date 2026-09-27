-- Resources search (forward-only). Migration 2 of the Profile + Resources pass.
--
--   * resolve_resource_needs(): plain-language text -> needs/categories (data-driven, transparent to the UI)
--   * search_resources():       server-side, paginated, guest-safe search
--   * get_resource_detail():    one visible resource with everything a member needs to act on it
--
-- Visibility (the ONLY way guests and members read resources): publish_status = 'published',
-- verification_state = 'verified', organization active, and freshness fresh or stale. Expired records are hidden;
-- stale records are shown with a warning, ranked lower, and excluded from urgent mode.
--
-- These functions are SECURITY DEFINER because base tables are closed to anon/authenticated. They take no member
-- identity and return no member state, so they are safe for signed-out visitors. Search text is not stored.

-- ---------------------------------------------------------------------
-- Need resolution
-- ---------------------------------------------------------------------
create or replace function public.resolve_resource_needs(p_query text)
returns table (need_slug text, label text, urgent boolean, category_slugs text[])
language sql
stable
security invoker
set search_path = public
as $$
  select n.need_slug, n.label, n.urgent, n.category_slugs
  from public.resource_needs n
  where nullif(btrim(coalesce(p_query, '')), '') is not null
    and (
      lower(p_query) like '%' || lower(n.label) || '%'
      or exists (
        select 1 from unnest(n.synonyms) s
        where lower(p_query) ~ ('\m' || regexp_replace(lower(s), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
      )
    )
  order by n.sort_order;
$$;
revoke all on function public.resolve_resource_needs(text) from public;
grant execute on function public.resolve_resource_needs(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Open-now helper (per location, in the location's own time zone). NULL when no hours are recorded.
-- ---------------------------------------------------------------------
create or replace function public.resource_location_open_now(p_location uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text;
  local_now timestamp;
  wd smallint;
  t time;
  has_hours boolean;
begin
  select l.timezone into tz from public.resource_locations l where l.id = p_location;
  if tz is null then return null; end if;
  select exists (select 1 from public.resource_hours h where h.location_id = p_location) into has_hours;
  if not has_hours then return null; end if;

  local_now := now() at time zone tz;
  wd := extract(dow from local_now)::smallint;
  t := local_now::time;

  return exists (
    select 1 from public.resource_hours h
    where h.location_id = p_location and h.weekday = wd
      and (h.is_24h or (h.opens_at <= t and t < h.closes_at))
  );
end;
$$;
revoke all on function public.resource_location_open_now(uuid) from public;
grant execute on function public.resource_location_open_now(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------
-- Location rules (when p_zip resolves):
--   include a resource if ANY of: a location within p_radius_miles; a service area covering the ZIP (zip / state /
--   radius / national); or (p_include_national) it is national or delivered virtually/by phone.
-- Without a ZIP every visible resource is eligible and ranking ignores proximity.
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
              a.area_type = 'national'
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
      (case when f.need_hit then 30 else 0 end)
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

-- ---------------------------------------------------------------------
-- Detail
-- ---------------------------------------------------------------------
create or replace function public.get_resource_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'summary', r.summary,
    'description', r.description,
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'org_type', o.org_type,
                                        'website_url', o.website_url, 'description', o.description),
    'resource_kind', r.resource_kind,
    'delivery_mode', r.delivery_mode,
    'is_national', r.is_national,
    'cost_type', r.cost_type,
    'cost_notes', r.cost_notes,
    'urgency_tier', r.urgency_tier,
    'eligibility_summary', r.eligibility_summary,
    'how_to_access', r.how_to_access,
    'application_url', r.application_url,
    'official_source_url', r.official_source_url,
    'source_authority', r.source_authority,
    'last_verified_at', r.last_verified_at,
    'verify_by', r.verify_by,
    'freshness', public.resource_freshness(r.last_verified_at, r.verify_by),
    'languages', r.languages,
    'accessibility', r.accessibility,
    'hours_note', r.hours_note,
    'data_origin', r.data_origin,
    'categories', (select coalesce(jsonb_agg(l.category_slug order by l.is_primary desc, l.category_slug), '[]'::jsonb)
                   from public.resource_category_links l where l.resource_id = r.id),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', loc.id, 'label', loc.label, 'address_line', loc.address_line, 'city', loc.city, 'state_code', loc.state_code,
        'postal_code', loc.postal_code, 'latitude', loc.latitude, 'longitude', loc.longitude, 'phone', loc.phone,
        'timezone', loc.timezone, 'is_virtual', loc.is_virtual, 'accessibility', loc.accessibility,
        'open_now', public.resource_location_open_now(loc.id),
        'hours', (select coalesce(jsonb_agg(jsonb_build_object(
            'weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at, 'is_24h', h.is_24h, 'note', h.note)
            order by h.weekday, h.opens_at), '[]'::jsonb) from public.resource_hours h where h.location_id = loc.id)
      ) order by loc.label), '[]'::jsonb) from public.resource_locations loc where loc.resource_id = r.id),
    'service_areas', (select coalesce(jsonb_agg(jsonb_build_object(
        'area_type', a.area_type, 'state_code', a.state_code, 'county_fips', a.county_fips,
        'postal_code', a.postal_code, 'radius_miles', a.radius_miles)), '[]'::jsonb)
        from public.resource_service_areas a where a.resource_id = r.id),
    'eligibility', (select coalesce(jsonb_agg(jsonb_build_object(
        'rule_type', e.rule_type, 'description', e.description, 'is_hard', e.is_hard)), '[]'::jsonb)
        from public.resource_eligibility e where e.resource_id = r.id),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object(
        'method', c.method, 'value', c.value, 'label', c.label, 'is_primary', c.is_primary)
        order by c.is_primary desc, c.method), '[]'::jsonb)
        from public.resource_contacts c where c.resource_id = r.id),
    'required_documents', (select coalesce(jsonb_agg(jsonb_build_object(
        'document_type', d.document_type, 'description', d.description, 'is_required', d.is_required)
        order by d.is_required desc, d.document_type), '[]'::jsonb)
        from public.resource_required_documents d where d.resource_id = r.id)
  )
  into result
  from public.resources r
  join public.resource_organizations o on o.id = r.organization_id and o.status = 'active'
  where r.id = p_id
    and r.publish_status = 'published'
    and r.verification_state = 'verified'
    and public.resource_freshness(r.last_verified_at, r.verify_by) in ('fresh', 'stale');

  return result;
end;
$$;
revoke all on function public.get_resource_detail(uuid) from public;
grant execute on function public.get_resource_detail(uuid) to anon, authenticated, service_role;
