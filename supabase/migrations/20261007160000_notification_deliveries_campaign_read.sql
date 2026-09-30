-- Found via live Campaigns Browser QA: notification_deliveries had zero grant to authenticated at all
-- (service_role only, from 20260929100000) - correct for Mobile (members never need to read their own
-- delivery-attempt rows), but Partner orgs legitimately need to see whether THEIR OWN campaign's queued
-- notifications actually delivered. Scoped narrowly: a delivery row is readable only if its notification_id
-- traces back through campaign_recipients to a campaign owned by an org the caller actively belongs to -
-- never a blanket grant, never another org's or a non-campaign notification's delivery status.
drop policy if exists "notification_deliveries_read_own_campaign" on public.notification_deliveries;
create policy "notification_deliveries_read_own_campaign" on public.notification_deliveries
  for select to authenticated using (
    exists (
      select 1 from public.campaign_recipients cr
      join public.campaigns c on c.id = cr.campaign_id
      join public.organization_members om on om.organization_id = c.organization_id
      where cr.notification_id = notification_deliveries.notification_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

alter table public.notification_deliveries enable row level security;
grant select on table public.notification_deliveries to authenticated;
