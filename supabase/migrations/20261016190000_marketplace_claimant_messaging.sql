-- Real gap found during tonight's Marketplace audit: send_marketplace_pickup_message only ever allowed the
-- SELLER to send a message (`and i.seller_id=v_user`), never the claimant. Pickup details (address/phone) are
-- only revealed after approval and the pickup window is a hard 48 hours -- an approved claimant running late,
-- lost, or with a logistics question had no way to reach the donor inside the app at all. This migration lets
-- either the item's seller OR the claim's own claimant send a message on an approved/ready claim. No other
-- change: same validation, same security-definer pattern, same table.
create or replace function public.send_marketplace_pickup_message(p_claim_id uuid, p_body text)
returns table(id uuid, claim_id uuid, sender_id uuid, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
 v_user uuid:=auth.uid();
 v_created public.marketplace_messages%rowtype;
begin
 if v_user is null then raise exception 'SIGNED_OUT'; end if;
 if length(trim(coalesce(p_body,'')))<1 or length(trim(p_body))>1000 then raise exception 'MESSAGE_INVALID'; end if;

 if not exists(
  select 1
  from public.marketplace_claims c
  join public.marketplace_items i on i.id=c.item_id
  where c.id=p_claim_id
    and c.status in ('approved','ready')
    and (i.seller_id=v_user or c.claimant_id=v_user)
 ) then
  raise exception 'MESSAGE_NOT_ALLOWED';
 end if;

 insert into public.marketplace_messages(claim_id,sender_id,body)
 values(p_claim_id,v_user,trim(p_body))
 returning * into v_created;

 return query
 select v_created.id,v_created.claim_id,v_created.sender_id,v_created.body,v_created.created_at;
end; $$;
revoke all on function public.send_marketplace_pickup_message(uuid,text) from public, anon, authenticated;
grant execute on function public.send_marketplace_pickup_message(uuid,text) to authenticated, service_role;
