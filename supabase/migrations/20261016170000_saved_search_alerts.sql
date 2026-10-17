-- Closes the real remaining gap found while proving tonight's notification-delivery fix: saved_job_searches
-- and saved_housing_searches already let a member save a search, and their own screen copy honestly said
-- "Alert delivery is not turned on until FairPath notification delivery is connected" -- but even now that
-- delivery IS connected (this session), nothing actually watched for a NEW matching listing and created the
-- alert in the first place. This migration adds that matching step, reusing the exact same create_notification
-- function all 6 existing notification sources already use (so the already-proven user_notifications ->
-- queue_notification_delivery -> notification-delivery-worker pipeline picks these up automatically, no
-- further wiring needed).
--
-- Matching is deliberately simple and honest, not the full filter object: a saved search's free-text query
-- must substring-match the new listing's title/description (jobs) or title/description/property_type
-- (housing), and its free-text location must substring-match the listing's location fields, when either is
-- set. The detailed boolean filters (secondChance, veteranFriendly, etc.) are NOT checked for alerts yet --
-- that is a real, stated limitation, not a silent gap, and the saved-search screens' copy is updated to say so.

create or replace function public.notify_saved_job_search_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if new.status <> 'published' then return new; end if;
  for r in
    select s.id, s.user_id, s.name, s.query, s.location
    from public.saved_job_searches s
    where (btrim(s.query) = '' or position(lower(btrim(s.query)) in lower(new.title || ' ' || new.company_name || ' ' || coalesce(new.description, ''))) > 0)
      and (btrim(s.location) = '' or position(lower(btrim(s.location)) in lower(coalesce(new.location_text, '') || ' ' || coalesce(new.city, '') || ' ' || coalesce(new.state, ''))) > 0)
  loop
    perform public.create_notification(
      r.user_id, 'job_alert', 'New job: ' || new.title,
      new.company_name || coalesce(' · ' || new.city, ''),
      '/job/' || new.id::text,
      'job_alert:' || r.id::text || ':' || new.id::text,
      'job', new.id,
      jsonb_build_object('saved_search_id', r.id, 'job_id', new.id)
    );
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_saved_job_search_matches() from public, anon, authenticated;
grant execute on function public.notify_saved_job_search_matches() to service_role;

drop trigger if exists jobs_notify_saved_search_matches on public.jobs;
create trigger jobs_notify_saved_search_matches
  after insert or update of status on public.jobs
  for each row execute function public.notify_saved_job_search_matches();

create or replace function public.notify_saved_housing_search_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if new.status <> 'published' then return new; end if;
  for r in
    select s.id, s.user_id, s.name, s.query, s.location
    from public.saved_housing_searches s
    where (btrim(s.query) = '' or position(lower(btrim(s.query)) in lower(new.title || ' ' || coalesce(new.description, '') || ' ' || new.property_type)) > 0)
      and (btrim(s.location) = '' or position(lower(btrim(s.location)) in lower(new.city || ', ' || new.state || ' ' || coalesce(new.postal_code, ''))) > 0)
  loop
    perform public.create_notification(
      r.user_id, 'housing_alert', 'New home: ' || new.title,
      new.city || ', ' || new.state || coalesce(' · $' || new.rent_monthly::text || '/mo', ''),
      '/housing/' || new.id::text,
      'housing_alert:' || r.id::text || ':' || new.id::text,
      'housing', new.id,
      jsonb_build_object('saved_search_id', r.id, 'listing_id', new.id)
    );
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_saved_housing_search_matches() from public, anon, authenticated;
grant execute on function public.notify_saved_housing_search_matches() to service_role;

drop trigger if exists housing_listings_notify_saved_search_matches on public.housing_listings;
create trigger housing_listings_notify_saved_search_matches
  after insert or update of status on public.housing_listings
  for each row execute function public.notify_saved_housing_search_matches();
