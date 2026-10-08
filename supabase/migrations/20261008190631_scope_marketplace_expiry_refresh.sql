-- Keep the global maintenance sweep service-only and give members an immediate, owner-scoped refresh.
create or replace function public.expire_my_marketplace_pickups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
  rec record;
begin
  if v_user is null then
    raise exception 'SIGNED_OUT';
  end if;

  for rec in
    select c.id, c.item_id, c.claimant_id
    from public.marketplace_claims c
    join public.marketplace_items i on i.id = c.item_id
    where c.status in ('approved', 'ready')
      and c.pickup_deadline is not null
      and c.pickup_deadline < now()
      and (c.claimant_id = v_user or i.seller_id = v_user)
    for update of c skip locked
  loop
    update public.marketplace_claims
    set status = 'no_show', no_show_at = now(), updated_at = now()
    where id = rec.id;

    update public.marketplace_items
    set status = 'available', updated_at = now()
    where id = rec.item_id and status = 'pending_pickup';

    insert into public.user_notifications(user_id, category, title, body, route, metadata)
    values (
      rec.claimant_id,
      'marketplace_claim',
      'Marketplace pickup window ended',
      'Your 48-hour pickup window ended without pickup verification. This claim remains counted toward your monthly limit.',
      '/marketplace-claim/' || rec.id,
      jsonb_build_object('claim_id', rec.id, 'item_id', rec.item_id)
    );

    insert into public.marketplace_claim_events(claim_id, actor_user_id, event_type, metadata)
    values (rec.id, null, 'no_show', jsonb_build_object('automatic', true));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_marketplace_pickups() from public, anon, authenticated, service_role;
grant execute on function public.expire_marketplace_pickups() to service_role;

revoke all on function public.expire_my_marketplace_pickups() from public, anon, authenticated, service_role;
grant execute on function public.expire_my_marketplace_pickups() to authenticated, service_role;
