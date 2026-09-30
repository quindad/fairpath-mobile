-- FairPath Partner, Housing Provider vertical: the safe half of the schema gap.
--
-- Audit findings before writing this:
--   1. org_type='provider' in real DEV data means healthcare/financial providers (ClearPath Community Health,
--      Fresh Start Credit Union) - NOT housing providers. Using it for a Housing Provider workspace would be
--      wrong. Zero organizations currently own any housing_listings row (organization_id is null on every
--      row). Housing Provider workspace differentiation therefore needs its OWN signal, not org_type reuse -
--      deferred to a follow-up decision, not solved here.
--   2. housing_applications had ZERO owner/provider-side RLS policy of any kind (read or write) - worse than
--      job_applications, which at least had an unreachable policy. housing_application_documents stores real
--      uploaded files (document_type/storage_path) for identity/income/employment/housing_history evidence,
--      including FastTrack paid applications - genuinely sensitive. Per explicit instruction: STOP before
--      granting Partner any access to housing_application_documents. This migration does not touch that table
--      or its storage objects at all.
--
-- What this migration DOES grant, safely: a curated, security-definer projection of housing_applications that
-- excludes `answers`, `applicant_snapshot`, and `consent_snapshot` (unreviewed jsonb blobs of unknown
-- sensitivity) - only the fields a provider legitimately needs to triage: status, listing, applicant identity
-- link, submitted_at, current_step. No direct table grant to authenticated is added, so there is no path for
-- Partner to read the excluded columns even if a future query tried.

create or replace function public.partner_housing_applications_for_listing(p_listing_id uuid)
returns table (
  id uuid, user_id uuid, listing_id uuid, application_type text, status text,
  submitted_at timestamptz, current_step integer, partner_note text, status_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.user_id, a.listing_id, a.application_type, a.status, a.submitted_at, a.current_step, a.partner_note, a.status_reason
  from public.housing_applications a
  join public.housing_listings h on h.id = a.listing_id
  where a.listing_id = p_listing_id
    and (
      h.owner_id = auth.uid()
      or (h.organization_id is not null and exists (
        select 1 from public.organization_members om
        where om.organization_id = h.organization_id and om.user_id = auth.uid() and om.status = 'active'
      ))
    )
  order by a.submitted_at desc nulls last, a.id;
$$;
revoke all on function public.partner_housing_applications_for_listing(uuid) from public, anon;
grant execute on function public.partner_housing_applications_for_listing(uuid) to authenticated, service_role;

-- Status-only transition. Never touches answers/applicant_snapshot/consent_snapshot or any document row.
create or replace function public.partner_update_housing_application_status(
  p_application_id uuid, p_status text, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_app record;
  v_listing record;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if p_status not in ('reviewing', 'tour', 'approved', 'denied') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_app from public.housing_applications where id = p_application_id;
  if v_app is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_app.status not in ('submitted', 'reviewing', 'tour') then
    raise exception 'APPLICATION_NOT_ACTIONABLE' using errcode = 'P0001';
  end if;

  select * into v_listing from public.housing_listings where id = v_app.listing_id;
  if not (
    v_listing.owner_id = uid
    or (v_listing.organization_id is not null and exists (
      select 1 from public.organization_members om
      where om.organization_id = v_listing.organization_id and om.user_id = uid and om.status = 'active' and om.member_role in ('owner', 'manager')
    ))
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  update public.housing_applications
    set status = p_status, status_reason = coalesce(p_note, status_reason), updated_at = now()
    where id = p_application_id;

  insert into public.housing_application_events (application_id, actor_user_id, event_type, metadata)
  values (p_application_id, uid, 'provider_status_change', jsonb_build_object('from', v_app.status, 'to', p_status, 'note', p_note));
end;
$$;
revoke all on function public.partner_update_housing_application_status(uuid, text, text) from public, anon;
grant execute on function public.partner_update_housing_application_status(uuid, text, text) to authenticated, service_role;
