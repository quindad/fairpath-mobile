-- FairPath Partner foundation, part 1: the org <-> person authorization relationship.
--
-- This is the SMALLEST additive schema that can answer "is this organization currently authorized to work
-- with this person, for what purpose, and at what data scope" - the gate every future Partner caseload/
-- referral/outcome feature must check before showing ANYTHING about a real member to an organization.
--
-- Explicitly NOT a referral system, NOT a caseload feature set, NOT a needs/outcomes model. Those come later,
-- once this relationship primitive is proven safe. consent_events (20260924150008) is untouched - this is a
-- new, narrower, organization-scoped concept: platform-level consent (terms/privacy/marketing) is not the
-- same thing as "org X may see person Y's case-management data."
--
-- Data-scope classification (documented, not all built yet):
--   'basic'            - name/contact info a Partner org may reasonably see once authorized
--   'case_management'  - needs/referrals/program participation/outcomes (future tables)
--   NOT MODELED HERE: 'highly_sensitive' (justice history, legal docs, credit, financial) is never granted
--     through this table. When that becomes necessary it needs its own, even narrower, explicit-purpose gate -
--     this migration deliberately does not build it, to avoid quietly widening access to convictions/
--     supervision_records/credit_reports etc. through a generic relationship row.

create table if not exists public.organization_person_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in (
    'case_management', 'referral_coordination', 'program_enrollment', 'housing_placement', 'employment_placement', 'other'
  )),
  data_scope text[] not null default '{basic}'
    check (data_scope <@ array['basic', 'case_management']),
  source text not null check (source in (
    'member_consent', 'accepted_referral', 'program_enrollment', 'case_assignment', 'correctional_transition', 'staff_created'
  )),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (status <> 'revoked' or revoked_at is not null),
  check (status = 'revoked' or revoked_at is null)
);

-- One active link per (org, person, purpose) - re-authorizing after revocation inserts a new row, preserving
-- the old one as history rather than resurrecting it silently.
create unique index if not exists organization_person_links_active_unique
  on public.organization_person_links (organization_id, person_id, purpose) where status = 'active';
create index if not exists organization_person_links_org_idx on public.organization_person_links (organization_id, status);
create index if not exists organization_person_links_person_idx on public.organization_person_links (person_id, status);

comment on table public.organization_person_links is
  'The org<->person authorization gate. A row with status=active is the ONLY thing that can make a future '
  'caseload/referral feature show a Partner organization anything about a real person. Revoking (status=revoked) '
  'must actually remove access - every read path must filter on status=active, never just existence of a row.';

alter table public.organization_person_links enable row level security;
revoke all on table public.organization_person_links from public, anon, authenticated;

-- The person themselves may see who currently has access to them (transparency, low risk, matches the
-- existing pattern of self-readable member state tables like saved_resources/resource_interactions).
drop policy if exists "organization_person_links_read_own_as_person" on public.organization_person_links;
create policy "organization_person_links_read_own_as_person" on public.organization_person_links
  for select to authenticated using (person_id = (select auth.uid()));

-- An organization's active owner/manager/editor may see that organization's links - never another org's.
-- Reuses organization_members exactly as jobs/housing organization ownership already does; no second model.
drop policy if exists "organization_person_links_read_own_as_org_member" on public.organization_person_links;
create policy "organization_person_links_read_own_as_org_member" on public.organization_person_links
  for select to authenticated using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_person_links.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

grant select on table public.organization_person_links to authenticated;
grant select, insert, update, delete on table public.organization_person_links to service_role;

-- ---------------------------------------------------------------------
-- Write path: security-definer RPCs only (same shape as partner_acknowledge_housing_inquiry /
-- partner_reply_housing_inquiry - the existing precedent for how Partner writes through member RLS). No
-- direct table insert/update grant to authenticated: only owner/manager may create or revoke a link, and the
-- function re-checks that role itself rather than trusting the client.
-- ---------------------------------------------------------------------
create or replace function public.partner_link_person_to_organization(
  p_organization_id uuid, p_person_id uuid, p_purpose text, p_data_scope text[], p_source text, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = uid
      and om.status = 'active' and om.member_role in ('owner', 'manager')
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if not (p_data_scope <@ array['basic', 'case_management']) then
    raise exception 'INVALID_DATA_SCOPE' using errcode = 'P0001';
  end if;

  insert into public.organization_person_links
    (organization_id, person_id, purpose, data_scope, source, granted_by, notes)
  values (p_organization_id, p_person_id, p_purpose, coalesce(p_data_scope, array['basic']), p_source, uid, p_notes)
  on conflict (organization_id, person_id, purpose) where status = 'active'
  do nothing
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.organization_person_links
      where organization_id = p_organization_id and person_id = p_person_id and purpose = p_purpose and status = 'active';
  end if;
  return new_id;
end;
$$;
revoke all on function public.partner_link_person_to_organization(uuid, uuid, text, text[], text, text) from public, anon;
grant execute on function public.partner_link_person_to_organization(uuid, uuid, text, text[], text, text) to authenticated, service_role;

create or replace function public.partner_revoke_organization_person_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_org uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  select organization_id into v_org from public.organization_person_links where id = p_link_id and status = 'active';
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = v_org and om.user_id = uid
      and om.status = 'active' and om.member_role in ('owner', 'manager')
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  update public.organization_person_links
    set status = 'revoked', revoked_by = uid, revoked_at = now()
    where id = p_link_id and status = 'active';
end;
$$;
revoke all on function public.partner_revoke_organization_person_link(uuid) from public, anon;
grant execute on function public.partner_revoke_organization_person_link(uuid) to authenticated, service_role;

-- Basic-scope identity for a linked person - the ONLY window a Partner org gets into a real member's data
-- through this migration. Deliberately returns first_name/last_name only, never justice-history, credit,
-- documents, or anything from the highly_sensitive classification - and only for a person currently linked
-- (status=active) to an organization the caller actively belongs to.
create or replace function public.partner_caseload_for_organization(p_organization_id uuid)
returns table (link_id uuid, person_id uuid, first_name text, last_name text, purpose text, data_scope text[], status text, granted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.person_id, p.first_name, p.last_name, l.purpose, l.data_scope, l.status, l.granted_at
  from public.organization_person_links l
  join public.profiles p on p.id = l.person_id
  where l.organization_id = p_organization_id
    and l.status = 'active'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id and om.user_id = auth.uid()
        and om.status = 'active'
    )
  order by l.granted_at desc;
$$;
revoke all on function public.partner_caseload_for_organization(uuid) from public, anon;
grant execute on function public.partner_caseload_for_organization(uuid) to authenticated, service_role;
