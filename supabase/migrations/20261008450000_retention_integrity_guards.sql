-- Retention integrity hardening discovered during completion QA.
-- Prevents a caller from confirming a future checkpoint early and turning it into false retention evidence.
-- Also guarantees one support request per checkpoint even if a client retries the RPC.

create unique index if not exists retention_support_requests_checkpoint_open_unique
  on public.retention_support_requests (checkpoint_id)
  where checkpoint_id is not null;

create or replace function public.member_confirm_retention_checkpoint(
  p_checkpoint_id uuid, p_status_report text, p_support_category text default null, p_support_detail text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
  v_placement_id uuid;
  v_due_at date;
begin
  if p_status_report not in ('still_working', 'ended', 'support_needed') then raise exception 'INVALID_STATUS_REPORT'; end if;
  select person_id, placement_id, due_at into v_person_id, v_placement_id, v_due_at
  from public.retention_checkpoints where id = p_checkpoint_id;
  if v_person_id is null then raise exception 'NOT_FOUND'; end if;
  if v_person_id <> auth.uid() then raise exception 'NOT_AUTHORIZED'; end if;
  if v_due_at > current_date + 2 then raise exception 'RETENTION_CHECKPOINT_NOT_DUE'; end if;
  if p_status_report = 'still_working' then
    update public.retention_checkpoints set status = 'confirmed_active', completed_at = now(), verification_source = 'member', verification_method = 'member_self_report', updated_at = now() where id = p_checkpoint_id;
  elsif p_status_report = 'ended' then
    update public.retention_checkpoints set status = 'ended', completed_at = now(), verification_source = 'member', verification_method = 'member_self_report', updated_at = now() where id = p_checkpoint_id;
  else
    if p_support_category is null then raise exception 'SUPPORT_CATEGORY_REQUIRED'; end if;
    update public.retention_checkpoints set status = 'at_risk', completed_at = now(), verification_source = 'member', verification_method = 'member_self_report', updated_at = now() where id = p_checkpoint_id;
    insert into public.retention_support_requests (checkpoint_id, person_id, placement_id, category, detail)
    values (p_checkpoint_id, v_person_id, v_placement_id, p_support_category, p_support_detail)
    on conflict (checkpoint_id) where checkpoint_id is not null do update
      set category = excluded.category, detail = excluded.detail, updated_at = now();
  end if;
end;
$$;
revoke all on function public.member_confirm_retention_checkpoint(uuid, text, text, text) from public, anon;
grant execute on function public.member_confirm_retention_checkpoint(uuid, text, text, text) to authenticated, service_role;

create or replace function public.employer_confirm_retention_checkpoint(p_checkpoint_id uuid, p_status_report text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_person_id uuid;
  v_placement_id uuid;
  v_due_at date;
begin
  if p_status_report not in ('confirmed_active', 'ended', 'support_needed') then raise exception 'INVALID_STATUS_REPORT'; end if;
  select organization_id, person_id, placement_id, due_at into v_org_id, v_person_id, v_placement_id, v_due_at
  from public.retention_checkpoints where id = p_checkpoint_id;
  if v_org_id is null then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id = v_org_id and om.user_id = auth.uid() and om.status = 'active') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_due_at > current_date + 2 then raise exception 'RETENTION_CHECKPOINT_NOT_DUE'; end if;

  if p_status_report = 'confirmed_active' then
    update public.retention_checkpoints set status = 'confirmed_active', completed_at = now(), verification_source = 'employer', verification_method = 'employer_self_report', updated_at = now() where id = p_checkpoint_id;
  elsif p_status_report = 'ended' then
    update public.retention_checkpoints set status = 'ended', completed_at = now(), verification_source = 'employer', verification_method = 'employer_self_report', updated_at = now() where id = p_checkpoint_id;
  else
    update public.retention_checkpoints set status = 'at_risk', verification_source = 'employer', verification_method = 'employer_self_report', updated_at = now() where id = p_checkpoint_id;
    insert into public.retention_support_requests (checkpoint_id, person_id, placement_id, category, detail)
    values (p_checkpoint_id, v_person_id, v_placement_id, 'employer_reported_concern', null)
    on conflict (checkpoint_id) where checkpoint_id is not null do update
      set category = excluded.category, detail = null, updated_at = now();
  end if;
end;
$$;
revoke all on function public.employer_confirm_retention_checkpoint(uuid, text) from public, anon;
grant execute on function public.employer_confirm_retention_checkpoint(uuid, text) to authenticated, service_role;
