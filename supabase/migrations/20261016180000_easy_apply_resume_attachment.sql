-- Real bug found during tonight's Easy Apply audit: "EASY APPLY WITH FAIRPATH" never attached, referenced, or
-- even checked for a real résumé. The UI's "RESUME READY" field was free text with no options, but
-- submit_job_application only ever accepted it if the value was the exact literal string 'Yes' or 'No' -- any
-- other text was silently dropped, never shown as an error. A member's real Resume Studio résumé
-- (member_resumes) was never touched by this flow at all, despite the feature's name implying it is.
--
-- This migration adds an optional p_resume_id so a member can attach one of their own real Resume Studio
-- résumés. The snapshot is built SERVER-SIDE from the member's own member_resumes row (same trust pattern as
-- build_opportunity_snapshot) -- the client sends only an id, never resume content, so nothing the client
-- claims about a résumé can be forged into an application.
--
-- Must DROP first: adding a trailing parameter changes the signature, which Postgres treats as a new overload
-- rather than a replacement (same ambiguous-call risk already hit and fixed twice tonight on other functions).
drop function if exists public.submit_job_application(uuid, jsonb);

create or replace function public.submit_job_application(p_job_id uuid, p_answers jsonb default '{}'::jsonb, p_resume_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs%rowtype;
  prof jsonb := coalesce(p_answers -> 'profile', '{}'::jsonb);
  eq jsonb := coalesce(p_answers -> 'employer_questions', '{}'::jsonb);
  first_name text := btrim(coalesce(prof ->> 'first_name', ''));
  last_name text := btrim(coalesce(prof ->> 'last_name', ''));
  phone_digits text := regexp_replace(coalesce(prof ->> 'phone', ''), '[^0-9]', '', 'g');
  email text := btrim(coalesce(auth.jwt() ->> 'email', ''));
  stored_profile jsonb;
  stored_eq jsonb := '{}'::jsonb;
  stored_answers jsonb;
  share boolean := coalesce((p_answers ->> 'share_opportunity_profile')::boolean, false);
  share_sections text[] := '{}';
  snap jsonb;
  resume_row public.member_resumes%rowtype;
  q jsonb;
  qid text;
  ans text;
  app_id uuid;
  opt text;
begin
  if uid is null then
    raise exception 'SIGNED_OUT' using errcode = 'P0001';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if not found or j.status <> 'published' or (j.expires_at is not null and j.expires_at <= now()) then
    raise exception 'JOB_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if j.application_method = 'external' then
    raise exception 'EXTERNAL_APPLICATION' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.job_applications a where a.user_id = uid and a.job_id = p_job_id) then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  if p_resume_id is not null then
    select * into resume_row from public.member_resumes r where r.id = p_resume_id and r.user_id = uid;
    if not found then raise exception 'RESUME_NOT_FOUND' using errcode = 'P0001'; end if;
  end if;

  if length(first_name) < 2 then raise exception 'INVALID_APPLICATION:first_name' using errcode = 'P0001'; end if;
  if length(last_name) < 2 then raise exception 'INVALID_APPLICATION:last_name' using errcode = 'P0001'; end if;
  if length(phone_digits) <> 10 then raise exception 'INVALID_APPLICATION:phone' using errcode = 'P0001'; end if;
  if email = '' then raise exception 'INVALID_APPLICATION:email' using errcode = 'P0001'; end if;

  stored_profile := jsonb_build_object(
    'first_name', left(first_name, 80),
    'last_name', left(last_name, 80),
    'email', left(email, 254),
    'phone', phone_digits
  );
  foreach opt in array array['education', 'skills', 'certifications', 'desired_roles'] loop
    if nullif(btrim(coalesce(prof ->> opt, '')), '') is not null then
      stored_profile := stored_profile || jsonb_build_object(opt, left(btrim(prof ->> opt), 500));
    end if;
  end loop;

  for q in select * from jsonb_array_elements(coalesce(j.application_questions, '[]'::jsonb)) loop
    qid := q ->> 'id';
    continue when qid is null;
    ans := btrim(coalesce(eq ->> qid, ''));
    if coalesce((q ->> 'required')::boolean, false) and ans = '' then
      raise exception 'INVALID_APPLICATION:question:%', qid using errcode = 'P0001';
    end if;
    if ans <> '' then
      stored_eq := stored_eq || jsonb_build_object(qid, left(ans, 2000));
    end if;
  end loop;

  stored_answers := jsonb_build_object(
    'profile', stored_profile,
    'employer_questions', stored_eq,
    'submitted_via', 'easy_apply',
    'reviewed_by_user', true
  );

  if resume_row.id is not null then
    stored_answers := stored_answers || jsonb_build_object('resume_snapshot', jsonb_build_object(
      'resume_id', resume_row.id, 'title', resume_row.title, 'content', resume_row.content
    ));
  end if;

  if share then
    select coalesce(array_agg(x), '{}') into share_sections
    from jsonb_array_elements_text(coalesce(p_answers -> 'share_sections', '[]'::jsonb)) x;
    snap := public.build_opportunity_snapshot(uid, share_sections);
    if snap is not null then
      stored_answers := stored_answers || jsonb_build_object('opportunity_snapshot', snap);
    end if;
  end if;

  insert into public.job_applications (user_id, job_id, status, answers, submitted_at, updated_at)
  values (uid, p_job_id, 'submitted', stored_answers, now(), now())
  on conflict (user_id, job_id) do nothing
  returning id into app_id;

  if app_id is null then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;
  return app_id;
end;
$$;

revoke all on function public.submit_job_application(uuid, jsonb, uuid) from public;
grant execute on function public.submit_job_application(uuid, jsonb, uuid) to authenticated, service_role;
