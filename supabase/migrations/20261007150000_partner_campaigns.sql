-- FairPath Partner Campaigns/Outreach - the safe half.
--
-- Audit before writing: user_notifications/push_tokens/notification_deliveries exist (20260929100000) but no
-- edge function or server code anywhere sends push, email, or SMS - notification_deliveries rows sit at
-- status='pending' forever today. Schema != delivery provider. This migration builds the real queueing
-- architecture on top of the REAL existing notification tables (no new delivery table invented) and is honest
-- that nothing is actually delivered yet - a campaign's delivery_deliveries rows will show 'pending', not
-- 'sent', until a provider is wired. consent_events already has marketing_opt_in/marketing_opt_out
-- (20260924150008) - reused as-is, not duplicated.
--
-- Scope decision, not guessed: v1 audience is restricted to an organization's own active case_management
-- caseload (organization_person_links, 'case_management' in data_scope). Whether Employer/Housing
-- organizations get any legitimate outreach audience is a real open product question - flagged for Sterling,
-- not answered here. This migration only supports case_management-scoped audiences; a campaign_audience_type
-- other than 'org_caseload' is not yet implemented, by design.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 120),
  headline text not null check (length(btrim(headline)) between 3 and 200),
  description text check (description is null or length(description) <= 2000),
  event_at timestamptz,
  location_text text,
  cta_text text,
  cta_url text,
  flyer_storage_path text,
  audience_type text not null default 'org_caseload' check (audience_type in ('org_caseload')),
  channel text not null default 'push' check (channel in ('push')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_org_idx on public.campaigns (organization_id, status);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid references public.user_notifications(id) on delete set null,
  state text not null default 'eligible' check (state in ('eligible', 'suppressed', 'queued')),
  suppression_reason text check (suppression_reason is null or suppression_reason in ('marketing_opt_out', 'no_active_relationship')),
  created_at timestamptz not null default now(),
  unique (campaign_id, person_id)
);
create index if not exists campaign_recipients_campaign_idx on public.campaign_recipients (campaign_id, state);

alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
revoke all on table public.campaigns, public.campaign_recipients from public, anon, authenticated;

drop policy if exists "campaigns_read_own_org" on public.campaigns;
create policy "campaigns_read_own_org" on public.campaigns
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id = campaigns.organization_id and om.user_id = (select auth.uid()) and om.status = 'active')
  );

drop policy if exists "campaign_recipients_read_own_org" on public.campaign_recipients;
create policy "campaign_recipients_read_own_org" on public.campaign_recipients
  for select to authenticated using (
    exists (
      select 1 from public.campaigns c join public.organization_members om on om.organization_id = c.organization_id
      where c.id = campaign_recipients.campaign_id and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );

grant select on table public.campaigns, public.campaign_recipients to authenticated;
grant select, insert, update, delete on table public.campaigns, public.campaign_recipients to service_role;

-- ---------------------------------------------------------------------
-- Private flyer storage - org-isolated by folder, same proven pattern as generated-documents
-- (20261001140000): never public, folder name = organization_id, owner/manager write, any active org
-- member read. Org A cannot read/replace/delete Org B's flyer for the same reason employer_id/org_id
-- boundaries already work everywhere else in this codebase.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-flyers', 'campaign-flyers', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "campaign_flyers_select_org_member" on storage.objects;
create policy "campaign_flyers_select_org_member" on storage.objects
  for select to authenticated using (
    bucket_id = 'campaign-flyers'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = (storage.foldername(name))[1] and om.user_id = (select auth.uid()) and om.status = 'active'
    )
  );
drop policy if exists "campaign_flyers_insert_org_manager" on storage.objects;
create policy "campaign_flyers_insert_org_manager" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'campaign-flyers'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = (storage.foldername(name))[1] and om.user_id = (select auth.uid()) and om.status = 'active' and om.member_role in ('owner', 'manager')
    )
  );
