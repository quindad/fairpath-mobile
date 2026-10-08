-- Record Relief production hardening: atomic evaluation replacement, retention, consent audit, and durable schedules.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.replace_record_relief_evaluations(p_case uuid,p_user uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;
begin
  if p_user is null or not exists(select 1 from public.record_relief_cases where id=p_case and user_id=p_user) then raise exception 'CASE_UNAVAILABLE'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>100 then raise exception 'INVALID_ROWS'; end if;
  update public.record_relief_evaluations set superseded=true where case_id=p_case and user_id=p_user and not superseded;
  insert into public.record_relief_evaluations(case_id,user_id,jurisdiction_code,remedy,outcome,eligibility_date,days_remaining,inputs_used,missing_inputs,reasons,rule_stale,engine_version,next_reevaluate_at)
  select p_case,p_user,x.jurisdiction_code,x.remedy,x.outcome,x.eligibility_date,x.days_remaining,coalesce(x.inputs_used,'{}'::jsonb),coalesce(x.missing_inputs,'[]'::jsonb),coalesce(x.reasons,'[]'::jsonb),coalesce(x.rule_stale,false),x.engine_version,x.next_reevaluate_at
  from jsonb_to_recordset(p_rows) as x(jurisdiction_code text,remedy text,outcome text,eligibility_date date,days_remaining integer,inputs_used jsonb,missing_inputs jsonb,reasons jsonb,rule_stale boolean,engine_version text,next_reevaluate_at timestamptz);
  get diagnostics n=row_count; return n;
end$$;
revoke all on function public.replace_record_relief_evaluations(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_record_relief_evaluations(uuid,uuid,jsonb) to service_role;

create table if not exists public.record_relief_consent_events(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,upload_id uuid references public.record_relief_uploads(id) on delete cascade,
 consent_version text not null,consented_at timestamptz not null default now(),purpose text not null default 'case_document_extraction',
 created_at timestamptz not null default now());
alter table public.record_relief_consent_events enable row level security;
revoke all on table public.record_relief_consent_events from public,anon,authenticated;
grant select,insert,update,delete on table public.record_relief_consent_events to service_role;

create or replace function public.record_relief_record_consent(p_upload uuid,p_version text)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'SIGNED_OUT'; end if;
 if length(coalesce(p_version,''))<1 or length(p_version)>50 then raise exception 'INVALID_CONSENT_VERSION'; end if;
 update public.record_relief_uploads set consented_at=now(),consent_version=p_version where id=p_upload and user_id=uid and status in('uploaded','failed');
 if not found then raise exception 'UPLOAD_UNAVAILABLE'; end if;
 insert into public.record_relief_consent_events(user_id,upload_id,consent_version) values(uid,p_upload,p_version);
end$$;
revoke all on function public.record_relief_record_consent(uuid,text) from public,anon;
grant execute on function public.record_relief_record_consent(uuid,text) to authenticated;

create or replace function public.record_relief_mark_expired() returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;
begin
 update public.record_relief_uploads set status='deleted',extraction=null,storage_path='',updated_at=now()
 where expires_at<=now() and status<>'deleted';
 get diagnostics n=row_count; return n;
end$$;
revoke all on function public.record_relief_mark_expired() from public,anon,authenticated;
grant execute on function public.record_relief_mark_expired() to service_role;

do $$ begin
 if exists(select 1 from cron.job where jobname='record-relief-due-notifications') then perform cron.unschedule('record-relief-due-notifications'); end if;
 if exists(select 1 from cron.job where jobname='record-relief-expiry-mark') then perform cron.unschedule('record-relief-expiry-mark'); end if;
 perform cron.schedule('record-relief-due-notifications','15 13 * * *','select public.record_relief_notify_due()');
 perform cron.schedule('record-relief-expiry-mark','45 4 * * *','select public.record_relief_mark_expired()');
end $$;