drop policy if exists "campaign_flyers_delete_org_manager" on storage.objects;
create policy "campaign_flyers_delete_org_manager" on storage.objects
  for delete to authenticated using (
    bucket_id = 'campaign-flyers'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = (storage.foldername(name))[1] and om.user_id = (select auth.uid()) and om.status = 'active' and om.member_role in ('owner', 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------
create or replace function public.partner_create_campaign(
  p_organization_id uuid, p_title text, p_headline text, p_description text default null,
  p_event_at timestamptz default null, p_location_text text default null,
  p_cta_text text default null, p_cta_url text default null, p_flyer_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(p_organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;

  insert into public.campaigns (organization_id, created_by, title, headline, description, event_at, location_text, cta_text, cta_url, flyer_storage_path)
  values (p_organization_id, uid, p_title, p_headline, p_description, p_event_at, p_location_text, p_cta_text, p_cta_url, p_flyer_storage_path)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.partner_create_campaign(uuid, text, text, text, timestamptz, text, text, text, text) from public, anon;
grant execute on function public.partner_create_campaign(uuid, text, text, text, timestamptz, text, text, text, text) to authenticated, service_role;

-- Resolves the real eligible audience: active case_management-scope caseload for this org, minus anyone whose
-- MOST RECENT marketing consent_events row is marketing_opt_out. A caseload relationship is not marketing
-- permission - this is the actual distinction the product spec required, not just a comment.
create or replace function public.partner_campaign_audience_preview(p_organization_id uuid)
returns table (person_id uuid, eligible boolean, reason text)
language sql
stable
security definer
set search_path = public
as $$
  with caseload as (
    select l.person_id from public.organization_person_links l
    where l.organization_id = p_organization_id and l.status = 'active' and 'case_management' = any(l.data_scope)
  ),
  latest_marketing_consent as (
    select distinct on (ce.user_id) ce.user_id, ce.event_type
    from public.consent_events ce
    where ce.event_type in ('marketing_opt_in', 'marketing_opt_out')
    order by ce.user_id, ce.created_at desc
  )
  select c.person_id,
         coalesce(lmc.event_type, 'marketing_opt_in') <> 'marketing_opt_out',
         case when coalesce(lmc.event_type, 'marketing_opt_in') = 'marketing_opt_out' then 'marketing_opt_out' else null end
  from caseload c
  left join latest_marketing_consent lmc on lmc.user_id = c.person_id
  where exists (select 1 from public.organization_members om where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active');
$$;
revoke all on function public.partner_campaign_audience_preview(uuid) from public, anon;
grant execute on function public.partner_campaign_audience_preview(uuid) to authenticated, service_role;

-- Queues the real campaign: for each eligible caseload member (minus opt-outs), inserts a real
-- user_notifications row (which the EXISTING trigger, 20260929100000, auto-queues into
-- notification_deliveries channel='push', status='pending'). Nothing here claims delivery succeeded - that
-- column stays 'pending' until a real push provider is wired, which this migration does not add.
create or replace function public.partner_send_campaign(p_campaign_id uuid)
returns table (eligible_count integer, suppressed_count integer, queued_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_campaign record;
  v_eligible integer := 0;
  v_suppressed integer := 0;
  v_queued integer := 0;
  r record;
  v_notification_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if v_campaign is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.partner_is_org_manager(v_campaign.organization_id) then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if v_campaign.status <> 'draft' then raise exception 'CAMPAIGN_NOT_DRAFT' using errcode = 'P0001'; end if;

  update public.campaigns set status = 'sending', updated_at = now() where id = p_campaign_id;

  for r in select * from public.partner_campaign_audience_preview(v_campaign.organization_id) loop
    if r.eligible then
      v_eligible := v_eligible + 1;
      insert into public.user_notifications (user_id, category, title, body, route, metadata)
      values (
        r.person_id, 'campaign', v_campaign.headline,
        coalesce(v_campaign.description, v_campaign.headline),
        null, jsonb_build_object('campaign_id', p_campaign_id, 'organization_id', v_campaign.organization_id)
      )
      returning id into v_notification_id;

      insert into public.campaign_recipients (campaign_id, person_id, notification_id, state)
      values (p_campaign_id, r.person_id, v_notification_id, 'queued')
      on conflict (campaign_id, person_id) do update set notification_id = excluded.notification_id, state = 'queued';
      v_queued := v_queued + 1;
    else
      v_suppressed := v_suppressed + 1;
      insert into public.campaign_recipients (campaign_id, person_id, state, suppression_reason)
      values (p_campaign_id, r.person_id, 'suppressed', r.reason)
      on conflict (campaign_id, person_id) do update set state = 'suppressed', suppression_reason = excluded.suppression_reason;
    end if;
  end loop;

  update public.campaigns set status = 'sent', sent_at = now(), updated_at = now() where id = p_campaign_id;
  return query select v_eligible, v_suppressed, v_queued;
end;
$$;
revoke all on function public.partner_send_campaign(uuid) from public, anon;
grant execute on function public.partner_send_campaign(uuid) to authenticated, service_role;
